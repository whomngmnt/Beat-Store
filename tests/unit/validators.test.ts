import { describe, expect, it } from "vitest";
import { MAX_CART_ITEMS } from "../../src/lib/cart";
import {
  beatFormSchema,
  beatIdSchema,
  beatSlugSchema,
  cartItemsSchema,
  catalogSearchSchema,
  checkoutSessionIdSchema,
  couponCodeSchema,
  couponFormSchema,
  downloadParamsSchema,
  downloadTokenSchema,
  licenseTierFormSchema,
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

describe("beatFormSchema", () => {
  const form = {
    title: "Midnight Drive!",
    slug: "",
    description: "<script>alert(1)</script>",
    bpm: "140",
    musicalKey: "C minor",
    genre: "Trap",
    mood: "Dark",
    tags: " trap, dark,, trap , 808 ",
    featured: null,
  };

  it("makes the slug from the title and reads tags, BPM and the checkbox", () => {
    const beat = beatFormSchema.parse({ ...form, featured: "on" });
    expect(beat.slug).toBe("midnight-drive");
    expect(beat.tags).toEqual(["trap", "dark", "808"]);
    expect(beat.bpm).toBe(140);
    expect(beat.featured).toBe(true);
    // Plain text: kept exactly as typed. React escapes it when shown.
    expect(beat.description).toBe("<script>alert(1)</script>");
    expect(beatFormSchema.parse(form).featured).toBe(false);
  });

  it("refuses a bad slug, a missing title and an odd BPM", () => {
    expect(
      beatFormSchema.safeParse({ ...form, slug: "Bad Slug" }).success,
    ).toBe(false);
    expect(beatFormSchema.safeParse({ ...form, title: " " }).success).toBe(
      false,
    );
    expect(beatFormSchema.safeParse({ ...form, bpm: "12" }).success).toBe(
      false,
    );
    expect(beatFormSchema.safeParse({ ...form, bpm: "140.5" }).success).toBe(
      false,
    );
    // A title with no letters or digits gives an empty slug.
    expect(beatFormSchema.safeParse({ ...form, title: "!!!" }).success).toBe(
      false,
    );
  });
});

describe("licenseTierFormSchema", () => {
  const form = {
    tierId: "6f1c2a4e-8b3d-4e5f-9a7b-1c2d3e4f5a6b",
    name: "Basic Lease",
    description: "MP3, up to 5,000 streams",
    defaultPrice: "29.99",
    streamLimit: "5000",
    videoLimit: "",
    terms: "Non-exclusive.",
  };

  it("reads the price as cents and an empty limit as unlimited", () => {
    const tier = licenseTierFormSchema.parse(form);
    expect(tier.defaultPrice).toBe(2999);
    expect(tier.streamLimit).toBe(5000);
    expect(tier.videoLimit).toBeNull();
  });

  it("refuses a price under $0.50 and a limit that isn't a whole number", () => {
    for (const change of [
      { defaultPrice: "0.49" },
      { defaultPrice: "free" },
      { streamLimit: "0" },
      { streamLimit: "2.5" },
      { videoLimit: "lots" },
      { terms: "" },
    ]) {
      expect(
        licenseTierFormSchema.safeParse({ ...form, ...change }).success,
      ).toBe(false);
    }
  });
});

describe("coupon schemas", () => {
  it("store codes in capitals", () => {
    expect(couponCodeSchema.parse(" summer15 ")).toBe("SUMMER15");
    for (const bad of ["ab", "with space", "a".repeat(31), "<b>"]) {
      expect(couponCodeSchema.safeParse(bad).success).toBe(false);
    }
  });

  const form = { code: "save10", percentOff: "", amountOff: "", expiresOn: "" };

  it("take exactly one of percent off and amount off", () => {
    expect(couponFormSchema.parse({ ...form, percentOff: "15" })).toEqual({
      code: "SAVE10",
      percentOff: 15,
      amountOffCents: null,
      expiresAt: null,
    });
    expect(
      couponFormSchema.parse({ ...form, amountOff: "4.99" }).amountOffCents,
    ).toBe(499);
    expect(couponFormSchema.safeParse(form).success).toBe(false);
    expect(
      couponFormSchema.safeParse({ ...form, percentOff: "10", amountOff: "5" })
        .success,
    ).toBe(false);
    expect(
      couponFormSchema.safeParse({ ...form, percentOff: "101" }).success,
    ).toBe(false);
    expect(
      couponFormSchema.safeParse({ ...form, percentOff: "12.5" }).success,
    ).toBe(false);
  });

  it("make the expiry date last to the end of that day in UTC", () => {
    const coupon = couponFormSchema.parse({
      ...form,
      percentOff: "10",
      expiresOn: "2026-12-31",
    });
    expect(coupon.expiresAt?.toISOString()).toBe("2026-12-31T23:59:59.999Z");
    expect(
      couponFormSchema.safeParse({
        ...form,
        percentOff: "10",
        expiresOn: "31/12/2026",
      }).success,
    ).toBe(false);
  });
});
