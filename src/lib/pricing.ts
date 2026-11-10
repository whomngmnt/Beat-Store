// Prices (PLAN.md §6). Money is integer cents everywhere. Coupon maths comes
// here in Phase 8, with Coupons CRUD.

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
