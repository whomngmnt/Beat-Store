// Prices (PLAN.md §6). Money is integer cents everywhere. The cart totals,
// coupons and bundle deal come here in Phase 4.

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

// 2999 → "$29.99". The division by 100 happens only here, to show a price.
// Never use the result for maths.
export function formatPrice(cents: number): string {
  return usd.format(cents / 100);
}
