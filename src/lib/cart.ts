// The cart's shape and limit, shared by the browser and the server.
//
// No Zod in this file: it ships to the browser on every store page, where
// Zod would add about 30 KB gzipped. The server checks every cart it
// receives with cartItemsSchema (src/lib/validators.ts), which follows the
// same rules.

export const MAX_CART_ITEMS = 20;

// Which beat and which license tier. Never a price.
export type CartItem = { beatId: string; licenseTierId: string };

// The UUID pattern Zod's z.uuid() uses (version 1–8, RFC variant), without
// its two special cases (all zeros, all f's). So a cart that passes here
// always passes cartItemsSchema on the server too.
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Checks a cart read back from localStorage, which anyone can edit. Returns
// the items with only their two ids (anything else, such as a price, is
// dropped), or null if the cart is broken: not a list, too many items, a
// bad id, or the same beat twice.
export function parseSavedCart(value: unknown): CartItem[] | null {
  if (!Array.isArray(value) || value.length > MAX_CART_ITEMS) return null;

  const items: CartItem[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) return null;
    const { beatId, licenseTierId } = entry as Record<string, unknown>;
    if (typeof beatId !== "string" || !UUID.test(beatId)) return null;
    if (typeof licenseTierId !== "string" || !UUID.test(licenseTierId)) {
      return null;
    }
    if (items.some((item) => item.beatId === beatId)) return null;
    items.push({ beatId, licenseTierId });
  }
  return items;
}
