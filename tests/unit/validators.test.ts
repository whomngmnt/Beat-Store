import { describe, expect, it } from "vitest";
import { catalogSearchSchema } from "../../src/lib/validators";

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
