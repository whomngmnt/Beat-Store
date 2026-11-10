"use server";

import { getCartLines } from "@/lib/catalog";
import { cartTotalCents } from "@/lib/pricing";
import { cartItemsSchema } from "@/lib/validators";

// The cart as the server sees it: each line with its title, tier and
// current price from the database, plus the total. The cart drawer and the
// /cart page call this with the ids saved in the browser.
//
// Public on purpose: guests fill a cart without signing in, so there's no
// requireUser() here. It only reads, and changes nothing in the database.
// `items` is typed `unknown` because anyone can call a server action with
// any value; Zod checks it, and a bad cart gets null.
//
// The total shown here is for display. Checkout (Phase 5) reads the prices
// again when it creates the order.
export async function getCart(items: unknown) {
  const cart = cartItemsSchema.safeParse(items);
  if (!cart.success) return null;

  const lines = await getCartLines(cart.data);
  // Only lines that can be bought have a price. The others don't count.
  const prices = lines
    .map((line) => line.priceCents)
    .filter((price) => price !== null);

  return { lines, totalCents: cartTotalCents(prices) };
}
