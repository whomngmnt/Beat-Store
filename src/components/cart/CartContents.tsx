"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { getCart } from "@/actions/cart";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatPrice } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import type { CartItem } from "@/lib/cart";
import { useCartStore } from "@/store/cart";

type Cart = Awaited<ReturnType<typeof getCart>>;

// The cart's lines and total, in the drawer and on /cart. The browser only
// has the ids. Titles, tiers and prices come from getCart, which reads them
// from the database every time the cart changes.
export function CartContents() {
  const items = useCartStore((state) => state.items);
  const hydrated = useCartStore((state) => state.hydrated);
  // The server's last answer, and the items it was for.
  const [loaded, setLoaded] = useState<{
    items: CartItem[];
    cart: Cart;
  } | null>(null);

  useEffect(() => {
    if (!hydrated || items.length === 0) return;
    // If the cart changes before the answer arrives, that answer is for an
    // old cart, so it's dropped.
    let current = true;
    getCart(items)
      .catch(() => null) // a network or server error shows like a bad cart
      .then((cart) => {
        if (current) setLoaded({ items, cart });
      });
    return () => {
      current = false;
    };
  }, [hydrated, items]);

  // Links close the drawer. On /cart it's already closed, so no harm.
  const close = () => useCartStore.getState().setOpen(false);

  if (!hydrated) return <Loading />;
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-muted-foreground">Your cart is empty.</p>
        <Link href="/beats" onClick={close} className={buttonVariants()}>
          Browse beats
        </Link>
      </div>
    );
  }
  if (!loaded) return <Loading />;
  if (!loaded.cart) {
    return (
      <p className="text-muted-foreground">
        Couldn&apos;t load your cart. Try again in a moment.
      </p>
    );
  }

  const { lines, totalCents } = loaded.cart;
  // After a change, the old answer stays on screen, dimmed, until the new
  // one arrives. That avoids a flash of "Loading" on every Remove.
  const stale = loaded.items !== items;

  return (
    <div
      aria-busy={stale}
      className={cn("flex flex-col gap-4", stale && "opacity-60")}
    >
      <ul className="flex flex-col divide-y">
        {lines.map((line) => (
          <li key={line.beatId} className="flex items-start gap-3 py-3">
            <div className="flex min-w-0 flex-1 flex-col">
              {line.slug ? (
                <Link
                  href={`/beats/${line.slug}`}
                  onClick={close}
                  className="truncate font-medium hover:underline"
                >
                  {line.title}
                </Link>
              ) : (
                <span className="font-medium">Unknown beat</span>
              )}
              {line.tierName && (
                <span className="text-muted-foreground">{line.tierName}</span>
              )}
              {line.problem && (
                <span className="text-destructive">{line.problem}</span>
              )}
            </div>
            {line.priceCents !== null && (
              <span className="font-medium">
                {formatPrice(line.priceCents)}
              </span>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove ${line.title ?? "unknown beat"} from cart`}
              onClick={() => useCartStore.getState().remove(line.beatId)}
            >
              <X aria-hidden />
            </Button>
          </li>
        ))}
      </ul>

      <div className="flex justify-between border-t pt-3 font-medium">
        <span>Total</span>
        <span>{formatPrice(totalCents)}</span>
      </div>
      {lines.some((line) => line.problem !== null) && (
        <p className="text-sm text-muted-foreground">
          Lines marked in red can&apos;t be bought right now and aren&apos;t in
          the total.
        </p>
      )}
    </div>
  );
}

function Loading() {
  return <p className="text-muted-foreground">Loading your cart…</p>;
}
