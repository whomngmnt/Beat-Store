// The download route and the admin download fixes against the real
// database (PLAN.md §5.1, .claude/rules/downloads.md). Storage is never
// reached: signing a link is offline (fake S3 settings in setup.ts).
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET } from "../../src/app/api/download/[orderItemId]/[fileType]/route";
import type { FileType, LicenseCode } from "../../src/generated/prisma/client";
import { db } from "../../src/lib/db";
import {
  reissueDownloadToken,
  resetDownloadCount,
} from "../../src/lib/downloads";
import { createDownloadToken } from "../../src/lib/tokens";
import { createTestBeat, deleteTestBeat, fakeStripeId } from "./fixtures";

let beat: Awaited<ReturnType<typeof createTestBeat>>;

beforeEach(async () => {
  beat = await createTestBeat();
  // The full MP3 and WAV are uploaded; the stems aren't.
  await db.beat.update({
    where: { id: beat.beatId },
    data: {
      mp3Key: `uploads/${beat.beatId}/full.mp3`,
      wavKey: `uploads/${beat.beatId}/full.wav`,
    },
  });
});

afterEach(async () => {
  await deleteTestBeat(beat.beatId);
});

// A PAID order for this beat with the Download rows fulfilment would make,
// and its raw guest token.
async function paidOrder(code: LicenseCode = "TRACKOUT") {
  const tier = beat.tier(code);
  const { token, hash, expiresAt } = createDownloadToken();
  const fileTypes: FileType[] = [];
  if (tier.includesMp3) fileTypes.push("MP3");
  if (tier.includesWav) fileTypes.push("WAV");
  if (tier.includesStems) fileTypes.push("STEMS");

  const order = await db.order.create({
    data: {
      status: "PAID",
      totalCents: tier.defaultPriceCents,
      stripeSessionId: fakeStripeId("cs"),
      downloadTokenHash: hash,
      downloadTokenExpiresAt: expiresAt,
      items: {
        create: {
          beatId: beat.beatId,
          licenseTierId: tier.id,
          priceCents: tier.defaultPriceCents,
          beatTitleSnapshot: "Integration test beat",
          licenseNameSnapshot: tier.name,
          downloads: {
            create: fileTypes.map((fileType) => ({ fileType })),
          },
        },
      },
    },
    include: { items: { include: { downloads: true } } },
  });
  return { order, item: order.items[0], token };
}

function download(orderItemId: string, fileType: string, token?: string) {
  const query = token === undefined ? "" : `?token=${token}`;
  return GET(
    new Request(
      `http://localhost:3000/api/download/${orderItemId}/${fileType}${query}`,
    ),
    { params: Promise.resolve({ orderItemId, fileType }) },
  );
}

const countOf = async (orderItemId: string, fileType: "MP3" | "WAV") =>
  (
    await db.download.findUniqueOrThrow({
      where: { orderItemId_fileType: { orderItemId, fileType } },
    })
  ).count;

