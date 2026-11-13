import { describe, expect, it } from "vitest";
import { MAX_CART_ITEMS } from "../../src/lib/cart";
import {
  beatIdSchema,
  beatSlugSchema,
  cartItemsSchema,
  catalogSearchSchema,
  checkoutSessionIdSchema,
  downloadParamsSchema,
  downloadTokenSchema,
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

describe("checkoutSessionIdSchema", () => {
  it("accepts a test-mode Checkout Session id", () => {
    expect(
      checkoutSessionIdSchema.safeParse("cs_test_a1B2c3D4e5F6g7H8").success,
    ).toBe(true);
  });

  it.each([
    ["a live-mode id", "cs_live_a1B2c3"],
    ["another kind of id", "pi_test_a1B2c3"],
    ["the unfilled template", "{CHECKOUT_SESSION_ID}"],
    ["SQL", "cs_test_1' OR '1'='1"],
    ["an array", ["cs_test_a1", "cs_test_b2"]],
    ["nothing", undefined],
  ])("rejects %s", (_label, value) => {
    expect(checkoutSessionIdSchema.safeParse(value).success).toBe(false);
  });
});

describe("downloadTokenSchema", () => {
  it("accepts 43 base64url characters", () => {
    const token = "aB3_-".repeat(8) + "xyz";
    expect(downloadTokenSchema.safeParse(token).success).toBe(true);
  });

  it.each([
    ["a token one character short", "a".repeat(42)],
    ["a token one character long", "a".repeat(44)],
    ["base64 padding or +/", "a".repeat(41) + "+/"],
    ["SQL", "' OR '1'='1" + "a".repeat(32)],
    ["an array", ["a".repeat(43), "b".repeat(43)]],
    ["nothing", undefined],
  ])("rejects %s", (_label, value) => {
    expect(downloadTokenSchema.safeParse(value).success).toBe(false);
  });
});

describe("downloadParamsSchema", () => {
  const orderItemId = "7f9c2ba4-e88f-41d1-8d3b-0d4a1c0e6f53";

  it.each(["MP3", "WAV", "STEMS"])("accepts the %s file type", (fileType) => {
    expect(
      downloadParamsSchema.safeParse({ orderItemId, fileType }).success,
    ).toBe(true);
  });

  it.each([
    ["an id that isn't a UUID", { orderItemId: "1", fileType: "MP3" }],
    ["a lowercase file type", { orderItemId, fileType: "mp3" }],
    ["another file type", { orderItemId, fileType: "LICENSE" }],
    ["a path", { orderItemId, fileType: "../../.env" }],
  ])("rejects %s", (_label, params) => {
    expect(downloadParamsSchema.safeParse(params).success).toBe(false);
  });
});
