// Stripe webhook (PLAN.md §5.2, .claude/rules/stripe-checkout.md).
// Locally: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
// prints the STRIPE_WEBHOOK_SECRET to put in .env.
//
// No requireUser() / requireAdmin(): Stripe calls this, not a person. The
// signature check below is what proves the request comes from Stripe.
import type Stripe from "stripe";
import { expireOrder, fulfilOrder, markOrderRefunded } from "@/lib/fulfilment";
import { getStripe } from "@/lib/stripe";

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    // Our setup is broken, not the request. A 500 makes Stripe retry later.
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return new Response("Webhook not configured", { status: 500 });
  }

  // The signature covers the exact bytes Stripe sent, so read the raw text.
  // req.json() and stringifying it again could change them.
  const body = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, secret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  // Any other event type is ignored. A thrown error gives a 500, and
  // Stripe sends the event again later.
  switch (event.type) {
    case "checkout.session.completed":
      await fulfilOrder(event.data.object, event.id);
      break;
    case "checkout.session.expired":
      await expireOrder(event.data.object);
      break;
    case "charge.refunded":
      await markOrderRefunded(event.data.object);
      break;
  }
  return new Response(null, { status: 200 });
}
