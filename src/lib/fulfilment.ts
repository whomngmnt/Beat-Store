// What happens to an order after the buyer leaves for Stripe (PLAN.md §5.2,
// steps 5–10, and .claude/rules/stripe-checkout.md).
//
// fulfilOrder() is called by the webhook and by the success page. Both may
// run at the same time, or the webhook may arrive twice, so every step is
// safe to repeat: the second run changes nothing.
import type Stripe from "stripe";
import { Prisma, type FileType } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { releaseReservations } from "@/lib/reservation";
import { getStripe } from "@/lib/stripe";

type OrderToCheck = {
  id: string;
  stripeSessionId: string | null;
  totalCents: number;
  currency: string;
};

// Why this Checkout Session can't fulfil this order, or null if it can.
// The session comes from Stripe (a signed webhook, or fetched on the
// server), so these fields can be trusted. They're compared with the order,
// not with anything from the browser.
export function sessionProblem(
  session: Stripe.Checkout.Session,
  order: OrderToCheck,
): string | null {
  if (session.id !== order.stripeSessionId) {
    return "The session isn't this order's session";
  }
  if (session.payment_status !== "paid") {
    return `Payment status is "${session.payment_status}", not "paid"`;
  }
  if (session.amount_total !== order.totalCents) {
    return `Paid ${session.amount_total} cents, but the order total is ${order.totalCents}`;
  }
  if (session.currency !== order.currency) {
    return `Paid in ${session.currency}, but the order is in ${order.currency}`;
  }
  return null;
}

export type FulfilResult = "fulfilled" | "already-done" | "not-fulfilled";

// Marks a paid order PAID and gives the buyer their files (steps 5–7).
// `eventId` is the webhook event's id. The success page has none.
export async function fulfilOrder(
  session: Stripe.Checkout.Session,
  eventId?: string,
): Promise<FulfilResult> {
  const orderId = session.metadata?.orderId;
  const order = orderId
    ? await db.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          stripeSessionId: true,
          totalCents: true,
          currency: true,
        },
      })
    : null;
  if (!order) {
    console.error(`No order for Checkout Session ${session.id}`);
    return "not-fulfilled";
  }

  const problem = sessionProblem(session, order);
  if (problem) {
    console.error(`Order ${order.id} not fulfilled: ${problem}`);
    await db.order.update({
      where: { id: order.id },
      data: { reviewNote: problem },
    });
    return "not-fulfilled";
  }

  // Step 6: database only. No Stripe calls in here, so the transaction stays
  // short and a failure leaves nothing half done.
  let fulfilled: boolean;
  try {
    fulfilled = await db.$transaction(async (tx) => {
      // The idempotency guard. The event id is the primary key, so a second
      // delivery of the same event fails here and rolls back (caught below).
      if (eventId) {
        await tx.webhookEvent.create({
          data: { id: eventId, type: "checkout.session.completed" },
        });
      }

      // Only a PENDING order becomes PAID. If the success page or another
      // event got here first, 0 rows change and there's nothing left to do.
      const now = new Date();
      const paid = await tx.order.updateMany({
        where: { id: order.id, status: "PENDING" },
        data: {
          status: "PAID",
          paidAt: now,
          fulfilledAt: now,
          // Guests type their email in Stripe Checkout.
          email: session.customer_details?.email ?? null,
          stripePaymentIntentId: paymentIntentId(session.payment_intent),
        },
      });
      if (paid.count === 0) return false;

      const items = await tx.orderItem.findMany({
        where: { orderId: order.id },
        select: {
          id: true,
          beatId: true,
          licenseTier: {
            select: {
              code: true,
              includesMp3: true,
              includesWav: true,
              includesStems: true,
            },
          },
        },
      });

      for (const { id, beatId, licenseTier: tier } of items) {
        if (tier.code === "EXCLUSIVE") {
          // Sold only if this order still holds the beat. 0 rows means the
          // hold ran out and someone else got it: refund after the commit.
          const sold = await tx.beat.updateMany({
            where: { id: beatId, reservedByOrderId: order.id },
            data: { status: "SOLD", reservedUntil: null },
          });
          if (sold.count === 0) {
            await tx.orderItem.update({
              where: { id },
              data: { refundNeeded: true },
            });
            continue; // no files for a beat this buyer didn't get
          }
        }

        const fileTypes: FileType[] = [];
        if (tier.includesMp3) fileTypes.push("MP3");
        if (tier.includesWav) fileTypes.push("WAV");
        if (tier.includesStems) fileTypes.push("STEMS");
        await tx.download.createMany({
          data: fileTypes.map((fileType) => ({ orderItemId: id, fileType })),
        });
      }
      return true;
    });
  } catch (error) {
    if (eventId && isUniqueViolation(error)) return "already-done";
    throw error;
  }
  if (!fulfilled) return "already-done";

  // Step 7: after the commit.
  await refundLostExclusives(order.id);
  return "fulfilled";
}

