"use server";

import { getCartLines, type CartLine } from "@/lib/catalog";
import { db } from "@/lib/db";
import { cartTotalCents } from "@/lib/pricing";
import { releaseReservations, reserveExclusive } from "@/lib/reservation";
import { getStripe } from "@/lib/stripe";
import { createDownloadToken } from "@/lib/tokens";
import { cartItemsSchema } from "@/lib/validators";
import type { LicenseCode } from "@/generated/prisma/client";

// How long the buyer has to pay. Stripe accepts 30 minutes at the least,
// counted from when it creates the session, so 30 exactly could be refused.
// The exclusive hold lasts longer (src/lib/reservation.ts).
const SESSION_MINUTES = 31;

// A line with no problem always has a title, a tier and a price.
type BuyableLine = CartLine & {
  title: string;
  tierName: string;
  tierCode: LicenseCode;
  priceCents: number;
};

function isBuyable(line: CartLine): line is BuyableLine {
  return (
    line.problem === null &&
    line.title !== null &&
    line.tierName !== null &&
    line.tierCode !== null &&
    line.priceCents !== null
  );
}

class ExclusiveTaken extends Error {}

// Starts a Stripe checkout for the cart (PLAN.md §5.2, steps 1–4).
// Returns the Stripe page to send the buyer to, or a message to show.
//
// Public on purpose: guests can buy without signing in, so there's no
// requireUser() here. Accounts come in Phase 7, and then the order gets the
// signed-in user's id. Only the two ids per line come from the browser:
// prices, titles and the total are all read and worked out here.
// Known limit: anyone can call this to hold an exclusive for 35 minutes.
// The rate-limiting later slice (Upstash) covers that.
export async function createCheckoutSession(
  items: unknown,
): Promise<{ url: string } | { error: string }> {
  const cart = cartItemsSchema.safeParse(items);
  if (!cart.success || cart.data.length === 0) {
    return { error: "Your cart is empty or out of date. Reload the page." };
  }

  // Step 2: prices from the database, and every line must be buyable now.
  const lines = await getCartLines(cart.data);
  const buyable = lines.filter(isBuyable);
  if (buyable.length !== lines.length) {
    return {
      error:
        "Some beats in your cart can't be bought right now. Remove them and try again.",
    };
  }
  const totalCents = cartTotalCents(buyable.map((line) => line.priceCents));

  // The guest download token (PLAN.md §5.1). Only its hash goes in the
  // database. The raw token goes in the success page URL below, which is
  // the buyer's download link. It's made before payment, but the download
  // route serves PAID orders only.
  const download = createDownloadToken();

  // Step 3: one transaction creates the PENDING order and holds every
  // exclusive. If one is taken, the throw rolls back the order too.
  let orderId: string;
  try {
    orderId = await db.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          totalCents,
          downloadTokenHash: download.hash,
          downloadTokenExpiresAt: download.expiresAt,
          // Snapshots, so later edits to a beat or tier don't change the order.
          items: {
            create: buyable.map((line) => ({
              beatId: line.beatId,
              licenseTierId: line.licenseTierId,
              priceCents: line.priceCents,
              beatTitleSnapshot: line.title,
              licenseNameSnapshot: line.tierName,
            })),
          },
        },
        select: { id: true },
      });

      for (const line of buyable) {
        if (line.tierCode !== "EXCLUSIVE") continue;
        if (!(await reserveExclusive(tx, line.beatId, order.id))) {
          throw new ExclusiveTaken();
        }
      }
      return order.id;
    });
  } catch (error) {
    if (error instanceof ExclusiveTaken) {
      return {
        error:
          "This exclusive was just taken by another buyer. Remove it from your cart to buy the rest.",
      };
    }
    throw error;
  }

  // Step 4: the Stripe session. The webhook finds the order through
  // metadata.orderId. The idempotency key stops a network retry from
  // creating a second session for the same order.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  try {
    const session = await getStripe().checkout.sessions.create(
      {
        mode: "payment",
        // Cards only: they're paid when Checkout completes, so there's no
        // "payment still processing" state to handle. (Stripe SDK 23 replaced
        // payment_method_types with this filter.)
        allowed_payment_method_types: ["card"],
        line_items: buyable.map((line) => ({
          quantity: 1,
          price_data: {
            currency: "usd", // the same as Order.currency's default
            unit_amount: line.priceCents,
            product_data: { name: `${line.title} (${line.tierName})` },
          },
        })),
        metadata: { orderId },
        expires_at: Math.floor(Date.now() / 1000) + SESSION_MINUTES * 60,
        // base64url needs no escaping in a URL.
        success_url: `${siteUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}&token=${download.token}`,
        cancel_url: `${siteUrl}/checkout/cancel`,
      },
      { idempotencyKey: `checkout-${orderId}` },
    );
    if (!session.url) throw new Error("Stripe returned no checkout URL");

    await db.order.update({
      where: { id: orderId },
      data: { stripeSessionId: session.id },
    });
    return { url: session.url };
  } catch (error) {
    // No payment can happen without the URL, so free the exclusives and
    // close the order.
    console.error(`Checkout for order ${orderId} failed`, error);
    await db.$transaction(async (tx) => {
      await releaseReservations(tx, orderId);
      await tx.order.update({
        where: { id: orderId },
        data: { status: "FAILED" },
      });
    });
    return { error: "Couldn't start checkout. Please try again." };
  }
}
