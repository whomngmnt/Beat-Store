// The Stripe webhook route and fulfilOrder() against the real database
// (.claude/rules/stripe-checkout.md, "Tests"). Events are signed with the
// fake secret from setup.ts, the same way Stripe signs real ones. The only
// faked Stripe calls are creating a session and creating a refund.
import type Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCheckoutSession } from "../../src/actions/checkout";
import { POST } from "../../src/app/api/webhooks/stripe/route";
import { db } from "../../src/lib/db";
import { fulfilOrder } from "../../src/lib/fulfilment";
import { releaseExpiredReservations } from "../../src/lib/reservation";
import { getStripe } from "../../src/lib/stripe";
import { createTestBeat, deleteTestBeat, fakeStripeId } from "./fixtures";

let beat: Awaited<ReturnType<typeof createTestBeat>>;
const eventIds: string[] = [];

beforeEach(async () => {
  vi.restoreAllMocks();
  vi.spyOn(getStripe().checkout.sessions, "create").mockImplementation(
    async () =>
      ({
        id: fakeStripeId("cs"),
        url: "https://checkout.stripe.com/fake",
      }) as Stripe.Response<Stripe.Checkout.Session>,
  );
  vi.spyOn(getStripe().refunds, "create").mockImplementation(
    async () => ({ id: fakeStripeId("re") }) as Stripe.Response<Stripe.Refund>,
  );
  vi.spyOn(console, "error").mockImplementation(() => {});
  beat = await createTestBeat();
});

afterEach(async () => {
  await deleteTestBeat(beat.beatId);
  await db.webhookEvent.deleteMany({ where: { id: { in: eventIds } } });
});

// Starts a checkout through the real action and returns the PENDING order.
async function checkout(code: "PREMIUM" | "EXCLUSIVE") {
  const result = await createCheckoutSession([beat.cartItem(code)]);
  if (!("url" in result)) throw new Error(result.error);
  return db.order.findFirstOrThrow({
    where: { items: { some: { beatId: beat.beatId } } },
    orderBy: { createdAt: "desc" },
    select: { id: true, stripeSessionId: true, totalCents: true },
  });
}

// The test beat's hold runs out, and the cron job's query frees it.
async function endHold() {
  await db.$executeRaw`
    UPDATE "Beat" SET "reservedUntil" = now() - interval '1 minute'
    WHERE id = ${beat.beatId}`;
  await releaseExpiredReservations();
}

// The session Stripe sends in checkout.session.completed after a payment.
function paidSession(
  order: { id: string; stripeSessionId: string | null; totalCents: number },
  changes: Partial<Stripe.Checkout.Session> = {},
) {
  return {
    id: order.stripeSessionId,
    object: "checkout.session",
    status: "complete",
    payment_status: "paid",
    amount_total: order.totalCents,
    currency: "usd",
    metadata: { orderId: order.id },
    payment_intent: fakeStripeId("pi"),
    customer_details: { email: "buyer@example.com" },
    ...changes,
  } as Stripe.Checkout.Session;
}

function makeEvent(type: string, object: unknown, id = fakeStripeId("evt")) {
  eventIds.push(id);
  return { id, object: "event", type, data: { object } };
}

// A request as Stripe sends it, signed over the exact body.
function signedRequest(event: object, body = JSON.stringify(event)) {
  const signature = getStripe().webhooks.generateTestHeaderString({
    payload: JSON.stringify(event),
    secret: process.env.STRIPE_WEBHOOK_SECRET!,
  });
  return new Request("http://localhost/api/webhooks/stripe", {
    method: "POST",
    body,
    headers: { "stripe-signature": signature },
  });
}

const getOrder = (id: string) =>
  db.order.findUniqueOrThrow({
    where: { id },
    include: { items: { include: { downloads: true } } },
  });

