// createCheckoutSession against the real database (PLAN.md §5.2, §5.4).
// Only Stripe is faked: the session it "creates" is a made-up id and URL.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCheckoutSession } from "../../src/actions/checkout";
import { db } from "../../src/lib/db";
import { hashToken } from "../../src/lib/tokens";
import { createTestBeat, deleteTestBeat, fakeStripeId } from "./fixtures";

const { createSession } = vi.hoisted(() => ({ createSession: vi.fn() }));
vi.mock("../../src/lib/stripe", () => ({
  getStripe: () => ({ checkout: { sessions: { create: createSession } } }),
}));

let beat: Awaited<ReturnType<typeof createTestBeat>>;

beforeEach(async () => {
  createSession.mockReset();
  createSession.mockImplementation(async () => ({
    id: fakeStripeId("cs"),
    url: "https://checkout.stripe.com/c/pay/fake",
  }));
  beat = await createTestBeat();
});

afterEach(async () => {
  await deleteTestBeat(beat.beatId);
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
