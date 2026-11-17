import type { Metadata } from "next";
import { deleteCoupon, setCouponActive } from "@/actions/coupons";
import { UtcDate } from "@/components/admin/AdminLabels";
import { CouponForm } from "@/components/admin/CouponForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import { describeCoupon } from "@/lib/pricing";

export const metadata: Metadata = { title: "Coupons" };

// Coupon codes (PLAN.md §3). A coupon takes money off the leases in a
// cart, never off an Exclusive (see createCheckoutSession).
export default async function AdminCouponsPage() {
  await requireAdmin();

  const [coupons, paidUses] = await Promise.all([
    db.coupon.findMany({
      orderBy: { code: "asc" },
      include: { _count: { select: { orders: true } } },
    }),
    db.order.groupBy({
      by: ["couponId"],
      where: { status: "PAID", couponId: { not: null } },
      _count: { _all: true },
    }),
  ]);
  const paid = new Map(paidUses.map((row) => [row.couponId, row._count._all]));
  const now = new Date();

  return (
    <div className="flex max-w-4xl flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold">Coupons</h1>
        <p className="text-muted-foreground">
          Coupons apply to Basic, Premium and Trackout licenses, not to
          Exclusives.
        </p>
      </div>

      <section className="flex flex-col gap-3 rounded-lg border p-4">
        <h2 className="text-xl font-semibold">New coupon</h2>
        <CouponForm />
      </section>

      {coupons.length === 0 ? (
        <p className="text-muted-foreground">No coupons yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Code</th>
                <th className="px-3 py-2 font-medium">Discount</th>
                <th className="px-3 py-2 font-medium">Expires</th>
                <th className="px-3 py-2 font-medium">State</th>
                <th className="px-3 py-2 text-right font-medium">
                  Paid orders
                </th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {coupons.map((coupon) => {
                const expired =
                  coupon.expiresAt !== null && coupon.expiresAt <= now;
                return (
                  <tr key={coupon.id}>
                    <td className="px-3 py-2 font-mono">{coupon.code}</td>
                    <td className="px-3 py-2">{describeCoupon(coupon)}</td>
                    <td className="px-3 py-2">
                      {coupon.expiresAt ? (
                        <UtcDate date={coupon.expiresAt} />
                      ) : (
                        "Never"
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Badge
                        variant={
                          coupon.active && !expired ? "default" : "outline"
                        }
                      >
                        {expired ? "Expired" : coupon.active ? "On" : "Off"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {paid.get(coupon.id) ?? 0}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-2">
                        <form action={setCouponActive}>
                          <input
                            type="hidden"
                            name="couponId"
                            value={coupon.id}
                          />
                          <input
                            type="hidden"
                            name="active"
                            value={coupon.active ? "false" : "true"}
                          />
                          <Button type="submit" size="sm" variant="outline">
                            {coupon.active ? "Turn off" : "Turn on"}
                          </Button>
                        </form>
                        {/* A coupon an order points at stays, for that order. */}
                        {coupon._count.orders === 0 && (
                          <form action={deleteCoupon}>
                            <input
                              type="hidden"
                              name="couponId"
                              value={coupon.id}
                            />
                            <Button type="submit" size="sm" variant="ghost">
                              Delete
                            </Button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
