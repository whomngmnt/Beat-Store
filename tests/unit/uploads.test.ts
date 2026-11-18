// The upload rules in src/lib/uploads.ts that need no storage: keys, magic
// bytes and what a beat needs before it can be published. checkUpload()
// itself is tested in tests/integration/admin-beats.test.ts.
import { describe, expect, it } from "vitest";
import {
  extensionFor,
  isUploadKey,
  looksLike,
  newUploadKey,
  publishProblems,
} from "../../src/lib/uploads";

const BEAT = "6f1c2a4e-8b3d-4e5f-9a7b-1c2d3e4f5a6b";

// The first bytes of a real file of each kind.
const bytes = (...values: (number | string)[]) =>
  new Uint8Array(
    values.flatMap((v) =>
      typeof v === "string" ? [...v].map((c) => c.charCodeAt(0)) : [v],
    ),
  );
const PNG = bytes(0x89, "PNG\r\n", 0x1a, "\n");
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0);
const WEBP = bytes("RIFF", 0, 0, 0, 0, "WEBP");
const ID3 = bytes("ID3", 4, 0);
const MPEG_FRAME = bytes(0xff, 0xfb, 0x90, 0x64);
const WAV = bytes("RIFF", 0, 0, 0, 0, "WAVE");
const ZIP = bytes("PK", 3, 4);
const HTML = bytes("<html><script>");

describe("upload keys", () => {
  it("are picked by the server under uploads/<beatId>/", () => {
    const key = newUploadKey(BEAT, "wav");
    expect(key).toMatch(new RegExp(`^uploads/${BEAT}/[0-9a-f-]{36}\\.wav$`));
    expect(isUploadKey(key, BEAT, "wav")).toBe(true);
  });

  it("can't point at another beat, another kind or another folder", () => {
    const key = newUploadKey(BEAT, "wav");
    expect(
      isUploadKey(key, "11111111-1111-4111-8111-111111111111", "wav"),
    ).toBe(false);
    expect(isUploadKey(key, BEAT, "mp3")).toBe(false);
    expect(isUploadKey(`previews/${BEAT}.wav`, BEAT, "wav")).toBe(false);
    expect(isUploadKey(`uploads/${BEAT}/../x.wav`, BEAT, "wav")).toBe(false);
  });

  it("get their extension from an allowed Content-Type only", () => {
    expect(extensionFor("cover", "image/jpeg")).toBe("jpg");
    expect(extensionFor("stems", "application/x-zip-compressed")).toBe("zip");
    expect(extensionFor("wav", "audio/mpeg")).toBeNull();
    expect(extensionFor("cover", "image/svg+xml")).toBeNull();
    expect(extensionFor("mp3", "text/html")).toBeNull();
  });
});

describe("looksLike (magic bytes)", () => {
  it("knows each kind of file by its first bytes", () => {
    for (const image of [PNG, JPEG, WEBP])
      expect(looksLike("cover", image)).toBe(true);
    for (const mp3 of [ID3, MPEG_FRAME]) {
      expect(looksLike("preview", mp3)).toBe(true);
      expect(looksLike("mp3", mp3)).toBe(true);
    }
    expect(looksLike("wav", WAV)).toBe(true);
    expect(looksLike("stems", ZIP)).toBe(true);
  });

  it("refuses a file that's something else, whatever its name says", () => {
    expect(looksLike("cover", HTML)).toBe(false);
    expect(looksLike("mp3", WAV)).toBe(false);
    expect(looksLike("wav", WEBP)).toBe(false); // RIFF, but not WAVE
    expect(looksLike("stems", PNG)).toBe(false);
    expect(looksLike("preview", new Uint8Array())).toBe(false);
  });
});

describe("publishProblems", () => {
  const tier = (name: string, mp3: boolean, wav: boolean, stems: boolean) => ({
    name,
    includesMp3: mp3,
    includesWav: wav,
    includesStems: stems,
  });
  const licenses = [
    { active: true, licenseTier: tier("Basic Lease", true, false, false) },
    { active: true, licenseTier: tier("Premium Lease", true, true, false) },
    { active: false, licenseTier: tier("Trackout / Stems", true, true, true) },
  ];
  const allFiles = {
    previewKey: "p",
    mp3Key: "m",
    wavKey: "w",
    stemsKey: null,
  };

  it("lets a beat with every file its active licenses need be published", () => {
    expect(publishProblems(allFiles, licenses)).toEqual([]);
  });

  it("asks for the preview and each missing file an active license needs", () => {
    const problems = publishProblems(
      { previewKey: null, mp3Key: "m", wavKey: null, stemsKey: null },
      licenses,
    );
    expect(problems).toEqual([
      "Upload a preview MP3.",
      "Upload the WAV, or turn off Premium Lease.",
    ]);
  });

  it("needs at least one active license", () => {
    const off = licenses.map((license) => ({ ...license, active: false }));
    expect(publishProblems(allFiles, off)).toEqual([
      "Turn on at least one license.",
    ]);
  });
});
