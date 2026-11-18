// The rest of the admin panel against the real database: license tier
// templates (src/actions/licenses.ts), coupons (src/actions/coupons.ts)
// and the dashboard numbers (src/lib/dashboard.ts).
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createCoupon,
  deleteCoupon,
  setCouponActive,
} from "../../src/actions/coupons";
import { updateLicenseTier } from "../../src/actions/licenses";
import type { LicenseTier } from "../../src/generated/prisma/client";
import { getCurrentUser } from "../../src/lib/auth-guards"; // faked in setup.ts
import { getDashboard } from "../../src/lib/dashboard";
import { db } from "../../src/lib/db";
import {
  createTestBeat,
  createTestUser,
  deleteTestBeat,
  deleteTestUser,
  fakeStripeId,
} from "./fixtures";

// refresh() only works inside a real Next request.
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

let userIds: string[];

beforeEach(() => {
  vi.mocked(getCurrentUser).mockResolvedValue(null); // signed out
  userIds = [];
});

afterEach(async () => {
  for (const id of userIds) await deleteTestUser(id);
});

async function signIn(role: "USER" | "ADMIN") {
  const user = await createTestUser(true);
  userIds.push(user.id);
  vi.mocked(getCurrentUser).mockResolvedValue(
    await db.user.update({ where: { id: user.id }, data: { role } }),
  );
}

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

describe("license tier editor", () => {
  let basic: LicenseTier;

  beforeEach(async () => {
    basic = await db.licenseTier.findUniqueOrThrow({
      where: { code: "BASIC" },
    });
  });

  afterEach(async () => {
    // Put the seeded tier back for the other tests.
    const { id, ...original } = basic;
    await db.licenseTier.update({ where: { id }, data: original });
  });

  const fields = (changes: Record<string, string> = {}) =>
    form({
      tierId: basic.id,
      name: "Basic Lease v2",
      description: "MP3 only",
      defaultPrice: "24.50",
      streamLimit: "",
      videoLimit: "2",
      terms: "New terms.",
      ...changes,
    });

  it("refuses a signed-out visitor and a non-admin", async () => {
    await expect(updateLicenseTier(undefined, fields())).rejects.toThrow(
      "redirect to /sign-in",
    );
    await signIn("USER");
    await expect(updateLicenseTier(undefined, fields())).rejects.toThrow(
      "redirect to /",
    );
  });

  it("saves the template, with the price in cents and empty as unlimited", async () => {
    await signIn("ADMIN");

    expect(await updateLicenseTier(undefined, fields())).toEqual({
      ok: true,
      message: "Saved.",
    });

    const saved = await db.licenseTier.findUniqueOrThrow({
      where: { id: basic.id },
    });
    expect(saved).toMatchObject({
      name: "Basic Lease v2",
      defaultPriceCents: 2450,
      streamLimit: null,
      videoLimit: 2,
      terms: "New terms.",
      // Not editable here.
      code: "BASIC",
      includesMp3: basic.includesMp3,
      includesWav: basic.includesWav,
    });
  });

  it("changes nothing when a field is wrong", async () => {
    await signIn("ADMIN");

    const result = await updateLicenseTier(
      undefined,
      fields({ defaultPrice: "0.10" }),
    );

    expect(result.ok).toBe(false);
    expect(result.fieldErrors?.defaultPrice).toBeDefined();
    const saved = await db.licenseTier.findUniqueOrThrow({
      where: { id: basic.id },
    });
    expect(saved.name).toBe(basic.name);
  });
});

