// The admin beat actions and the upload route against the real database
// (PLAN.md §5.5, .claude/rules/uploads.md). Storage reads are faked: each
// test says how big an uploaded file is and what its first bytes are.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  attachBeatFile,
  createBeat,
  setBeatStatus,
  updateBeat,
  updateBeatPrices,
} from "../../src/actions/beats";
import { POST } from "../../src/app/api/upload/route";
import { getCurrentUser } from "../../src/lib/auth-guards"; // faked in setup.ts
import { db } from "../../src/lib/db";
import { deleteFile, fileSize, firstBytes } from "../../src/lib/storage";
import { newUploadKey } from "../../src/lib/uploads";
import {
  createTestBeat,
  createTestUser,
  deleteTestBeat,
  deleteTestUser,
} from "./fixtures";

// refresh() only works inside a real Next request; redirect() throws, as
// the real one does.
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect to ${url}`);
  },
}));
// Signing upload links stays real (it's offline). Reading and deleting
// files is faked.
vi.mock("../../src/lib/storage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/lib/storage")>()),
  fileSize: vi.fn(),
  firstBytes: vi.fn(),
  deleteFile: vi.fn(),
}));

const MB = 1024 * 1024;
const MP3_START = new Uint8Array([0x49, 0x44, 0x33, 4, 0]); // "ID3"
const WAV_START = new Uint8Array([
  ...[0x52, 0x49, 0x46, 0x46], // RIFF
  ...[0, 0, 0, 0],
  ...[0x57, 0x41, 0x56, 0x45], // WAVE
]);

let beatIds: string[];
let userIds: string[];

beforeEach(() => {
  vi.mocked(getCurrentUser).mockResolvedValue(null); // signed out
  beatIds = [];
  userIds = [];
});

afterEach(async () => {
  vi.clearAllMocks();
  for (const id of beatIds) await deleteTestBeat(id);
  for (const id of userIds) await deleteTestUser(id);
});

async function signIn(role: "USER" | "ADMIN") {
  const user = await createTestUser(true);
  userIds.push(user.id);
  vi.mocked(getCurrentUser).mockResolvedValue(
    await db.user.update({ where: { id: user.id }, data: { role } }),
  );
}

// A test beat as a DRAFT with no files, so each test adds what it needs.
async function draftBeat() {
  const beat = await createTestBeat();
  beatIds.push(beat.beatId);
  await db.beat.update({
    where: { id: beat.beatId },
    data: { status: "DRAFT" },
  });
  return beat;
}

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

const details = {
  title: "Admin test beat",
  slug: "",
  description: "<b>Plain</b> text",
  bpm: "92",
  musicalKey: "A minor",
  genre: "Lo-fi",
  mood: "Calm",
  tags: "chill, keys",
};

// Uploads one file for real as far as the database knows: a key the server
// picked, then attachBeatFile with the faked storage answers.
async function upload(
  beatId: string,
  kind: "preview" | "mp3" | "wav",
  size: number,
  start: Uint8Array,
) {
  const key = newUploadKey(beatId, kind === "wav" ? "wav" : "mp3");
  // Not "Once": a file that fails the size check never has its bytes read.
  vi.mocked(fileSize).mockResolvedValue(size);
  vi.mocked(firstBytes).mockResolvedValue(start);
  return { key, result: await attachBeatFile(beatId, kind, key) };
}

const beatRow = (id: string) => db.beat.findUniqueOrThrow({ where: { id } });

describe("admin beat actions", () => {
  it("refuse a signed-out visitor and a non-admin", async () => {
    const beat = await draftBeat();
    const calls = [
      () => createBeat(undefined, form(details)),
      () => updateBeat(undefined, form({ ...details, beatId: beat.beatId })),
      () =>
        setBeatStatus(
          undefined,
          form({ beatId: beat.beatId, status: "PUBLISHED" }),
        ),
      () => updateBeatPrices(undefined, form({ beatId: beat.beatId })),
      () =>
        attachBeatFile(beat.beatId, "wav", newUploadKey(beat.beatId, "wav")),
    ];
    for (const call of calls) {
      await expect(call()).rejects.toThrow("redirect to /sign-in");
    }
    await signIn("USER");
    for (const call of calls) {
      await expect(call()).rejects.toThrow("redirect to /");
    }
  });

  it("create a DRAFT beat with every license at its default price", async () => {
    await signIn("ADMIN");
    const slug = `admin-test-${Date.now()}`;

    const redirect = await createBeat(
      undefined,
      form({ ...details, slug }),
    ).catch((error: Error) => error.message);

    const beat = await db.beat.findUniqueOrThrow({
      where: { slug },
      include: { licenses: { include: { licenseTier: true } } },
    });
    beatIds.push(beat.id);
    expect(redirect).toBe(`redirect to /admin/beats/${beat.id}`);
    expect(beat.status).toBe("DRAFT");
    expect(beat.tags).toEqual(["chill", "keys"]);
    expect(beat.description).toBe("<b>Plain</b> text"); // stored as typed
    expect(beat.licenses).toHaveLength(4);
    for (const license of beat.licenses) {
      expect(license.priceCents).toBe(license.licenseTier.defaultPriceCents);
      expect(license.active).toBe(true);
    }
  });

  it("refuse a slug another beat already uses", async () => {
    await signIn("ADMIN");
    const first = await draftBeat();
    const second = await draftBeat();
    const { slug } = await beatRow(first.beatId);

    const result = await updateBeat(
      undefined,
      form({ ...details, slug, beatId: second.beatId }),
    );

    expect(result.ok).toBe(false);
    expect(result.fieldErrors?.slug).toEqual([
      "Another beat already uses this slug.",
    ]);
  });

  it("block publishing until the active licenses' files are uploaded", async () => {
    await signIn("ADMIN");
    const beat = await draftBeat();
    const publish = () =>
      setBeatStatus(
        undefined,
        form({ beatId: beat.beatId, status: "PUBLISHED" }),
      );

    const blocked = await publish();
    expect(blocked.ok).toBe(false);
    expect(blocked.message).toContain("Upload a preview MP3.");
    expect((await beatRow(beat.beatId)).status).toBe("DRAFT");

    // Trackout and Exclusive include stems, which aren't uploaded: turn
    // them off, then upload the rest.
    const licenses = await db.beatLicense.findMany({
      where: { beatId: beat.beatId },
      include: { licenseTier: true },
    });
    const prices: Record<string, string> = { beatId: beat.beatId };
    for (const license of licenses) {
      prices[`price-${license.id}`] = "29.99";
      if (!license.licenseTier.includesStems)
        prices[`active-${license.id}`] = "on";
    }
    expect((await updateBeatPrices(undefined, form(prices))).ok).toBe(true);
    for (const kind of ["preview", "mp3"] as const) {
      expect(
        (await upload(beat.beatId, kind, 3 * MB, MP3_START)).result.ok,
      ).toBe(true);
    }
    expect(
      (await upload(beat.beatId, "wav", 50 * MB, WAV_START)).result.ok,
    ).toBe(true);

    expect((await publish()).ok).toBe(true);
    expect((await beatRow(beat.beatId)).status).toBe("PUBLISHED");
  });

  it("never change a beat a checkout is holding", async () => {
    await signIn("ADMIN");
    const beat = await draftBeat();
    await db.beat.update({
      where: { id: beat.beatId },
      data: { status: "RESERVED" },
    });

    const result = await setBeatStatus(
      undefined,
      form({ beatId: beat.beatId, status: "DRAFT" }),
    );

    expect(result.ok).toBe(false);
    expect((await beatRow(beat.beatId)).status).toBe("RESERVED");
  });

  it("save prices as cents and refuse a price that isn't one", async () => {
    await signIn("ADMIN");
    const beat = await draftBeat();
    const license = await db.beatLicense.findFirstOrThrow({
      where: { beatId: beat.beatId },
    });
    const others = await db.beatLicense.findMany({
      where: { beatId: beat.beatId, id: { not: license.id } },
    });
    const fields = (price: string) => {
      const values: Record<string, string> = { beatId: beat.beatId };
      values[`price-${license.id}`] = price;
      values[`active-${license.id}`] = "on";
      for (const other of others) values[`price-${other.id}`] = "10";
      return form(values);
    };

    expect((await updateBeatPrices(undefined, fields("abc"))).ok).toBe(false);
    expect((await updateBeatPrices(undefined, fields("0.10"))).ok).toBe(false);
    expect((await updateBeatPrices(undefined, fields("34.95"))).ok).toBe(true);

    const after = await db.beatLicense.findUniqueOrThrow({
      where: { id: license.id },
    });
    expect(after.priceCents).toBe(3495);
    // The others were left unticked, so they're off now.
    const otherRows = await db.beatLicense.findMany({
      where: { id: { in: others.map((o) => o.id) } },
    });
    expect(
      otherRows.every((row) => !row.active && row.priceCents === 1000),
    ).toBe(true);
  });
});

describe("uploaded files", () => {
  it("an oversized or wrong-type file is deleted, never saved, and publishing stays blocked", async () => {
    await signIn("ADMIN");
    const beat = await draftBeat();

    const tooBig = await upload(beat.beatId, "preview", 21 * MB, MP3_START);
    const notMp3 = await upload(beat.beatId, "preview", 3 * MB, WAV_START);

    expect(tooBig.result).toEqual({
      ok: false,
      message: "The file is too big: a preview MP3 can be 20 MB at most.",
    });
    expect(notMp3.result).toEqual({
      ok: false,
      message: "This file isn't a preview MP3.",
    });
    expect(deleteFile).toHaveBeenCalledWith("public", tooBig.key);
    expect(deleteFile).toHaveBeenCalledWith("public", notMp3.key);
    expect((await beatRow(beat.beatId)).previewKey).toBeNull();

    const publish = await setBeatStatus(
      undefined,
      form({ beatId: beat.beatId, status: "PUBLISHED" }),
    );
    expect(publish.ok).toBe(false);
  });

  it("a key the server didn't make for this beat is refused", async () => {
    await signIn("ADMIN");
    const beat = await draftBeat();
    const other = await draftBeat();

    for (const key of [
      newUploadKey(other.beatId, "wav"), // another beat's folder
      `uploads/${beat.beatId}/../../secret.wav`,
      "previews/first-light.mp3",
    ]) {
      expect(await attachBeatFile(beat.beatId, "wav", key)).toEqual({
        ok: false,
        message: "Unknown upload.",
      });
    }
    expect(fileSize).not.toHaveBeenCalled();
  });
});

describe("POST /api/upload", () => {
  const request = (body: unknown) =>
    POST(
      new Request("http://localhost:3000/api/upload", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );

  it("gives an admin a 10-minute PUT link under a key the server picked", async () => {
    await signIn("ADMIN");
    const beat = await draftBeat();

    const response = await request({
      beatId: beat.beatId,
      kind: "wav",
      contentType: "audio/wav",
    });

    expect(response.status).toBe(200);
    const { url, key } = await response.json();
    expect(key).toMatch(
      new RegExp(`^uploads/${beat.beatId}/[0-9a-f-]{36}\\.wav$`),
    );
    const link = new URL(url);
    expect(link.pathname).toBe(`/beatstore-files/${key}`); // the private bucket
    expect(link.searchParams.get("X-Amz-Expires")).toBe("600");
    // The Content-Type is signed, so the browser can't send another one.
    expect(link.searchParams.get("X-Amz-SignedHeaders")).toContain(
      "content-type",
    );
    // No checksum of an empty body, which would refuse every real file.
    expect(url).not.toContain("x-amz-checksum");
  });

  it("puts covers and previews in the public bucket", async () => {
    await signIn("ADMIN");
    const beat = await draftBeat();

    const response = await request({
      beatId: beat.beatId,
      kind: "cover",
      contentType: "image/webp",
    });

    const { url } = await response.json();
    expect(new URL(url).pathname).toMatch(/^\/beatstore-previews\/uploads\//);
  });

  it("refuses a type that isn't allowed, and a non-admin", async () => {
    await signIn("ADMIN");
    const beat = await draftBeat();

    const svg = await request({
      beatId: beat.beatId,
      kind: "cover",
      contentType: "image/svg+xml",
    });
    expect(svg.status).toBe(400);

    await signIn("USER");
    await expect(
      request({ beatId: beat.beatId, kind: "wav", contentType: "audio/wav" }),
    ).rejects.toThrow("redirect to /");
  });
});
