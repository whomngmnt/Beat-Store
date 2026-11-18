// createCheckoutSession against the real database (PLAN.md §5.2, §5.4).
// Only Stripe is faked: the session it "creates" is a made-up id and URL.
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCheckoutSession } from "../../src/actions/checkout";
import { getCurrentUser } from "../../src/lib/auth-guards"; // faked in setup.ts
import { db } from "../../src/lib/db";
import { hashToken } from "../../src/lib/tokens";
import {
  createTestBeat,
  createTestUser,
  deleteTestBeat,
  deleteTestUser,
  fakeStripeId,
} from "./fixtures";

const { createSession, createStripeCoupon } = vi.hoisted(() => ({
  createSession: vi.fn(),
  createStripeCoupon: vi.fn(),
}));
vi.mock("../../src/lib/stripe", () => ({
  getStripe: () => ({
    checkout: { sessions: { create: createSession } },
    coupons: { create: createStripeCoupon },
  }),
}));

let beat: Awaited<ReturnType<typeof createTestBeat>>;
let userIds: string[];

beforeEach(async () => {
  userIds = [];
  vi.mocked(getCurrentUser).mockResolvedValue(null); // signed out
  createSession.mockReset();
  createSession.mockImplementation(async () => ({
    id: fakeStripeId("cs"),
    url: "https://checkout.stripe.com/c/pay/fake",
  }));
  createStripeCoupon.mockReset();
  createStripeCoupon.mockResolvedValue({ id: "fake_stripe_coupon" });
  beat = await createTestBeat();
});

afterEach(async () => {
  await deleteTestBeat(beat.beatId); // the orders go first
  for (const id of userIds) await deleteTestUser(id);
});

const ordersForBeat = () =>
  db.order.findMany({
    where: { items: { some: { beatId: beat.beatId } } },
    include: { items: true },
  });

