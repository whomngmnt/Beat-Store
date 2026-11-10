"use client";

import { useEffect } from "react";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/store/cart";

// The cart icon in the header: shows how many beats are in the cart and
// opens the drawer.
export function CartButton() {
  const count = useCartStore((state) => state.items.length);

  // Read the saved cart once the page is in the browser. The header is on
  // every store page, so this runs on every full page load. Effects never
  // run on the server, where `persist` doesn't exist (src/store/cart.ts).
  useEffect(() => {
    useCartStore.persist.rehydrate();
  }, []);

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={count === 0 ? "Cart" : `Cart, ${count} in cart`}
      onClick={() => useCartStore.getState().setOpen(true)}
      className="relative"
    >
      <ShoppingCart aria-hidden />
      {count > 0 && (
        <span
          aria-hidden
          className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground"
        >
          {count}
        </span>
      )}
    </Button>
  );
}
