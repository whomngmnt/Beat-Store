import { describe, expect, it } from "vitest";
import {
  cartTotalCents,
  centsToDollars,
  couponDiscountCents,
  describeCoupon,
  dollarsToCents,
  formatPrice,
} from "../../src/lib/pricing";

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

describe("dollarsToCents", () => {
  it("reads a typed price as whole cents, without float maths", () => {
    expect(dollarsToCents("29.99")).toBe(2999);
    expect(dollarsToCents("30")).toBe(3000);
    expect(dollarsToCents("0.5")).toBe(50);
    expect(dollarsToCents(" 499.00 ")).toBe(49900);
    // 0.1 + 0.2 style float errors can't happen: 1.15 * 100 is 114.999… as a float.
    expect(dollarsToCents("1.15")).toBe(115);
    expect(dollarsToCents("999999.99")).toBe(99999999);
  });

  it("refuses anything that isn't a plain amount", () => {
    for (const text of [
      "",
      "abc",
      "-5",
      "$10",
      "1,000",
      "1.999",
      "1e3",
      "1000000",
    ]) {
      expect(dollarsToCents(text)).toBeNull();
    }
  });
});

describe("centsToDollars", () => {
  it("writes cents as a price field value", () => {
    expect(centsToDollars(2999)).toBe("29.99");
    expect(centsToDollars(3000)).toBe("30.00");
    expect(centsToDollars(5)).toBe("0.05");
    expect(dollarsToCents(centsToDollars(12345))).toBe(12345);
  });
});

describe("couponDiscountCents", () => {
  const percent = (percentOff: number) => ({
    percentOff,
    amountOffCents: null,
  });
  const amount = (amountOffCents: number) => ({
    percentOff: null,
    amountOffCents,
  });

  it("rounds a percent down to whole cents", () => {
    expect(couponDiscountCents(percent(15), 2999)).toBe(449); // 449.85
    expect(couponDiscountCents(percent(10), 4999)).toBe(499); // 499.9
    expect(couponDiscountCents(percent(50), 1000)).toBe(500);
    expect(couponDiscountCents(percent(100), 2999)).toBe(2999);
    expect(couponDiscountCents(percent(1), 50)).toBe(0); // 0.5
  });

  it("never takes off more than the amount", () => {
    expect(couponDiscountCents(amount(1000), 2999)).toBe(1000);
    expect(couponDiscountCents(amount(5000), 2999)).toBe(2999);
  });

  it("refuses an amount that isn't whole cents", () => {
    expect(() => couponDiscountCents(percent(10), 29.99)).toThrow();
    expect(() => couponDiscountCents(amount(100), -1)).toThrow();
  });

  it("describes a coupon", () => {
    expect(describeCoupon(percent(15))).toBe("15% off");
    expect(describeCoupon(amount(1000))).toBe("$10.00 off");
  });
});
