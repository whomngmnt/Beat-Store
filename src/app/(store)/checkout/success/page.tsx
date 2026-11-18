import type { Metadata } from "next";
import Link from "next/link";
import { ClearCart } from "@/components/cart/ClearCart";
import { OrderItemList } from "@/components/orders/OrderItemList";
import { buttonVariants } from "@/components/ui/button";
import { confirmCheckout } from "@/lib/fulfilment";
import { formatPrice } from "@/lib/pricing";
import { tokenMatches } from "@/lib/tokens";
import { checkoutSessionIdSchema, downloadTokenSchema } from "@/lib/validators";

export const metadata: Metadata = {
  title: "Your order",
  robots: { index: false },
};

// Where Stripe sends the buyer after paying (PLAN.md §5.2, step 8).
// `session_id` is only a lookup key: confirmCheckout() reads the order from
// the database and the payment from Stripe, and if the webhook hasn't
// arrived yet it fulfils the order itself. So the files show here even
// without the webhook. Reading searchParams renders the page per request.
//
// The URL also carries the guest download token (`token`, PLAN.md §5.1),
// so this page is the buyer's bookmarkable download link. The download
// buttons show only when the token matches this order and hasn't expired.
export default async function CheckoutSuccessPage({
  searchParams,
}: PageProps<"/checkout/success">) {
  const params = await searchParams;
  const sessionId = checkoutSessionIdSchema.safeParse(params.session_id);
  const token = downloadTokenSchema.safeParse(params.token);
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

  // PAID or REFUNDED. The raw token is used only in the links below, and
  // only once it's known to be this order's.
  const downloadToken =
    order.status === "PAID" &&
    token.success &&
    tokenMatches(
      token.data,
      order.downloadTokenHash,
      order.downloadTokenExpiresAt,
    )
      ? token.data
      : null;

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

      <OrderItemList
        items={order.items}
        showDownloads={downloadToken !== null}
        token={downloadToken ?? undefined}
      />

      {order.coupon && (
        // The total is the items minus the coupon (createCheckoutSession).
        <div className="flex justify-between border-t pt-3 text-sm text-muted-foreground">
          <span>Coupon {order.coupon.code}</span>
          <span>
            −
            {formatPrice(
              order.items.reduce((sum, item) => sum + item.priceCents, 0) -
                order.totalCents,
            )}
          </span>
        </div>
      )}

      <div className="flex justify-between border-t pt-3 font-medium">
        <span>Total paid</span>
        <span>{formatPrice(order.totalCents)}</span>
      </div>

      {downloadToken && order.downloadTokenExpiresAt ? (
        <p className="text-sm text-muted-foreground">
          Bookmark this page: it&apos;s your download link until{" "}
          {order.downloadTokenExpiresAt.toLocaleDateString("en-US", {
            dateStyle: "long",
            timeZone: "UTC",
          })}
          . Keep it private, because anyone with the link can download your
          files.
        </p>
      ) : (
        order.status === "PAID" && (
          <p className="text-sm text-muted-foreground">
            This download link is incomplete or has expired. Please{" "}
            <Link href="/contact" className="underline underline-offset-4">
              contact support
            </Link>{" "}
            for a new one.
          </p>
        )
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
