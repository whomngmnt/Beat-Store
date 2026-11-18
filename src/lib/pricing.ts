// Prices and coupon maths (PLAN.md §6). Money is integer cents everywhere.

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

// 2999 → "$29.99". The division by 100 happens only here, to show a price.
// Never use the result for maths.
export function formatPrice(cents: number): string {
  return usd.format(cents / 100);
}

// Adds up the prices of the lines in a cart. Prices come from the database
// as whole cents, so anything else (a decimal, a negative number) is a bug.
// It throws then, instead of showing or charging a wrong total.
export function cartTotalCents(prices: number[]): number {
  for (const price of prices) {
    if (!Number.isSafeInteger(price) || price < 0) {
      throw new Error(`Not a price in whole cents: ${price}`);
    }
  }
  return prices.reduce((total, price) => total + price, 0);
}

// Stripe's smallest charge in USD: $0.50. Every price, and every total
// after a coupon, must be at least this.
export const MIN_PRICE_CENTS = 50;

// What the admin types in a price field → cents: "29.99" → 2999, "30" →
// 3000, "0.5" → 50. The text is split at the dot and read as whole numbers,
// never as a float, so there's no rounding error. Null if it isn't a plain
// amount with at most 2 decimals (no "$", no comma, no minus). At most
// 999999.99, the most Stripe charges in one payment.
export function dollarsToCents(text: string): number | null {
  const match = /^(\d{1,6})(?:\.(\d{1,2}))?$/.exec(text.trim());
  if (!match) return null;
  const [, dollars, decimals = ""] = match;
  return Number(dollars) * 100 + Number(decimals.padEnd(2, "0"));
}

// 2999 → "29.99", for the value of a price field. Whole numbers only.
export function centsToDollars(cents: number): string {
  const rest = String(cents % 100).padStart(2, "0");
  return `${Math.floor(cents / 100)}.${rest}`;
}

// A coupon has exactly one of these (couponFormSchema checks that).
export type CouponTerms = {
  percentOff: number | null;
  amountOffCents: number | null;
};

// The discount a coupon gives on `cents`, in whole cents. A percent is
// rounded down, so the buyer never gets more than the percent: 15% of
// 2999 is 449.85, so 449. A fixed amount is at most `cents`, so what's
// left to pay never goes below zero.
export function couponDiscountCents(coupon: CouponTerms, cents: number) {
  if (!Number.isSafeInteger(cents) || cents < 0) {
    throw new Error(`Not an amount in whole cents: ${cents}`);
  }
  if (coupon.percentOff !== null) {
    return Math.floor((cents * coupon.percentOff) / 100);
  }
  return Math.min(coupon.amountOffCents ?? 0, cents);
}

// "15% off" or "$10.00 off", for the admin and the checkout message.
export function describeCoupon(coupon: CouponTerms) {
  return coupon.percentOff !== null
    ? `${coupon.percentOff}% off`
    : `${formatPrice(coupon.amountOffCents ?? 0)} off`;
}
