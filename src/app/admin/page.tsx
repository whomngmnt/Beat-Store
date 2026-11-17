import type { Metadata } from "next";
import { DayBars, RankBars } from "@/components/admin/Bars";
import { requireAdmin } from "@/lib/auth-guards";
import { DASHBOARD_DAYS, getDashboard } from "@/lib/dashboard";
import { formatPrice } from "@/lib/pricing";

export const metadata: Metadata = { title: "Dashboard" };

// The admin's overview (PLAN.md §3): revenue, orders, plays, and which
// beats sell and get played. Test-mode money only.
export default async function AdminDashboardPage() {
  await requireAdmin();
  const stats = await getDashboard();

  const tiles = [
    { label: "Revenue (test mode)", value: formatPrice(stats.revenueCents) },
    { label: "Paid orders", value: stats.paidOrders.toLocaleString("en-US") },
    { label: "Preview plays", value: stats.plays.toLocaleString("en-US") },
    { label: "Published beats", value: String(stats.publishedBeats) },
  ];

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-3xl font-semibold">Dashboard</h1>

      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className="flex flex-col gap-1 rounded-lg border p-4"
          >
            <dt className="text-sm text-muted-foreground">{tile.label}</dt>
            <dd className="text-2xl font-semibold">{tile.value}</dd>
          </div>
        ))}
      </dl>

      <section className="flex flex-col gap-3 rounded-lg border p-4">
        <h2 className="font-semibold">
          Revenue by day, last {DASHBOARD_DAYS} days (UTC)
        </h2>
        <DayBars
          label="Revenue by day"
          days={stats.revenueByDay.map((day) => ({
            day: day.day,
            value: day.cents,
          }))}
          format={formatPrice}
        />
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="flex flex-col gap-3 rounded-lg border p-4">
          <h2 className="font-semibold">Top beats by sales</h2>
          <p className="-mt-2 text-xs text-muted-foreground">
            License prices before coupons, paid orders only.
          </p>
          <RankBars
            empty="No sales yet."
            rows={stats.topSales.map((beat) => ({
              id: beat.id,
              label: beat.title,
              value: beat.cents,
              text: `${formatPrice(beat.cents)} · ${beat.sold} sold`,
            }))}
          />
        </section>
        <section className="flex flex-col gap-3 rounded-lg border p-4">
          <h2 className="font-semibold">Most played previews</h2>
          <RankBars
            empty="No plays yet."
            rows={stats.topPlays.map((beat) => ({
              id: beat.id,
              label: beat.title,
              value: beat.plays,
              text: `${beat.plays.toLocaleString("en-US")} plays`,
            }))}
          />
        </section>
      </div>
    </div>
  );
}