describe("coupon admin", () => {
  let code: string;

  beforeEach(() => {
    code = `test-${randomUUID().slice(0, 8)}`;
  });

  afterEach(async () => {
    await db.coupon.deleteMany({ where: { code: code.toUpperCase() } });
  });

  const newCoupon = () =>
    form({ code, percentOff: "15", amountOff: "", expiresOn: "" });
  const saved = () =>
    db.coupon.findUnique({ where: { code: code.toUpperCase() } });

  it("refuses a signed-out visitor and a non-admin", async () => {
    const calls = [
      () => createCoupon(undefined, newCoupon()),
      () => setCouponActive(form({ couponId: randomUUID(), active: "false" })),
      () => deleteCoupon(form({ couponId: randomUUID() })),
    ];
    for (const call of calls) {
      await expect(call()).rejects.toThrow("redirect to /sign-in");
    }
    await signIn("USER");
    for (const call of calls) {
      await expect(call()).rejects.toThrow("redirect to /");
    }
    expect(await saved()).toBeNull();
  });

  it("creates a coupon in capitals and refuses the same code twice", async () => {
    await signIn("ADMIN");

    expect((await createCoupon(undefined, newCoupon())).ok).toBe(true);
    expect(await saved()).toMatchObject({
      code: code.toUpperCase(),
      percentOff: 15,
      amountOffCents: null,
      active: true,
      expiresAt: null,
    });

    const again = await createCoupon(undefined, newCoupon());
    expect(again.fieldErrors?.code).toEqual(["This code already exists."]);
  });

  it("turns a coupon off and on", async () => {
    await signIn("ADMIN");
    await createCoupon(undefined, newCoupon());
    const coupon = (await saved())!;

    await setCouponActive(form({ couponId: coupon.id, active: "false" }));
    expect((await saved())?.active).toBe(false);
    await setCouponActive(form({ couponId: coupon.id, active: "true" }));
    expect((await saved())?.active).toBe(true);
  });

  it("deletes a coupon only while no order uses it", async () => {
    await signIn("ADMIN");
    await createCoupon(undefined, newCoupon());
    const coupon = (await saved())!;
    const order = await db.order.create({
      data: { totalCents: 1000, couponId: coupon.id },
    });

    await deleteCoupon(form({ couponId: coupon.id }));
    expect(await saved()).not.toBeNull();

    await db.order.delete({ where: { id: order.id } });
    await deleteCoupon(form({ couponId: coupon.id }));
    expect(await saved()).toBeNull();
  });
});

describe("dashboard numbers", () => {
  let beat: Awaited<ReturnType<typeof createTestBeat>>;

  beforeEach(async () => {
    beat = await createTestBeat();
  });

  afterEach(async () => {
    await deleteTestBeat(beat.beatId); // the orders go first
  });

  // Prices far above any real one, so this beat tops the lists.
  const PRICE = 10_000_000;

  async function order(
    status: "PAID" | "PENDING" | "REFUNDED",
    refundedExclusive = false,
  ) {
    const item = (code: "PREMIUM" | "EXCLUSIVE", refundedAt: Date | null) => ({
      beatId: beat.beatId,
      licenseTierId: beat.tier(code).id,
      priceCents: PRICE,
      beatTitleSnapshot: "Integration test beat",
      licenseNameSnapshot: beat.tier(code).name,
      refundedAt,
    });
    await db.order.create({
      data: {
        status,
        stripeSessionId: fakeStripeId("cs"),
        paidAt: status === "PENDING" ? null : new Date(),
        totalCents: refundedExclusive ? 2 * PRICE : PRICE,
        items: {
          create: refundedExclusive
            ? [item("PREMIUM", null), item("EXCLUSIVE", new Date())]
            : [item("PREMIUM", null)],
        },
      },
    });
  }

  it("count paid orders, minus refunded items, and nothing else", async () => {
    const before = await getDashboard();

    await order("PAID");
    await order("PAID", true); // its exclusive was refunded: counts PRICE
    await order("REFUNDED");
    await order("PENDING");
    await db.beat.update({
      where: { id: beat.beatId },
      data: { plays: 1_000_000 },
    });

    const after = await getDashboard();
    expect(after.revenueCents - before.revenueCents).toBe(2 * PRICE);
    expect(after.paidOrders - before.paidOrders).toBe(2);
    expect(after.plays - before.plays).toBe(1_000_000);
    const today = (stats: typeof before) => stats.revenueByDay.at(-1)!.cents;
    expect(today(after) - today(before)).toBe(2 * PRICE);
    expect(after.revenueByDay).toHaveLength(30);
    expect(after.topSales[0]).toMatchObject({
      id: beat.beatId,
      cents: 2 * PRICE,
      sold: 2,
    });
    expect(after.topPlays[0]).toMatchObject({
      id: beat.beatId,
      plays: 1_000_000,
    });
  });
});
