import type { Metadata } from "next";
import Link from "next/link";
import { ClearCart } from "@/components/cart/ClearCart";
import { buttonVariants } from "@/components/ui/button";
import { confirmCheckout } from "@/lib/fulfilment";
import { formatPrice } from "@/lib/pricing";
import { checkoutSessionIdSchema } from "@/lib/validators";

export const metadata: Metadata = {
  title: "Your order",
  robots: { index: false },
};

const fileNames = { MP3: "MP3", WAV: "WAV", STEMS: "Stems (ZIP)" } as const;

// Where Stripe sends the buyer after paying (PLAN.md §5.2, step 8).
// `session_id` is only a lookup key: confirmCheckout() reads the order from
// the database and the payment from Stripe, and if the webhook hasn't
// arrived yet it fulfils the order itself. So the files show here even
// without the webhook. Reading searchParams renders the page per request.
export default async function CheckoutSuccessPage({
  searchParams,
}: PageProps<"/checkout/success">) {
  const sessionId = checkoutSessionIdSchema.safeParse(
    (await searchParams).session_id,
  );
  const order = sessionId.success
    ? await confirmCheckout(sessionId.data)
    : null;

  if (!order) {
    return (
      <Notice title="Order not found">
        We couldn&apos;t find an order for this link.
      </Notice>
    );
  }
  if (order.status === "PENDING") {
    return (
      <Notice title="Confirming your payment">
        {order.reviewNote
          ? "There's a problem with this payment. We're looking into it and will contact you."
          : "Your payment hasn't been confirmed yet. Reload this page in a moment."}
      </Notice>
    );
  }
  if (order.status === "EXPIRED" || order.status === "FAILED") {
    return (
      <Notice title="Checkout not completed">
        This checkout ended without a payment. Your cart is still saved.
      </Notice>
    );
  }

  // PAID or REFUNDED
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      {order.status === "PAID" && <ClearCart />}
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold">
          {order.status === "PAID" ? "Thanks for your order" : "Order refunded"}
        </h1>
        {order.status === "PAID" && order.email && (
          <p className="text-muted-foreground">Paid by {order.email}</p>
        )}
        {order.status === "REFUNDED" && (
          <p className="text-muted-foreground">
            This order was refunded, so its downloads are off.
          </p>
        )}
      </div>

      <ul className="flex flex-col divide-y">
        {order.items.map((item) => (
          <li key={item.id} className="flex flex-col gap-1 py-3">
            <div className="flex justify-between gap-3">
              <span className="font-medium">
                {item.beatTitleSnapshot} · {item.licenseNameSnapshot}
              </span>
              <span>{formatPrice(item.priceCents)}</span>
            </div>
            {item.refundNeeded ? (
              <p className="text-sm text-destructive">
                Another buyer got this exclusive just before your payment went
                through. This item is refunded in full.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Files:{" "}
                {item.downloads
                  .map((download) => fileNames[download.fileType])
                  .join(", ")}
              </p>
            )}
          </li>
        ))}
      </ul>

      <div className="flex justify-between border-t pt-3 font-medium">
        <span>Total paid</span>
        <span>{formatPrice(order.totalCents)}</span>
      </div>

      {/* Phase 6 adds the download buttons and the guest download link. */}
      {order.status === "PAID" && (
        <p className="text-sm text-muted-foreground">
          Download buttons for these files arrive in the next update.
        </p>
      )}
    </div>
  );
}

function Notice({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-start gap-3">
      <h1 className="text-3xl font-semibold">{title}</h1>
      <p className="text-muted-foreground">{children}</p>
      <Link href="/cart" className={buttonVariants({ variant: "outline" })}>
        Back to cart
      </Link>
    </div>
  );
}