describe("POST /api/webhooks/stripe", () => {
  it("rejects a tampered body with 400 and doesn't fulfil", async () => {
    const order = await checkout("PREMIUM");
    const event = makeEvent("checkout.session.completed", paidSession(order));
    // Signed for the real event, but the body says a lower amount was due.
    const tampered = JSON.stringify(
      makeEvent(
        "checkout.session.completed",
        paidSession(order, { amount_total: 1 }),
        event.id,
      ),
    );

    const response = await POST(signedRequest(event, tampered));

    expect(response.status).toBe(400);
    expect((await getOrder(order.id)).status).toBe("PENDING");
  });

  it("rejects a request without a signature with 400", async () => {
    const order = await checkout("PREMIUM");
    const event = makeEvent("checkout.session.completed", paidSession(order));
    const request = new Request("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body: JSON.stringify(event),
    });

    expect((await POST(request)).status).toBe(400);
    expect((await getOrder(order.id)).status).toBe("PENDING");
  });

  it("doesn't fulfil a signed event whose amount doesn't match, and flags the order", async () => {
    const order = await checkout("PREMIUM");
    const session = paidSession(order, { amount_total: order.totalCents - 1 });

    const response = await POST(
      signedRequest(makeEvent("checkout.session.completed", session)),
    );

    expect(response.status).toBe(200);
    const saved = await getOrder(order.id);
    expect(saved.status).toBe("PENDING");
    expect(saved.reviewNote).toMatch(/order total/);
    expect(saved.items[0].downloads).toHaveLength(0);
  });

  it("doesn't fulfil an unpaid session or another currency", async () => {
    const order = await checkout("PREMIUM");
    for (const changes of [
      { payment_status: "unpaid" as const },
      { currency: "eur" },
    ]) {
      const session = paidSession(order, changes);
      await POST(
        signedRequest(makeEvent("checkout.session.completed", session)),
      );
    }
    expect((await getOrder(order.id)).status).toBe("PENDING");
  });

  it("fulfils once when the same event arrives twice", async () => {
    const order = await checkout("PREMIUM");
    const event = makeEvent("checkout.session.completed", paidSession(order));

    const first = await POST(signedRequest(event));
    const second = await POST(signedRequest(event));

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    const saved = await getOrder(order.id);
    expect(saved.status).toBe("PAID");
    expect(saved.email).toBe("buyer@example.com");
    expect(saved.items[0].downloads.map((d) => d.fileType).sort()).toEqual([
      "MP3",
      "WAV",
    ]);
  });

  it("fulfils once when deliveries and the success page run at the same time", async () => {
    const order = await checkout("PREMIUM");
    const session = paidSession(order);
    const event = makeEvent("checkout.session.completed", session);
    // A second event id for the same session, as if Stripe sent it again
    // under a new id (fulfilOrder must not rely on the event id alone).
    const otherEvent = makeEvent("checkout.session.completed", session);

    const results = await Promise.all([
      ...Array.from({ length: 5 }, () => POST(signedRequest(event))),
      POST(signedRequest(otherEvent)),
      fulfilOrder(session), // the success page, which has no event id
      fulfilOrder(session),
    ]);

    const statuses = results
      .slice(0, 6)
      .map((response) => (response as Response).status);
    expect(statuses).toEqual([200, 200, 200, 200, 200, 200]);
    const saved = await getOrder(order.id);
    expect(saved.status).toBe("PAID");
    expect(saved.items[0].downloads).toHaveLength(2);
    expect(await db.webhookEvent.count({ where: { id: event.id } })).toBe(1);
  });

  it("sells an exclusive: the beat becomes SOLD and all files are delivered", async () => {
    const order = await checkout("EXCLUSIVE");

    await POST(
      signedRequest(
        makeEvent("checkout.session.completed", paidSession(order)),
      ),
    );

    const saved = await getOrder(order.id);
    expect(saved.status).toBe("PAID");
    expect(saved.items[0].downloads).toHaveLength(3);
    const savedBeat = await db.beat.findUniqueOrThrow({
      where: { id: beat.beatId },
    });
    expect(savedBeat.status).toBe("SOLD");
    expect(savedBeat.reservedByOrderId).toBe(order.id);
  });

  it("refunds an exclusive that another buyer got first", async () => {
    // Buyer A holds the exclusive, the hold runs out, the cron job frees
    // it, and buyer B takes it.
    const orderA = await checkout("EXCLUSIVE");
    await endHold();
    const orderB = await checkout("EXCLUSIVE");

    // Then A's payment still goes through.
    const session = paidSession(orderA);
    const response = await POST(
      signedRequest(makeEvent("checkout.session.completed", session)),
    );

    expect(response.status).toBe(200);
    const savedA = await getOrder(orderA.id);
    expect(savedA.status).toBe("PAID");
    expect(savedA.items[0].refundNeeded).toBe(true);
    expect(savedA.items[0].refundedAt).not.toBeNull();
    expect(savedA.items[0].downloads).toHaveLength(0);
    expect(getStripe().refunds.create).toHaveBeenCalledWith(
      {
        payment_intent: session.payment_intent,
        amount: orderA.totalCents,
        metadata: { orderItemId: savedA.items[0].id },
      },
      { idempotencyKey: `refund-${savedA.items[0].id}` },
    );
    // B still holds the beat.
    const savedBeat = await db.beat.findUniqueOrThrow({
      where: { id: beat.beatId },
    });
    expect(savedBeat.status).toBe("RESERVED");
    expect(savedBeat.reservedByOrderId).toBe(orderB.id);
  });

  it("keeps the refund for the cron job when Stripe fails, and still answers 200", async () => {
    vi.mocked(getStripe().refunds.create).mockRejectedValueOnce(
      new Error("Stripe is down"),
    );
    const orderA = await checkout("EXCLUSIVE");
    await endHold();
    await checkout("EXCLUSIVE");

    const response = await POST(
      signedRequest(
        makeEvent("checkout.session.completed", paidSession(orderA)),
      ),
    );

    expect(response.status).toBe(200);
    const item = (await getOrder(orderA.id)).items[0];
    expect(item.refundNeeded).toBe(true);
    expect(item.refundedAt).toBeNull();
  });

  it("expires an unpaid order and frees its exclusive", async () => {
    const order = await checkout("EXCLUSIVE");
    const session = { ...paidSession(order), status: "expired" };

    await POST(signedRequest(makeEvent("checkout.session.expired", session)));

    expect((await getOrder(order.id)).status).toBe("EXPIRED");
    const savedBeat = await db.beat.findUniqueOrThrow({
      where: { id: beat.beatId },
    });
    expect(savedBeat.status).toBe("PUBLISHED");
    expect(savedBeat.reservedByOrderId).toBeNull();
  });

  it("marks an order REFUNDED only when the whole charge is refunded", async () => {
    const order = await checkout("PREMIUM");
    const session = paidSession(order);
    await POST(signedRequest(makeEvent("checkout.session.completed", session)));
    const charge = (refunded: boolean) => ({
      id: fakeStripeId("ch"),
      object: "charge",
      payment_intent: session.payment_intent,
      refunded,
    });

    await POST(signedRequest(makeEvent("charge.refunded", charge(false))));
    expect((await getOrder(order.id)).status).toBe("PAID");

    await POST(signedRequest(makeEvent("charge.refunded", charge(true))));
    expect((await getOrder(order.id)).status).toBe("REFUNDED");
  });
});
