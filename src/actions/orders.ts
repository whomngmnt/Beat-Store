"use server";

// Admin actions on one order (PLAN.md §5.1, §5.2): refund it, give a buyer
// their downloads back, or make a new guest download link.
//
// A server action can be called by anyone who finds it, so each one calls
// requireAdmin() before anything else, and checks its ids with Zod.
import { refresh } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import { reissueDownloadToken, resetDownloadCount } from "@/lib/downloads";
import { getStripe } from "@/lib/stripe";

// What the refund and reissue forms show after they're sent.
export type OrderActionResult =
  { ok: true; message: string } | { ok: false; message: string };

const refundSchema = z.object({
  orderId: z.uuid(),
  // The "Refund $X to the buyer" checkbox. A ticked box sends "on".
  confirm: z.literal("on"),
});

// Refunds what's left of a PAID order's payment. The order turns REFUNDED
// only when Stripe's charge.refunded webhook arrives (markOrderRefunded in
// src/lib/fulfilment.ts), so the webhook stays the one place that records
// a refund. The idempotency key makes a double click return the first
// refund instead of making a second one.
export async function refundOrder(
  _previous: OrderActionResult | undefined,
  formData: FormData,
): Promise<OrderActionResult> {
  await requireAdmin();

  const input = refundSchema.safeParse({
    orderId: formData.get("orderId"),
    confirm: formData.get("confirm"),
  });
  if (!input.success) {
    return { ok: false, message: "Tick the box to confirm the refund." };
  }

  // The status and payment come from the database, never from the form.
  const order = await db.order.findUnique({
    where: { id: input.data.orderId },
    select: { status: true, stripePaymentIntentId: true },
  });
  if (order?.status !== "PAID" || !order.stripePaymentIntentId) {
    return { ok: false, message: "Only a paid order can be refunded." };
  }

  try {
    // No amount: Stripe refunds whatever hasn't been refunded yet, such as
    // the rest after a lost exclusive was refunded on its own.
    await getStripe().refunds.create(
      { payment_intent: order.stripePaymentIntentId },
      { idempotencyKey: `refund-order-${input.data.orderId}` },
    );
  } catch (error) {
    console.error(`Refund of order ${input.data.orderId} failed`, error);
    return {
      ok: false,
      message:
        "Stripe didn't accept the refund. Check the payment in the Stripe Dashboard.",
    };
  }
  return {
    ok: true,
    message:
      "Refund sent to Stripe. The order turns REFUNDED when Stripe confirms it.",
  };
}

// Sets one file's download count back to 0, then shows the page again.
export async function resetDownload(formData: FormData): Promise<void> {
  await requireAdmin();

  const downloadId = z.uuid().safeParse(formData.get("downloadId"));
  if (!downloadId.success) return;

  await resetDownloadCount(downloadId.data);
  refresh();
}

// Replaces the order's guest token and returns the new download link, shown
// once for the admin to send to the buyer. The old link stops working.
export async function reissueGuestLink(
  _previous: OrderActionResult | undefined,
  formData: FormData,
): Promise<OrderActionResult> {
  await requireAdmin();

  const orderId = z.uuid().safeParse(formData.get("orderId"));
  if (!orderId.success) return { ok: false, message: "Unknown order." };

  const link = await reissueDownloadToken(orderId.data);
  if (!link) {
    return {
      ok: false,
      message: "This order never reached Stripe, so it has no download link.",
    };
  }
  return { ok: true, message: link };
}
