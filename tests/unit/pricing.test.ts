import { describe, expect, it } from "vitest";
import { formatPrice } from "../../src/lib/pricing";

describe("formatPrice", () => {
  it("formats integer cents as US dollars", () => {
    expect(formatPrice(2999)).toBe("$29.99");
    expect(formatPrice(49900)).toBe("$499.00");
    expect(formatPrice(0)).toBe("$0.00");
    expect(formatPrice(123456)).toBe("$1,234.56");
  });
});
