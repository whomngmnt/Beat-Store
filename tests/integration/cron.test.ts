// The two cron routes against the real database.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as releaseReservations } from "../../src/app/api/cron/release-reservations/route";
import { GET as retryFulfilment } from "../../src/app/api/cron/fulfilment-retry/route";
import { db } from "../../src/lib/db";
import { createTestBeat, deleteTestBeat } from "./fixtures";

let beat: Awaited<ReturnType<typeof createTestBeat>>;

beforeEach(async () => {
  beat = await createTestBeat();
});

afterEach(async () => {
  await deleteTestBeat(beat.beatId);
});

function cronRequest(authorization?: string) {
  return new Request("http://localhost/api/cron", {
    headers: authorization ? { authorization } : {},
  });
}

describe("cron routes", () => {
  it.each([
    ["no header", undefined],
    ["a wrong secret", "Bearer wrong"],
    ["an empty bearer", "Bearer "],
  ])("refuse a request with %s", async (_label, authorization) => {
    expect((await releaseReservations(cronRequest(authorization))).status).toBe(
      401,
    );
    expect((await retryFulfilment(cronRequest(authorization))).status).toBe(
      401,
    );
  });

  it("release-reservations frees only holds that have run out", async () => {
    const other = await createTestBeat();
    try {
      await db.$executeRaw`
        UPDATE "Beat" SET status = 'RESERVED', "reservedUntil" = now() - interval '1 minute'
        WHERE id = ${beat.beatId}`;
      await db.$executeRaw`
        UPDATE "Beat" SET status = 'RESERVED', "reservedUntil" = now() + interval '10 minutes'
        WHERE id = ${other.beatId}`;

      const response = await releaseReservations(
        cronRequest(`Bearer ${process.env.CRON_SECRET}`),
      );

      expect(response.status).toBe(200);
      const statusOf = async (id: string) =>
        (await db.beat.findUniqueOrThrow({ where: { id } })).status;
      expect(await statusOf(beat.beatId)).toBe("PUBLISHED");
      expect(await statusOf(other.beatId)).toBe("RESERVED");
    } finally {
      await deleteTestBeat(other.beatId);
    }
  });
});
