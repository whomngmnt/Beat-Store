// Catalog queries for /beats and /beats/[slug]. Filters come in already
// checked by catalogSearchSchema (src/lib/validators.ts).
import { cache } from "react";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { beatSlugSchema, type CatalogFilters } from "@/lib/validators";

export const CATALOG_PAGE_SIZE = 9;

// What a BeatCard needs. `licenses` holds only the cheapest active license,
// which is the card's "From" price. `previewKey` is the public preview's
// storage key. The keys of the full files are never loaded.
const beatCardSelect = {
  id: true,
  slug: true,
  title: true,
  previewKey: true,
  bpm: true,
  musicalKey: true,
  genre: true,
  mood: true,
  tags: true,
  status: true,
  licenses: {
    where: { active: true },
    select: { priceCents: true },
    orderBy: { priceCents: "asc" },
    take: 1,
  },
} satisfies Prisma.BeatSelect;

export type BeatCardData = Prisma.BeatGetPayload<{
  select: typeof beatCardSelect;
}>;

// Prisma ignores a filter whose value is `undefined`, so a filter that
// isn't set simply drops out of the query.
function catalogWhere(filters: Partial<CatalogFilters>): Prisma.BeatWhereInput {
  const { q, genre, mood, key, bpmMin, bpmMax, maxPrice } = filters;
  return {
    // RESERVED beats stay listed: only their exclusive is on hold, leases
    // can still be bought. DRAFT and SOLD beats never show.
    status: { in: ["PUBLISHED", "RESERVED"] },
    // At least one license on sale, at or under the max price if one is set.
    licenses: {
      some: {
        active: true,
        priceCents: {
          lte: maxPrice === undefined ? undefined : maxPrice * 100,
        },
      },
    },
    genre,
    mood,
    musicalKey: key,
    bpm: { gte: bpmMin, lte: bpmMax },
    // Part of the title in any case, or one whole tag (tags are lowercase).
    OR: q
      ? [
          { title: { contains: q, mode: "insensitive" } },
          { tags: { has: q.toLowerCase() } },
        ]
      : undefined,
  };
}

// `id` breaks ties, so beats with the same value keep the same order and
// none repeat or go missing between pages.
const orderBy = {
  newest: [{ createdAt: "desc" }, { id: "asc" }],
  popular: [{ plays: "desc" }, { id: "asc" }],
} satisfies Record<string, Prisma.BeatOrderByWithRelationInput[]>;

export async function getCatalogPage(filters: CatalogFilters) {
  const where = catalogWhere(filters);
  const skip = (filters.page - 1) * CATALOG_PAGE_SIZE;
  const { sort } = filters;

  const [total, beats] = await Promise.all([
    db.beat.count({ where }),
    sort === "newest" || sort === "popular"
      ? db.beat.findMany({
          where,
          select: beatCardSelect,
          orderBy: orderBy[sort],
          skip,
          take: CATALOG_PAGE_SIZE,
        })
      : getBeatsByPrice(where, sort === "price-asc" ? "asc" : "desc", skip),
  ]);

  return { beats, total, totalPages: Math.ceil(total / CATALOG_PAGE_SIZE) };
}

// Prisma can't sort beats by their cheapest license. So group the active
// licenses by beat to get each beat's lowest price, sort and page those
// groups, then load the beats and put them back in that order.
async function getBeatsByPrice(
  where: Prisma.BeatWhereInput,
  direction: Prisma.SortOrder,
  skip: number,
) {
  const groups = await db.beatLicense.groupBy({
    by: ["beatId"],
    where: { active: true, beat: where },
    _min: { priceCents: true },
    orderBy: [{ _min: { priceCents: direction } }, { beatId: "asc" }],
    skip,
    take: CATALOG_PAGE_SIZE,
  });
  const ids = groups.map((group) => group.beatId);

  const beats = await db.beat.findMany({
    where: { id: { in: ids } },
    select: beatCardSelect,
  });
  return beats.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
}

// Home page: up to 3 beats the admin marked as featured, newest first.
export async function getFeaturedBeats() {
  return db.beat.findMany({
    where: { ...catalogWhere({}), featured: true },
    select: beatCardSelect,
    orderBy: orderBy.newest,
    take: 3,
  });
}

// Home page: the 6 newest beats on show.
export async function getNewestBeats() {
  return db.beat.findMany({
    where: catalogWhere({}),
    select: beatCardSelect,
    orderBy: orderBy.newest,
    take: 6,
  });
}

// Dropdown choices: the genres, moods and keys of the beats on show.
export async function getFilterOptions() {
  const beats = await db.beat.findMany({
    where: catalogWhere({}),
    select: { genre: true, mood: true, musicalKey: true },
  });
  const unique = (values: string[]) => [...new Set(values)].sort();
  return {
    genres: unique(beats.map((beat) => beat.genre)),
    moods: unique(beats.map((beat) => beat.mood)),
    keys: unique(beats.map((beat) => beat.musicalKey)),
  };
}

export type FilterOptions = Awaited<ReturnType<typeof getFilterOptions>>;

// What the beat page needs. The select lists every field, so the storage
// keys (mp3Key, wavKey, stemsKey) are never loaded or sent to the browser.
const beatDetailSelect = {
  id: true,
  slug: true,
  title: true,
  description: true,
  bpm: true,
  musicalKey: true,
  genre: true,
  mood: true,
  tags: true,
  status: true,
  licenses: {
    where: { active: true },
    orderBy: { licenseTier: { sortOrder: "asc" } },
    select: {
      priceCents: true,
      licenseTier: {
        select: {
          id: true,
          code: true,
          name: true,
          description: true,
          includesMp3: true,
          includesWav: true,
          includesStems: true,
          streamLimit: true,
          videoLimit: true,
          terms: true,
        },
      },
    },
  },
} satisfies Prisma.BeatSelect;

export type BeatDetail = Prisma.BeatGetPayload<{
  select: typeof beatDetailSelect;
}>;
export type BeatDetailLicense = BeatDetail["licenses"][number];

// One beat for /beats/[slug]: any beat the catalog shows, plus SOLD beats,
// which get a page marked "Sold". A DRAFT beat or a bad slug gives null.
// `cache` lets generateMetadata and the page share one query per request.
export const getBeatBySlug = cache(async (rawSlug: string) => {
  const slug = beatSlugSchema.safeParse(rawSlug);
  if (!slug.success) return null;

  return db.beat.findFirst({
    where: { slug: slug.data, OR: [catalogWhere({}), { status: "SOLD" }] },
    select: beatDetailSelect,
  });
});
