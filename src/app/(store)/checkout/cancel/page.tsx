import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Checkout cancelled",
  robots: { index: false },
};

// Where Stripe's back button leads. Nothing was paid. The order stays
// PENDING until its Stripe session expires (31 minutes); the
// checkout.session.expired webhook then marks it EXPIRED and frees any
// exclusive it held.
export default function CheckoutCancelPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-start gap-3">
      <h1 className="text-3xl font-semibold">Checkout cancelled</h1>
      <p className="text-muted-foreground">
        Nothing was charged. Your cart is still saved.
      </p>
      <Link href="/cart" className={buttonVariants()}>
        Back to cart
      </Link>
    </div>
  );
}
