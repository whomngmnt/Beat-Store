// Zod schemas for every input the server receives (PLAN.md §6).
import { z } from "zod";

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
