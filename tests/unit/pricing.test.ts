import { describe, expect, it } from "vitest";
import { cartTotalCents, formatPrice } from "../../src/lib/pricing";

describe("formatPrice", () => {
  it("formats integer cents as US dollars", () => {
    expect(formatPrice(2999)).toBe("$29.99");
    expect(formatPrice(49900)).toBe("$499.00");
    expect(formatPrice(0)).toBe("$0.00");
    expect(formatPrice(123456)).toBe("$1,234.56");
  });
});

describe("cartTotalCents", () => {
  it("is 0 for an empty cart", () => {
    expect(cartTotalCents([])).toBe(0);
  });

  it("adds up the prices in cents", () => {
    expect(cartTotalCents([2999])).toBe(2999);
    expect(cartTotalCents([2999, 4999, 9999, 49999])).toBe(67996);
  });

  it.each([29.99, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "throws on %s, which isn't a price in whole cents",
    (bad) => {
      expect(() => cartTotalCents([2999, bad])).toThrow(
        "Not a price in whole cents",
      );
    },
  );
});
