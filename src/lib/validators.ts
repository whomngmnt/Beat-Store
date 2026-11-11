// Zod schemas for every input the server receives (PLAN.md §6).
import { z } from "zod";
import { MAX_CART_ITEMS } from "@/lib/cart";

// Optional text filter such as a genre. An empty value, a value that's too
// long or a repeated param (`?genre=a&genre=b` arrives as an array) all fail
// the check, and `.catch` turns that into "not set".
const optionalText = z
  .string()
  .trim()
  .min(1)
  .max(50)
  .optional()
  .catch(undefined);

// Optional whole number in a range, read from a URL string. An empty field
// becomes 0, which fails `min(1)` and so counts as "not set" too.
function optionalInt(max: number) {
  return z.coerce.number().int().min(1).max(max).optional().catch(undefined);
}

export const CATALOG_SORTS = [
  "newest",
  "popular",
  "price-asc",
  "price-desc",
] as const;

// The /beats URL search params. Every field has `.catch`, so a bad value is
// ignored instead of breaking the page, and `parse` never throws.
export const catalogSearchSchema = z.object({
  q: z.string().trim().min(1).max(100).optional().catch(undefined),
  genre: optionalText,
  mood: optionalText,
  key: optionalText,
  bpmMin: optionalInt(300),
  bpmMax: optionalInt(300),
  maxPrice: optionalInt(100_000), // whole dollars; the query turns it into cents
  sort: z.enum(CATALOG_SORTS).catch("newest"),
  page: z.coerce.number().int().min(1).max(1000).catch(1),
});

export type CatalogFilters = z.infer<typeof catalogSearchSchema>;

// The slug in /beats/[slug]. Seeded and admin-made slugs use only lowercase
// letters, digits and dashes, so anything else can't match a beat.
export const beatSlugSchema = z
  .string()
  .max(100)
  .regex(/^[a-z0-9-]+$/);

// A beat id sent by the browser. Every id is a UUID (PLAN.md §4).
export const beatIdSchema = z.uuid();

// The cart: which beat and which license tier, nothing else. There's no
// price in it, because prices always come from the database. `z.object`
// drops any other field, such as a price someone added by hand. One tier
// per beat, so a beat can't appear twice. The browser checks a saved cart
// with parseSavedCart (src/lib/cart.ts), which follows the same rules.
export const cartItemsSchema = z
  .array(z.object({ beatId: beatIdSchema, licenseTierId: z.uuid() }))
  .max(MAX_CART_ITEMS)
  .refine(
    (items) => new Set(items.map((item) => item.beatId)).size === items.length,
    "A beat can be in the cart only once",
  );

// The session_id Stripe puts in the success page URL. It's only used to
// look the order up. Test mode only, so it always starts with cs_test_.
export const checkoutSessionIdSchema = z
  .string()
  .max(255)
  .regex(/^cs_test_[A-Za-z0-9]+$/);
