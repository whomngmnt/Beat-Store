// Which orders belong to a signed-in user (src/lib/account.ts), against the
// real database. PLAN.md §10, item 12: an unverified email that matches a
// guest order must not see that order.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { OrderStatus } from "../../src/generated/prisma/client";
import { getAccountOrders, userOwnsOrder } from "../../src/lib/account";
import { db } from "../../src/lib/db";
import {
  createTestBeat,
  createTestUser,
  deleteTestBeat,
  deleteTestUser,
} from "./fixtures";

let beat: Awaited<ReturnType<typeof createTestBeat>>;
let userIds: string[];

beforeEach(async () => {
  beat = await createTestBeat();
  userIds = [];
});

afterEach(async () => {
  await deleteTestBeat(beat.beatId); // the orders go first
  for (const id of userIds) await deleteTestUser(id);
});

async function user(emailVerified: boolean) {
  const created = await createTestUser(emailVerified);
  userIds.push(created.id);
  return created;
}

// An order for the test beat, made by a signed-in user (userId) or by a
// guest who typed `email` in Stripe Checkout.
async function order(
  owner: { userId?: string; email?: string },
  status: OrderStatus = "PAID",
) {
  const tier = beat.tier("BASIC");
  return db.order.create({
    data: {
      ...owner,
      status,
      totalCents: tier.defaultPriceCents,
      items: {
        create: {
          beatId: beat.beatId,
          licenseTierId: tier.id,
          priceCents: tier.defaultPriceCents,
          beatTitleSnapshot: "Integration test beat",
          licenseNameSnapshot: tier.name,
          downloads: { create: { fileType: "MP3" } },
        },
      },
    },
    select: { id: true },
  });
}

const listedIds = async (u: Awaited<ReturnType<typeof user>>) =>
  (await getAccountOrders(u)).map((o) => o.id);

describe("orders of a signed-in user", () => {
  it("includes orders made while signed in, not other users' orders", async () => {
    const me = await user(true);
    const other = await user(true);
    const mine = await order({ userId: me.id });
    const theirs = await order({ userId: other.id });

    expect(await userOwnsOrder(me, mine.id)).toBe(true);
    expect(await userOwnsOrder(me, theirs.id)).toBe(false);
    expect(await listedIds(me)).toEqual([mine.id]);
  });

  it("includes a guest order with the same email when the email is verified, in any case", async () => {
    const me = await user(true);
    const guest = await order({ email: me.email.toUpperCase() });

    expect(await userOwnsOrder(me, guest.id)).toBe(true);
    expect(await listedIds(me)).toEqual([guest.id]);
  });

  it("leaves out a guest order with the same email when the email isn't verified", async () => {
    const me = await user(false);
    const guest = await order({ email: me.email });

    expect(await userOwnsOrder(me, guest.id)).toBe(false);
    expect(await listedIds(me)).toEqual([]);
  });

  it("leaves out another user's order even when its email matches", async () => {
    const me = await user(true);
    const other = await user(true);
    const theirs = await order({ userId: other.id, email: me.email });

    expect(await userOwnsOrder(me, theirs.id)).toBe(false);
  });

  it("lists paid and refunded orders only", async () => {
    const me = await user(true);
    const paid = await order({ userId: me.id }, "PAID");
    const refunded = await order({ userId: me.id }, "REFUNDED");
    for (const status of ["PENDING", "EXPIRED", "FAILED"] as const) {
      await order({ userId: me.id }, status);
    }

    expect((await listedIds(me)).sort()).toEqual([paid.id, refunded.id].sort());
  });
});
