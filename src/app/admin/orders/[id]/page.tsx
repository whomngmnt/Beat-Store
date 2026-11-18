import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { resetDownload } from "@/actions/orders";
import {
  RefundForm,
  ReissueLinkForm,
} from "@/components/admin/OrderActionForms";
import { OrderStatusBadge, UtcDate } from "@/components/admin/AdminLabels";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import { formatPrice } from "@/lib/pricing";

export const metadata: Metadata = { title: "Order" };

const fileNames = { MP3: "MP3", WAV: "WAV", STEMS: "Stems (ZIP)" } as const;

// One order for the admin (PLAN.md §3): what was bought, how the payment
// went, and the fixes: reset a file's download count, make a new guest
// download link, refund the order.
export default async function AdminOrderPage({
  params,
}: PageProps<"/admin/orders/[id]">) {
  await requireAdmin();

  // Not a UUID means no such order, without asking the database.
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();

  const order = await db.order.findUnique({
    where: { id: id.data },
    include: {
      user: { select: { email: true } },
      coupon: { select: { code: true } },
      items: {
        orderBy: { beatTitleSnapshot: "asc" },
        include: { downloads: { orderBy: { fileType: "asc" } } },
      },
    },
  });
  if (!order) notFound();

  // What a refund now gives back: the total, minus any lost exclusive that
  // was already refunded on its own (that refund was the item's price).
  const alreadyRefundedCents = order.items
    .filter((item) => item.refundedAt !== null)
    .reduce((sum, item) => sum + item.priceCents, 0);
  const refundableCents = order.totalCents - alreadyRefundedCents;

  const details: [string, React.ReactNode][] = [
    ["Status", <OrderStatusBadge key="status" status={order.status} />],
    ["Total", formatPrice(order.totalCents)],
    ...(order.coupon
      ? ([["Coupon", order.coupon.code]] as [string, React.ReactNode][])
      : []),
    [
      "Buyer",
      order.user
        ? `${order.user.email} (signed in)`
        : (order.email ?? "Guest, email not known yet"),
    ],
    ["Created (UTC)", <UtcDate key="created" date={order.createdAt} />],
    [
      "Paid (UTC)",
      order.paidAt ? <UtcDate key="paid" date={order.paidAt} /> : "Not paid",
    ],
    [
      "Guest link expires (UTC)",
      order.downloadTokenExpiresAt ? (
        <UtcDate key="expires" date={order.downloadTokenExpiresAt} />
      ) : (
        "No guest link"
      ),
    ],
    ["Stripe Checkout Session", order.stripeSessionId ?? "None"],
    ["Stripe PaymentIntent", order.stripePaymentIntentId ?? "None"],
  ];

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <div className="flex flex-col gap-1">
        <Link href="/admin/orders" className="text-sm text-muted-foreground">
          ← Orders
        </Link>
        <h1 className="text-3xl font-semibold">Order</h1>
        <p className="font-mono text-xs text-muted-foreground">{order.id}</p>
      </div>

      {order.reviewNote && (
        <p role="alert" className="rounded-lg border p-3 text-destructive">
          Needs review: {order.reviewNote}
        </p>
      )}

      <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
        {details.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="break-all">{value}</dd>
          </div>
        ))}
      </dl>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Items and downloads</h2>
        <ul className="flex flex-col divide-y rounded-lg border px-4">
          {order.items.map((item) => (
            <li key={item.id} className="flex flex-col gap-2 py-3">
              <div className="flex justify-between gap-3">
                <span className="font-medium">
                  {item.beatTitleSnapshot} · {item.licenseNameSnapshot}
                </span>
                <span>{formatPrice(item.priceCents)}</span>
              </div>
              {item.refundNeeded && (
                <p className="text-sm text-destructive">
                  Lost exclusive:{" "}
                  {item.refundedAt
                    ? "refunded automatically."
                    : "refund not through yet (the cron job retries it)."}
                </p>
              )}
              {item.downloads.map((download) => (
                <form
                  key={download.id}
                  action={resetDownload}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <input type="hidden" name="downloadId" value={download.id} />
                  <span>
                    {fileNames[download.fileType]}: {download.count} of{" "}
                    {download.maxCount} downloads used
                  </span>
                  <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    disabled={download.count === 0}
                  >
                    Reset to 0
                  </Button>
                </form>
              ))}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Guest download link</h2>
        <p className="text-sm text-muted-foreground">
          For a buyer who lost their link. Signed-in buyers can also download
          from their account page.
        </p>
        <ReissueLinkForm orderId={order.id} />
      </section>

      {order.status === "PAID" && refundableCents > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">Refund</h2>
          <p className="text-sm text-muted-foreground">
            Refunds everything that hasn&apos;t been refunded yet, in Stripe
            test mode. The buyer&apos;s downloads stop when the order turns
            REFUNDED. An exclusive beat stays SOLD.
          </p>
          <RefundForm
            orderId={order.id}
            amount={formatPrice(refundableCents)}
          />
        </section>
      )}
    </div>
  );
}
