import type Stripe from "stripe";
import { describe, expect, it } from "vitest";
import { sessionProblem } from "../../src/lib/fulfilment";

const order = {
  id: "8d6f3a52-2b1c-4e8a-9f3d-0c1b2a3d4e5f",
  stripeSessionId: "cs_test_abc",
  totalCents: 7998,
  currency: "usd",
};

function session(changes: Partial<Stripe.Checkout.Session> = {}) {
  return {
    id: "cs_test_abc",
    payment_status: "paid",
    amount_total: 7998,
    currency: "usd",
    metadata: { orderId: order.id },
    ...changes,
  } as Stripe.Checkout.Session;
}

describe("sessionProblem", () => {
  it("accepts a paid session that matches the order", () => {
    expect(sessionProblem(session(), order)).toBeNull();
  });

  it.each([
    ["another session", { id: "cs_test_other" }],
    ["an unpaid session", { payment_status: "unpaid" as const }],
    [
      "a session with no payment",
      { payment_status: "no_payment_required" as const },
    ],
    ["a lower amount", { amount_total: 7997 }],
    ["a higher amount", { amount_total: 7999 }],
    ["no amount", { amount_total: null }],
    ["another currency", { currency: "eur" }],
  ])("refuses %s", (_label, changes) => {
    expect(sessionProblem(session(changes), order)).toEqual(expect.any(String));
  });

  it("refuses any session for an order that has no session yet", () => {
    expect(
      sessionProblem(session(), { ...order, stripeSessionId: null }),
    ).toEqual(expect.any(String));
  });
});