describe("createCheckoutSession", () => {
  it("lets exactly 1 of 20 concurrent checkouts reserve an exclusive", async () => {
    const cart = [beat.cartItem("EXCLUSIVE")];

    const results = await Promise.all(
      Array.from({ length: 20 }, () => createCheckoutSession(cart)),
    );

    const winners = results.filter((result) => "url" in result);
    // A loser that read the cart before the winner committed fails the
    // reservation ("just taken"). One that read it after sees a RESERVED
    // beat and is refused earlier ("can't be bought right now"). Which one
    // depends on timing; both are correct refusals.
    const refused = results.filter(
      (result) =>
        "error" in result &&
        /just taken|can't be bought right now/.test(result.error),
    );
    expect(winners).toHaveLength(1);
    expect(refused).toHaveLength(19);
    expect(createSession).toHaveBeenCalledTimes(1);

    // The 19 losers rolled back, so only the winner's order exists, and it
    // holds the beat.
    const orders = await ordersForBeat();
    expect(orders).toHaveLength(1);
    const saved = await db.beat.findUniqueOrThrow({
      where: { id: beat.beatId },
    });
    expect(saved.status).toBe("RESERVED");
    expect(saved.reservedByOrderId).toBe(orders[0].id);
    expect(orders[0].status).toBe("PENDING");
    expect(orders[0].stripeSessionId).toMatch(/^cs_test_/);
  });

  it("charges the database price, not one sent by the browser", async () => {
    const result = await createCheckoutSession([
      { ...beat.cartItem("PREMIUM"), priceCents: 1 },
    ]);
    expect(result).toHaveProperty("url");

    const price = beat.tier("PREMIUM").defaultPriceCents;
    const [order] = await ordersForBeat();
    expect(order.totalCents).toBe(price);
    expect(order.items[0].priceCents).toBe(price);

    const params = createSession.mock.calls[0][0];
    expect(params.line_items[0].price_data.unit_amount).toBe(price);
    expect(params.metadata).toEqual({ orderId: order.id });
    // At least 30 minutes, as Stripe requires.
    const minutes = (params.expires_at - Date.now() / 1000) / 60;
    expect(minutes).toBeGreaterThan(30);
    expect(minutes).toBeLessThanOrEqual(31);
    // A lease doesn't reserve the beat.
    const saved = await db.beat.findUniqueOrThrow({
      where: { id: beat.beatId },
    });
    expect(saved.status).toBe("PUBLISHED");
  });

  it("stores only the token's hash and puts the raw token in the success URL", async () => {
    await createCheckoutSession([beat.cartItem("BASIC")]);

    const [order] = await ordersForBeat();
    const successUrl = new URL(createSession.mock.calls[0][0].success_url);
    const token = successUrl.searchParams.get("token")!;
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    // Stripe fills in the session id when it sends the buyer back.
    expect(successUrl.searchParams.get("session_id")).toBe(
      "{CHECKOUT_SESSION_ID}",
    );
    expect(order.downloadTokenHash).toBe(hashToken(token));
    expect(order.downloadTokenHash).not.toContain(token);
    const days =
      (order.downloadTokenExpiresAt!.getTime() - Date.now()) /
      (24 * 60 * 60 * 1000);
    expect(days).toBeGreaterThan(29.99);
    expect(days).toBeLessThanOrEqual(30);
  });

  it("gives a signed-in buyer's order their user id and email; a guest's gets neither", async () => {
    const result = await createCheckoutSession([beat.cartItem("BASIC")]);
    expect(result).toHaveProperty("url");
    expect(createSession.mock.calls[0][0]).not.toHaveProperty("customer_email");

    const user = await createTestUser(true);
    userIds.push(user.id);
    vi.mocked(getCurrentUser).mockResolvedValue(user);
    await createCheckoutSession([beat.cartItem("PREMIUM")]);
    expect(createSession.mock.calls[1][0].customer_email).toBe(user.email);

    const orders = await ordersForBeat();
    expect(orders.map((order) => order.userId).sort()).toEqual(
      [null, user.id].sort(),
    );
  });

  it("frees the exclusive and marks the order FAILED when Stripe fails", async () => {
    createSession.mockRejectedValueOnce(new Error("Stripe is down"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await createCheckoutSession([beat.cartItem("EXCLUSIVE")]);

    expect(result).toEqual({
      error: "Couldn't start checkout. Please try again.",
    });
    const [order] = await ordersForBeat();
    expect(order.status).toBe("FAILED");
    const saved = await db.beat.findUniqueOrThrow({
      where: { id: beat.beatId },
    });
    expect(saved.status).toBe("PUBLISHED");
    expect(saved.reservedByOrderId).toBeNull();
  });

  it("refuses a cart with a line that can't be bought", async () => {
    await db.beat.update({
      where: { id: beat.beatId },
      data: { status: "SOLD" },
    });

    const result = await createCheckoutSession([beat.cartItem("BASIC")]);

    expect(result).toHaveProperty("error");
    expect(await ordersForBeat()).toHaveLength(0);
    expect(createSession).not.toHaveBeenCalled();
  });

  it("refuses an empty or invalid cart", async () => {
    expect(await createCheckoutSession([])).toHaveProperty("error");
    expect(await createCheckoutSession("not a cart")).toHaveProperty("error");
    expect(createSession).not.toHaveBeenCalled();
  });
});

describe("coupons at checkout", () => {
  let couponIds: string[];
  let otherBeatIds: string[];

  beforeEach(() => {
    couponIds = [];
    otherBeatIds = [];
  });

  afterEach(async () => {
    // Orders point at their coupon. The beats' cleanup deletes the orders.
    await db.order.updateMany({
      where: { couponId: { in: couponIds } },
      data: { couponId: null },
    });
    await db.coupon.deleteMany({ where: { id: { in: couponIds } } });
    for (const id of otherBeatIds) await deleteTestBeat(id);
  });

  async function testCoupon(data: {
    percentOff?: number;
    amountOffCents?: number;
    active?: boolean;
    expiresAt?: Date;
  }) {
    const coupon = await db.coupon.create({
      data: { code: `TEST-${randomUUID().slice(0, 8).toUpperCase()}`, ...data },
    });
    couponIds.push(coupon.id);
    return coupon;
  }

  it("takes the discount off the total and gives Stripe exactly that discount", async () => {
    const coupon = await testCoupon({ percentOff: 15 });

    // Typed in lower case: codes are matched in capitals.
    const result = await createCheckoutSession(
      [beat.cartItem("PREMIUM")],
      coupon.code.toLowerCase(),
    );

    expect(result).toHaveProperty("url");
    const price = beat.tier("PREMIUM").defaultPriceCents;
    const discount = Math.floor((price * 15) / 100); // rounded down
    const [order] = await ordersForBeat();
    expect(order.couponId).toBe(coupon.id);
    expect(order.totalCents).toBe(price - discount);
    expect(order.items[0].priceCents).toBe(price); // the item keeps its price
    expect(createStripeCoupon).toHaveBeenCalledWith(
      {
        amount_off: discount,
        currency: "usd",
        duration: "once",
        max_redemptions: 1,
        name: coupon.code,
      },
      { idempotencyKey: `coupon-${order.id}` },
    );
    expect(createSession.mock.calls[0][0].discounts).toEqual([
      { coupon: "fake_stripe_coupon" },
    ]);
  });

  it("takes nothing off an Exclusive in the same cart", async () => {
    const other = await createTestBeat();
    otherBeatIds.push(other.beatId);
    const coupon = await testCoupon({ amountOffCents: 100_000 }); // $1,000 off

    const result = await createCheckoutSession(
      [beat.cartItem("EXCLUSIVE"), other.cartItem("BASIC")],
      coupon.code,
    );

    expect(result).toHaveProperty("url");
    const [order] = await ordersForBeat();
    // The whole lease is free, the exclusive costs its full price.
    expect(order.totalCents).toBe(beat.tier("EXCLUSIVE").defaultPriceCents);
    expect(createStripeCoupon.mock.calls[0][0].amount_off).toBe(
      other.tier("BASIC").defaultPriceCents,
    );
  });

  it("refuses a coupon on a cart with only an Exclusive", async () => {
    const coupon = await testCoupon({ percentOff: 10 });

    const result = await createCheckoutSession(
      [beat.cartItem("EXCLUSIVE")],
      coupon.code,
    );

    expect(result).toEqual({
      error: "Coupons don't apply to Exclusive licenses.",
    });
    expect(await ordersForBeat()).toHaveLength(0);
    expect(createSession).not.toHaveBeenCalled();
  });

  it("refuses an unknown, turned-off or expired code before making an order", async () => {
    const off = await testCoupon({ percentOff: 10, active: false });
    const expired = await testCoupon({
      percentOff: 10,
      expiresAt: new Date(Date.now() - 1000),
    });

    for (const code of [
      "NOT-A-REAL-CODE",
      off.code,
      expired.code,
      "<b>x</b>",
    ]) {
      const result = await createCheckoutSession(
        [beat.cartItem("BASIC")],
        code,
      );
      expect(result).toHaveProperty("error");
      expect((result as { error: string }).error).toMatch(/isn't valid/);
    }
    expect(await ordersForBeat()).toHaveLength(0);
    expect(createStripeCoupon).not.toHaveBeenCalled();
  });

  it("refuses a total under Stripe's $0.50 minimum", async () => {
    const coupon = await testCoupon({ percentOff: 100 });

    const result = await createCheckoutSession(
      [beat.cartItem("BASIC")],
      coupon.code,
    );

    expect((result as { error: string }).error).toMatch(/under \$0\.50/);
    expect(await ordersForBeat()).toHaveLength(0);
  });

  it("treats an empty code as no coupon", async () => {
    const result = await createCheckoutSession([beat.cartItem("BASIC")], "  ");

    expect(result).toHaveProperty("url");
    const [order] = await ordersForBeat();
    expect(order.couponId).toBeNull();
    expect(order.totalCents).toBe(beat.tier("BASIC").defaultPriceCents);
    expect(createStripeCoupon).not.toHaveBeenCalled();
    expect(createSession.mock.calls[0][0]).not.toHaveProperty("discounts");
  });
});
