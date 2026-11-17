// The admin dashboard's numbers (PLAN.md §3). Revenue counts PAID orders,
// minus items refunded after the payment (an exclusive another buyer got
// first). REFUNDED orders count as nothing. All of it is test-mode money.
import { db } from "@/lib/db";

export const DASHBOARD_DAYS = 30;

// "2026-11-17": the day in UTC, like every date in the admin.
const dayKey = (date: Date) => date.toISOString().slice(0, 10);

// One entry per day for the `days` days up to and including `today` (UTC),
// oldest first, with the sum of what was paid that day. Days without sales
// are 0, so the chart has no gaps.
export function dailyTotals(
  payments: { paidAt: Date; cents: number }[],
  days: number,
  today: Date,
) {
  const totals = new Map<string, number>();
  for (let back = days - 1; back >= 0; back--) {
    const day = new Date(today);
    day.setUTCDate(day.getUTCDate() - back);
    totals.set(dayKey(day), 0);
  }
  for (const payment of payments) {
    const key = dayKey(payment.paidAt);
    const total = totals.get(key);
    if (total !== undefined) totals.set(key, total + payment.cents);
  }
  return [...totals].map(([day, cents]) => ({ day, cents }));
}

const refundedItems = {
  where: { refundedAt: { not: null } },
  select: { priceCents: true },
} as const;

export async function getDashboard(now = new Date()) {
  const since = new Date(now);
  since.setUTCDate(since.getUTCDate() - (DASHBOARD_DAYS - 1));
  since.setUTCHours(0, 0, 0, 0);

  const [paid, refunded, recentOrders, plays, published, topSales, topPlays] =
    await Promise.all([
      db.order.aggregate({
        where: { status: "PAID" },
        _sum: { totalCents: true },
        _count: true,
      }),
      db.orderItem.aggregate({
        where: { order: { status: "PAID" }, refundedAt: { not: null } },
        _sum: { priceCents: true },
      }),
      db.order.findMany({
        where: { status: "PAID", paidAt: { gte: since } },
        select: { paidAt: true, totalCents: true, items: refundedItems },
      }),
      db.beat.aggregate({ _sum: { plays: true } }),
      db.beat.count({ where: { status: "PUBLISHED" } }),
      // Item prices are before any coupon: a coupon is on the whole order.
      db.orderItem.groupBy({
        by: ["beatId"],
        where: { order: { status: "PAID" }, refundedAt: null },
        _sum: { priceCents: true },
        _count: { _all: true },
        orderBy: { _sum: { priceCents: "desc" } },
        take: 5,
      }),
      db.beat.findMany({
        where: { plays: { gt: 0 } },
        orderBy: { plays: "desc" },
        take: 5,
        select: { id: true, title: true, plays: true },
      }),
    ]);

  const titles = new Map(
    (
      await db.beat.findMany({
        where: { id: { in: topSales.map((row) => row.beatId) } },
        select: { id: true, title: true },
      })
    ).map((beat) => [beat.id, beat.title]),
  );

  return {
    revenueCents: (paid._sum.totalCents ?? 0) - (refunded._sum.priceCents ?? 0),
    paidOrders: paid._count,
    plays: plays._sum.plays ?? 0,
    publishedBeats: published,
    revenueByDay: dailyTotals(
      recentOrders.map((order) => ({
        paidAt: order.paidAt!, // the filter above skips orders without one
        cents:
          order.totalCents -
          order.items.reduce((sum, item) => sum + item.priceCents, 0),
      })),
      DASHBOARD_DAYS,
      now,
    ),
    topSales: topSales.map((row) => ({
      id: row.beatId,
      title: titles.get(row.beatId) ?? "Deleted beat",
      cents: row._sum.priceCents ?? 0,
      sold: row._count._all,
    })),
    topPlays,
  };
}