// Refunds every lost exclusive (refundNeeded) that isn't refunded yet: of
// one order after fulfilment, or of all orders when the cron job calls it
// without an id. Safe to run again: the idempotency key makes Stripe
// return the first refund instead of making a second one, and refundedAt
// is set once Stripe has accepted it. A failure is logged, not thrown, so
// the webhook still answers 200 and the cron job tries again later.
// Returns how many refunds went through.
export async function refundLostExclusives(orderId?: string): Promise<number> {
  const items = await db.orderItem.findMany({
    where: {
      orderId, // undefined means every order
      refundNeeded: true,
      refundedAt: null,
      order: { stripePaymentIntentId: { not: null } },
    },
    select: {
      id: true,
      priceCents: true,
      order: { select: { stripePaymentIntentId: true } },
    },
  });

  let refunded = 0;
  for (const item of items) {
    const intentId = item.order.stripePaymentIntentId;
    if (!intentId) continue; // the query already skips these
    try {
      await getStripe().refunds.create(
        {
          payment_intent: intentId,
          amount: item.priceCents,
          metadata: { orderItemId: item.id },
        },
        { idempotencyKey: `refund-${item.id}` },
      );
      await db.orderItem.update({
        where: { id: item.id },
        data: { refundedAt: new Date() },
      });
      refunded++;
    } catch (error) {
      console.error(`Refund of order item ${item.id} failed`, error);
    }
  }
  return refunded;
}

// Step 9: checkout.session.expired. The buyer never paid, so the order
// becomes EXPIRED and its exclusives go back on sale.
export async function expireOrder(session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.orderId;
  if (!orderId) return;

  await db.$transaction(async (tx) => {
    const expired = await tx.order.updateMany({
      where: { id: orderId, stripeSessionId: session.id, status: "PENDING" },
      data: { status: "EXPIRED" },
    });
    if (expired.count > 0) await releaseReservations(tx, orderId);
  });
}

// Step 10: charge.refunded. A fully refunded order becomes REFUNDED, which
// turns its downloads off (the download route serves PAID orders only).
// A sold exclusive stays SOLD: the admin decides whether to re-list it.
export async function markOrderRefunded(charge: Stripe.Charge) {
  // `refunded` is true only once the whole charge is refunded. After a
  // partial refund (one lost exclusive), the rest of the order stays.
  if (!charge.refunded) return;
  const intentId = paymentIntentId(charge.payment_intent);
  if (!intentId) return;

  await db.order.updateMany({
    where: { stripePaymentIntentId: intentId, status: "PAID" },
    data: { status: "REFUNDED" },
  });
}

// For the success page (step 8). `sessionId` comes from the URL, so it's
// only a lookup key. If the order is still PENDING (the webhook is late),
// this fetches the session from Stripe on the server and runs the same
// fulfilOrder(), which checks the payment itself. Returns null if no order
// has this session.
export async function confirmCheckout(sessionId: string) {
  const found = await db.order.findUnique({
    where: { stripeSessionId: sessionId },
    select: { status: true },
  });
  if (!found) return null;

  if (found.status === "PENDING") {
    try {
      const session = await getStripe().checkout.sessions.retrieve(sessionId);
      if (session.status === "complete") await fulfilOrder(session);
    } catch (error) {
      // The page then says the payment is still being confirmed.
      console.error(`Couldn't confirm Checkout Session ${sessionId}`, error);
    }
  }

  return db.order.findUnique({
    where: { stripeSessionId: sessionId },
    select: {
      status: true,
      email: true,
      totalCents: true,
      reviewNote: true,
      downloadTokenHash: true,
      downloadTokenExpiresAt: true,
      items: {
        select: {
          id: true,
          beatTitleSnapshot: true,
          licenseNameSnapshot: true,
          priceCents: true,
          refundNeeded: true,
          downloads: {
            select: { fileType: true, count: true, maxCount: true },
            orderBy: { fileType: "asc" },
          },
        },
      },
    },
  });
}

// Stripe gives the payment intent as an id, or as an object when expanded.
function paymentIntentId(
  intent: string | { id: string } | null,
): string | null {
  return typeof intent === "string" ? intent : (intent?.id ?? null);
}

function isUniqueViolation(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}
