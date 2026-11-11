// Stripe client (PLAN.md §5.2). Test mode only: the store never takes real
// payments, so a live key is refused.
//
// The client is created on first use, not when this file is imported:
// `next build` loads route modules in CI, where there's no key, and
// `new Stripe()` throws without one.
import Stripe from "stripe";

let client: Stripe | undefined;

export function getStripe(): Stripe {
  if (client) return client;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key?.startsWith("sk_test_")) {
    throw new Error("STRIPE_SECRET_KEY must be a Stripe test key (sk_test_…)");
  }
  // No apiVersion: the SDK uses the API version it was built for.
  client = new Stripe(key);
  return client;
}
