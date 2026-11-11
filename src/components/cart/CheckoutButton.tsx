"use client";

import { useState } from "react";
import { createCheckoutSession } from "@/actions/checkout";
import { Button } from "@/components/ui/button";
import type { CartItem } from "@/lib/cart";

// Sends the cart's ids to the server, which creates the order and the
// Stripe session, then goes to Stripe's payment page. The browser sends no
// price: the server reads them all again.
export function CheckoutButton({
  items,
  disabled,
}: {
  items: CartItem[];
  disabled: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function checkout() {
    setPending(true);
    setError(null);
    const result = await createCheckoutSession(items).catch(() => ({
      error: "Couldn't start checkout. Please try again.",
    }));
    if ("url" in result) {
      // Stays "pending" while the browser leaves for Stripe.
      window.location.assign(result.url);
      return;
    }
    setError(result.error);
    setPending(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <Button size="lg" onClick={checkout} disabled={disabled || pending}>
        {pending ? "Going to checkout…" : "Checkout"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
