import { describe, expect, it } from "vitest";
import { MAX_CART_ITEMS, parseSavedCart } from "../../src/lib/cart";
import { cartItemsSchema } from "../../src/lib/validators";

const item = () => ({
  beatId: crypto.randomUUID(),
  licenseTierId: crypto.randomUUID(),
});
const a = item();
const b = item();

// Good carts, and broken ones, for both checks below.
const good: [string, unknown][] = [
  ["an empty cart", []],
  ["two beats", [a, b]],
  [
    "upper-case ids",
    [{ beatId: a.beatId.toUpperCase(), licenseTierId: a.licenseTierId }],
  ],
  ["a full cart", Array.from({ length: MAX_CART_ITEMS }, item)],
];
const bad: [string, unknown][] = [
  ["one item instead of a list", a],
  ["null", null],
  ["a string", "[]"],
  ["one item too many", Array.from({ length: MAX_CART_ITEMS + 1 }, item)],
  ["null in the list", [null]],
  ["a slug as the beat id", [{ ...a, beatId: "midnight-drive" }]],
  ["a number as the tier id", [{ ...a, licenseTierId: 42 }]],
  ["a missing tier", [{ beatId: a.beatId }]],
  ["an id with SQL after it", [{ ...a, beatId: `${a.beatId}' OR 1=1` }]],
  // Right shape, but not a real UUID (version digit 0), which z.uuid() rejects.
  [
    "a UUID-shaped id that isn't one",
    [{ ...a, beatId: "88171aa8-3ae3-098f-9f79-50ce2e3daa4e" }],
  ],
  ["the same beat twice", [a, { ...b, beatId: a.beatId }]],
];

describe("parseSavedCart", () => {
  it.each(good)("accepts %s", (_label, value) => {
    expect(parseSavedCart(value)).toEqual(value);
  });

  it.each(bad)("rejects %s", (_label, value) => {
    expect(parseSavedCart(value)).toBeNull();
  });

  it("keeps only the two ids, so a price someone added is dropped", () => {
    expect(parseSavedCart([{ ...a, priceCents: 1 }])).toEqual([a]);
  });

  // If the browser kept a cart the server then refused, the cart page
  // would be stuck on "Couldn't load your cart".
  it.each([...good, ...bad])(
    "never accepts a cart the server would refuse: %s",
    (_label, value) => {
      if (parseSavedCart(value) !== null) {
        expect(cartItemsSchema.safeParse(value).success).toBe(true);
      }
    },
  );
});
