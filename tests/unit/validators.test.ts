import { describe, expect, it } from "vitest";
import {
  MAX_CART_ITEMS,
  beatIdSchema,
  beatSlugSchema,
  cartItemsSchema,
  catalogSearchSchema,
} from "../../src/lib/validators";

describe("catalogSearchSchema", () => {
  it("uses the defaults when the URL has no params", () => {
    expect(catalogSearchSchema.parse({})).toEqual({
      sort: "newest",
      page: 1,
    });
  });

  it("reads valid params and turns numbers into numbers", () => {
    expect(
      catalogSearchSchema.parse({
        q: "  night  ",
        genre: "Trap",
        mood: "Dark",
        key: "F# minor",
        bpmMin: "120",
        bpmMax: "150",
        maxPrice: "50",
        sort: "price-asc",
        page: "2",
      }),
    ).toEqual({
      q: "night",
      genre: "Trap",
      mood: "Dark",
      key: "F# minor",
      bpmMin: 120,
      bpmMax: 150,
      maxPrice: 50,
      sort: "price-asc",
      page: 2,
    });
  });

  it("treats empty fields from the form as not set", () => {
    expect(
      catalogSearchSchema.parse({
        q: "",
        genre: "",
        bpmMin: "",
        maxPrice: "",
        sort: "",
        page: "",
      }),
    ).toEqual({ sort: "newest", page: 1 });
  });

  it("ignores bad values instead of throwing", () => {
    expect(
      catalogSearchSchema.parse({
        q: "x".repeat(101),
        genre: ["Trap", "Drill"],
        bpmMin: "abc",
        bpmMax: "999",
        maxPrice: "12.5",
        sort: "cheapest",
        page: "-1",
        unknown: "dropped",
      }),
    ).toEqual({ sort: "newest", page: 1 });
  });

  it("falls back to page 1 for a page that's too big", () => {
    expect(catalogSearchSchema.parse({ page: "1001" }).page).toBe(1);
  });
});

describe("beatSlugSchema", () => {
  it("accepts a slug of lowercase letters, digits and dashes", () => {
    expect(beatSlugSchema.safeParse("midnight-drive-2").success).toBe(true);
    expect(beatSlugSchema.safeParse("a".repeat(100)).success).toBe(true);
  });

  it.each([
    "",
    "Midnight-Drive",
    "midnight drive",
    "../admin",
    "a".repeat(101),
  ])("rejects %j", (slug) => {
    expect(beatSlugSchema.safeParse(slug).success).toBe(false);
  });
});

describe("beatIdSchema", () => {
  it("accepts a UUID", () => {
    expect(
      beatIdSchema.safeParse("88171aa8-3ae3-498f-9f79-50ce2e3daa4e").success,
    ).toBe(true);
  });

  it.each([
    "",
    "midnight-drive",
    "88171aa8-3ae3-498f-9f79-50ce2e3daa4",
    "88171aa8-3ae3-498f-9f79-50ce2e3daa4e' OR 1=1",
    42,
    null,
  ])("rejects %j", (id) => {
    expect(beatIdSchema.safeParse(id).success).toBe(false);
  });
});

describe("cartItemsSchema", () => {
  const item = () => ({
    beatId: crypto.randomUUID(),
    licenseTierId: crypto.randomUUID(),
  });

  it("accepts an empty cart and a cart of different beats", () => {
    expect(cartItemsSchema.safeParse([]).success).toBe(true);
    expect(cartItemsSchema.safeParse([item(), item()]).success).toBe(true);
  });

  it("keeps only the two ids, so a price sent along is dropped", () => {
    const { beatId, licenseTierId } = item();
    expect(
      cartItemsSchema.parse([{ beatId, licenseTierId, priceCents: 1 }]),
    ).toEqual([{ beatId, licenseTierId }]);
  });

  it(`accepts ${MAX_CART_ITEMS} items but not one more`, () => {
    const full = Array.from({ length: MAX_CART_ITEMS }, item);
    expect(cartItemsSchema.safeParse(full).success).toBe(true);
    expect(cartItemsSchema.safeParse([...full, item()]).success).toBe(false);
  });

  const a = item();
  it.each([
    ["one item instead of a list", a],
    ["null", null],
    ["a slug as the beat id", [{ ...a, beatId: "midnight-drive" }]],
    ["a missing tier", [{ beatId: a.beatId }]],
    ["the same beat twice", [a, { ...item(), beatId: a.beatId }]],
  ])("rejects %s", (_label, value) => {
    expect(cartItemsSchema.safeParse(value).success).toBe(false);
  });
});
