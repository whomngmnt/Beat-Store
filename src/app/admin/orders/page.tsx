import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { OrderStatusBadge, UtcDate } from "@/components/admin/AdminLabels";
import { requireAdmin } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import { formatPrice } from "@/lib/pricing";

export const metadata: Metadata = { title: "Orders" };

const PAGE_SIZE = 25;

// ?page= from the URL. A bad value means page 1, so `parse` never throws.
const pageSchema = z.coerce.number().int().min(1).max(10_000).catch(1);

// Every order, newest first, 25 per page (PLAN.md §3). Each row opens the
// order's page, where the refund and download fixes are.
export default async function AdminOrdersPage({
  searchParams,
}: PageProps<"/admin/orders">) {
  await requireAdmin();
  const page = pageSchema.parse((await searchParams).page);

  const [orders, total] = await Promise.all([
    db.order.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        createdAt: true,
        status: true,
        totalCents: true,
        email: true,
        user: { select: { email: true } },
        _count: { select: { items: true } },
      },
    }),
    db.order.count(),
  ]);
  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold">Orders</h1>
        <p className="text-muted-foreground">{total} orders</p>
      </div>

      {orders.length === 0 ? (
        <p className="text-muted-foreground">No orders on this page.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Date (UTC)</th>
                <th className="px-3 py-2 font-medium">Buyer</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium">Items</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="underline-offset-4 hover:underline"
                    >
                      <UtcDate date={order.createdAt} />
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    {/* A guest's email comes from Stripe after payment, so
                        an unpaid guest order has none yet. */}
                    {order.user?.email ?? order.email ?? "Not known yet"}
                  </td>
                  <td className="px-3 py-2">
                    <OrderStatusBadge status={order.status} />
                  </td>
                  <td className="px-3 py-2 text-right">{order._count.items}</td>
                  <td className="px-3 py-2 text-right">
                    {formatPrice(order.totalCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <nav className="flex items-center justify-center gap-4 text-sm">
          {page > 1 && (
            <Link href={`/admin/orders?page=${page - 1}`}>Previous</Link>
          )}
          <span className="text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link href={`/admin/orders?page=${page + 1}`}>Next</Link>
          )}
        </nav>
      )}
    </div>
  );
}