describe("GET /api/download/[orderItemId]/[fileType]", () => {
  it("counts the download and redirects to a 10-minute signed link", async () => {
    const { item, token } = await paidOrder();

    const response = await download(item.id, "WAV", token);

    expect(response.status).toBe(302);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const url = new URL(response.headers.get("location")!);
    expect(url.hostname).toBe("fake-account.r2.cloudflarestorage.com");
    expect(url.pathname).toBe(
      `/beatstore-files/uploads/${beat.beatId}/full.wav`,
    );
    expect(url.searchParams.get("X-Amz-Expires")).toBe("600");
    expect(url.searchParams.get("response-content-disposition")).toMatch(
      /^attachment; filename="test-[0-9a-f-]+\.wav"$/,
    );
    const saved = await db.download.findUniqueOrThrow({
      where: {
        orderItemId_fileType: { orderItemId: item.id, fileType: "WAV" },
      },
    });
    expect(saved.count).toBe(1);
    expect(saved.lastAt).not.toBeNull();
  });

  it("refuses a missing, malformed or wrong token with 403", async () => {
    const { item } = await paidOrder();
    const wrong = createDownloadToken().token;

    for (const token of [undefined, "", "not-a-token", wrong]) {
      expect((await download(item.id, "MP3", token)).status).toBe(403);
    }
    expect(await countOf(item.id, "MP3")).toBe(0);
  });

  it("refuses someone else's order: a valid token works only for its own order", async () => {
    const mine = await paidOrder();
    const theirs = await paidOrder();

    const response = await download(theirs.item.id, "MP3", mine.token);

    expect(response.status).toBe(403);
    expect(await countOf(theirs.item.id, "MP3")).toBe(0);
  });

  it("refuses an expired token with 403", async () => {
    const { order, item, token } = await paidOrder();
    await db.order.update({
      where: { id: order.id },
      data: { downloadTokenExpiresAt: new Date(Date.now() - 1000) },
    });

    expect((await download(item.id, "MP3", token)).status).toBe(403);
  });

  it("gives an unknown item the same 403 as a wrong token", async () => {
    const { token } = await paidOrder();
    const unknownId = "00000000-0000-4000-8000-000000000000";

    expect((await download(unknownId, "MP3", token)).status).toBe(403);
  });

  it.each(["REFUNDED", "PENDING", "EXPIRED"] as const)(
    "refuses a %s order with 403",
    async (status) => {
      const { order, item, token } = await paidOrder();
      await db.order.update({ where: { id: order.id }, data: { status } });

      expect((await download(item.id, "MP3", token)).status).toBe(403);
      expect(await countOf(item.id, "MP3")).toBe(0);
    },
  );

  it("refuses a lost exclusive (refunded item) with 403", async () => {
    const { item, token } = await paidOrder("EXCLUSIVE");
    await db.orderItem.update({
      where: { id: item.id },
      data: { refundNeeded: true },
    });

    expect((await download(item.id, "MP3", token)).status).toBe(403);
  });

  it("gives 404 for a file the license doesn't include", async () => {
    const { item, token } = await paidOrder("BASIC"); // MP3 only

    expect((await download(item.id, "WAV", token)).status).toBe(404);
  });

  it("gives 404 without using a download when the file isn't uploaded", async () => {
    const { item, token } = await paidOrder("TRACKOUT"); // includes stems
    const before = await db.download.findUniqueOrThrow({
      where: {
        orderItemId_fileType: { orderItemId: item.id, fileType: "STEMS" },
      },
    });

    const response = await download(item.id, "STEMS", token);

    expect(response.status).toBe(404);
    const after = await db.download.findUniqueOrThrow({
      where: { id: before.id },
    });
    expect(after.count).toBe(0);
  });

  it("doesn't use a download when signing the link fails", async () => {
    const { item, token } = await paidOrder();
    const bucket = process.env.S3_PRIVATE_BUCKET;
    delete process.env.S3_PRIVATE_BUCKET; // storage not configured
    try {
      await expect(download(item.id, "MP3", token)).rejects.toThrow(
        /S3_PRIVATE_BUCKET/,
      );
    } finally {
      process.env.S3_PRIVATE_BUCKET = bucket;
    }
    expect(await countOf(item.id, "MP3")).toBe(0);
  });

  it("gives 404 for bad params", async () => {
    const { item, token } = await paidOrder();

    expect((await download(item.id, "mp3", token)).status).toBe(404);
    expect((await download(item.id, "../../.env", token)).status).toBe(404);
    expect((await download("1", "MP3", token)).status).toBe(404);
  });

  it("allows 5 downloads of a file and answers the 6th with 429", async () => {
    const { item, token } = await paidOrder();

    for (let i = 0; i < 5; i++) {
      expect((await download(item.id, "MP3", token)).status).toBe(302);
    }
    const sixth = await download(item.id, "MP3", token);

    expect(sixth.status).toBe(429);
    expect(await sixth.text()).toMatch(/limit reached/);
    expect(await countOf(item.id, "MP3")).toBe(5);
    // Each file has its own limit.
    expect((await download(item.id, "WAV", token)).status).toBe(302);
  });

  it("lets only 1 of 5 simultaneous requests take the last download", async () => {
    const { item, token } = await paidOrder();
    await db.download.update({
      where: {
        orderItemId_fileType: { orderItemId: item.id, fileType: "MP3" },
      },
      data: { count: 4 },
    });

    const responses = await Promise.all(
      Array.from({ length: 5 }, () => download(item.id, "MP3", token)),
    );

    const statuses = responses.map((response) => response.status).sort();
    expect(statuses).toEqual([302, 429, 429, 429, 429]);
    expect(await countOf(item.id, "MP3")).toBe(5);
  });
});

describe("admin download fixes", () => {
  it("resetDownloadCount gives the buyer their downloads back", async () => {
    const { item, token } = await paidOrder();
    const mp3 = item.downloads.find((d) => d.fileType === "MP3")!;
    await db.download.update({ where: { id: mp3.id }, data: { count: 5 } });
    expect((await download(item.id, "MP3", token)).status).toBe(429);

    expect(await resetDownloadCount(mp3.id)).toBe(true);

    expect((await download(item.id, "MP3", token)).status).toBe(302);
    expect(
      await resetDownloadCount("00000000-0000-4000-8000-000000000000"),
    ).toBe(false);
  });

  it("reissueDownloadToken turns the old link off and returns a working new one", async () => {
    const { order, item, token: oldToken } = await paidOrder();

    const link = await reissueDownloadToken(order.id);

    const url = new URL(link!);
    expect(url.pathname).toBe("/checkout/success");
    expect(url.searchParams.get("session_id")).toBe(order.stripeSessionId);
    const newToken = url.searchParams.get("token")!;
    expect(newToken).not.toBe(oldToken);
    expect((await download(item.id, "MP3", oldToken)).status).toBe(403);
    expect((await download(item.id, "MP3", newToken)).status).toBe(302);
  });

  it("reissueDownloadToken returns null for an order that never reached Stripe", async () => {
    const { order } = await paidOrder();
    await db.order.update({
      where: { id: order.id },
      data: { stripeSessionId: null },
    });

    expect(await reissueDownloadToken(order.id)).toBeNull();
  });
});
