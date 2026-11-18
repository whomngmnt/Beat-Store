import type { Metadata } from "next";
import Link from "next/link";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { OrderItemList } from "@/components/orders/OrderItemList";
import { buttonVariants } from "@/components/ui/button";
import { getAccountOrders } from "@/lib/account";
import { requireUser } from "@/lib/auth-guards";
import { formatPrice } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false },
};

// The signed-in buyer's orders, with re-downloads (PLAN.md §5.3).
// requireUser() sends a signed-out visitor to /sign-in. The download links
// carry no token: the download route checks that the signed-in user owns
// the order, with the same rule as this list (src/lib/account.ts).
export default async function AccountPage() {
  const user = await requireUser();
  const orders = await getAccountOrders(user);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      {/* On a phone the buttons go under the title: side by side they
          don't fit. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold">Your account</h1>
          <p className="text-muted-foreground">Signed in as {user.email}</p>
        </div>
        <div className="flex gap-2">
          {/* Only a link: the admin pages check requireAdmin() themselves. */}
          {user.role === "ADMIN" && (
            <Link href="/admin" className={buttonVariants()}>
              Admin panel
            </Link>
          )}
          <SignOutButton />
        </div>
      </div>

      {!user.emailVerified && (
        <p className="text-sm text-muted-foreground">
          Google hasn&apos;t verified this email address, so orders you made
          without signing in aren&apos;t shown here.
        </p>
      )}

      {orders.length === 0 ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-muted-foreground">No orders yet.</p>
          <Link href="/beats" className={buttonVariants()}>
            Browse beats
          </Link>
        </div>
      ) : (
        orders.map((order) => (
          <section
            key={order.id}
            className="flex flex-col gap-1 rounded-lg border px-4 py-2"
          >
            <div className="flex justify-between gap-3 pt-2 text-sm text-muted-foreground">
              <span>
                {(order.paidAt ?? order.createdAt).toLocaleDateString("en-US", {
                  dateStyle: "long",
                  timeZone: "UTC",
                })}
              </span>
              <span>
                {order.status === "REFUNDED"
                  ? "Refunded"
                  : `Paid ${formatPrice(order.totalCents)}`}
              </span>
            </div>
            <OrderItemList
              items={order.items}
              showDownloads={order.status === "PAID"}
            />
          </section>
        ))
      )}
    </div>
  );
}
