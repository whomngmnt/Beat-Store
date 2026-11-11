// Test data for the integration tests. Each test makes its own beat, so
// tests never touch the seeded beats or each other's rows.
import { randomUUID } from "node:crypto";
import type { LicenseCode } from "../../src/generated/prisma/client";
import { db } from "../../src/lib/db";

// A PUBLISHED beat with all 4 tiers at their default prices. Needs the
// seeded license tiers (`pnpm db:seed`).
export async function createTestBeat() {
  const tiers = await db.licenseTier.findMany();
  if (tiers.length !== 4) throw new Error("Run `pnpm db:seed` first");

  const beat = await db.beat.create({
    data: {
      slug: `test-${randomUUID()}`,
      title: "Integration test beat",
      bpm: 140,
      musicalKey: "C minor",
      genre: "Test",
      mood: "Test",
      status: "PUBLISHED",
      licenses: {
        create: tiers.map((tier) => ({
          licenseTierId: tier.id,
          priceCents: tier.defaultPriceCents,
        })),
      },
    },
    select: { id: true },
  });

  const tier = (code: LicenseCode) => {
    const found = tiers.find((t) => t.code === code);
    if (!found) throw new Error(`No ${code} tier`);
    return found;
  };
  // The cart item for this beat in one tier.
  const cartItem = (code: LicenseCode) => ({
    beatId: beat.id,
    licenseTierId: tier(code).id,
  });
  return { beatId: beat.id, tier, cartItem };
}

// Deletes a test beat and every order, item and download made for it.
export async function deleteTestBeat(beatId: string) {
  const orders = await db.order.findMany({
    where: { items: { some: { beatId } } },
    select: { id: true },
  });
  const orderIds = orders.map((order) => order.id);

  await db.beat.update({
    where: { id: beatId },
    data: { reservedByOrderId: null },
  });
  await db.download.deleteMany({
    where: { orderItem: { orderId: { in: orderIds } } },
  });
  await db.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
  await db.order.deleteMany({ where: { id: { in: orderIds } } });
  await db.beatLicense.deleteMany({ where: { beatId } });
  await db.beat.delete({ where: { id: beatId } });
}

// A fake Stripe id, such as a Checkout Session id "cs_test_…".
export function fakeStripeId(prefix: string) {
  return `${prefix}_test_${randomUUID().replaceAll("-", "")}`;
}
