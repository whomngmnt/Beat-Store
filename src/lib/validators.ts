// Zod schemas for every input the server receives (PLAN.md §6).
import { z } from "zod";
import { MAX_CART_ITEMS } from "@/lib/cart";
import { MIN_PRICE_CENTS, dollarsToCents } from "@/lib/pricing";

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

// A guest download token from a URL (src/lib/tokens.ts): 32 bytes as
// base64url are always 43 characters from this alphabet.
export const downloadTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

// The [orderItemId] and [fileType] in /api/download/[orderItemId]/[fileType].
export const downloadParamsSchema = z.object({
  orderItemId: z.uuid(),
  fileType: z.enum(["MP3", "WAV", "STEMS"]),
});

// Turns a title into a slug: "Midnight Drive!" → "midnight-drive".
export function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

const requiredText = (max: number) => z.string().trim().min(1).max(max);

// What an admin form shows after it's sent (src/components/admin/
// FormParts.tsx). `fieldErrors` goes under the matching fields.
export type FormResult = {
  ok: boolean;
  message: string;
  fieldErrors?: Partial<Record<string, string[]>>;
};

export function invalidForm(error: z.ZodError): FormResult {
  return {
    ok: false,
    message: "Check the fields marked below.",
    fieldErrors: z.flattenError(error).fieldErrors,
  };
}

// A price the admin types in dollars ("29.99") → whole cents (2999), at
// least Stripe's minimum.
export const priceField = z.string().transform((text, ctx) => {
  const cents = dollarsToCents(text);
  if (cents === null || cents < MIN_PRICE_CENTS) {
    ctx.addIssue({
      code: "custom",
      message: "Enter a price of at least 0.50, like 29.99.",
    });
    return z.NEVER;
  }
  return cents;
});

// The admin's beat form (create and edit). Everything arrives as text from
// FormData. The description is plain text: it's stored as typed and React
// escapes it when it's shown, so HTML in it never runs.
export const beatFormSchema = z
  .object({
    title: requiredText(100),
    // Left empty, it's made from the title.
    slug: z.string().trim().max(100),
    description: z.string().trim().max(5000),
    bpm: z.coerce.number().int().min(40).max(300),
    musicalKey: requiredText(30),
    genre: requiredText(50),
    mood: requiredText(50),
    // "trap, dark, 808" → ["trap", "dark", "808"], without repeats.
    tags: z
      .string()
      .transform((text) => [
        ...new Set(
          text
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
        ),
      ])
      .pipe(z.array(z.string().max(30)).max(10)),
    // A ticked checkbox sends "on"; an unticked one sends nothing.
    featured: z
      .string()
      .nullish()
      .transform((value) => value === "on"),
  })
  .transform((beat) => ({ ...beat, slug: beat.slug || slugify(beat.title) }))
  .refine((beat) => beatSlugSchema.safeParse(beat.slug).success, {
    path: ["slug"],
    message: "Use only lowercase letters, digits and dashes.",
  });

// A stream or video limit: empty means unlimited (null), otherwise a whole
// number of at least 1.
const limitField = z
  .string()
  .trim()
  .transform((text) => (text === "" ? null : Number(text)))
  .pipe(z.number().int().min(1).max(1_000_000_000).nullable());

// The admin's license tier form (/admin/licenses). Code, files included and
// order are fixed: beats are checked for their files against them
// (publishProblems), so they don't change here.
export const licenseTierFormSchema = z.object({
  tierId: z.uuid(),
  name: requiredText(50),
  description: requiredText(300),
  defaultPrice: priceField,
  streamLimit: limitField,
  videoLimit: limitField,
  terms: requiredText(5000),
});

// A coupon code: stored and looked up in capitals, so "summer10" and
// "SUMMER10" are the same code.
export const couponCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9_-]{3,30}$/, "Use 3–30 letters, digits, - or _.");

// The admin's new-coupon form (/admin/coupons). Exactly one of percent off
// and amount off is filled in (PLAN.md §4). The expiry is a date from
// <input type="date">: the coupon works to the end of that day (UTC).
export const couponFormSchema = z
  .object({
    code: couponCodeSchema,
    percentOff: z
      .string()
      .trim()
      .transform((text) => (text === "" ? null : Number(text)))
      .pipe(z.number().int().min(1).max(100).nullable()),
    amountOff: z
      .string()
      .trim()
      .transform((text, ctx) => {
        if (text === "") return null;
        const cents = dollarsToCents(text);
        if (cents === null || cents < 1) {
          ctx.addIssue({
            code: "custom",
            message: "Enter an amount like 10 or 4.99.",
          });
          return z.NEVER;
        }
        return cents;
      }),
    expiresOn: z
      .string()
      .trim()
      .transform((text) => (text === "" ? null : text))
      .pipe(z.iso.date().nullable()),
  })
  .refine((form) => (form.percentOff === null) !== (form.amountOff === null), {
    path: ["percentOff"],
    message: "Fill in exactly one: percent off or amount off.",
  })
  .transform(({ code, percentOff, amountOff, expiresOn }) => ({
    code,
    percentOff,
    amountOffCents: amountOff,
    expiresAt: expiresOn ? new Date(`${expiresOn}T23:59:59.999Z`) : null,
  }));
