"use client";

import Link from "next/link";
import { CartContents } from "@/components/cart/CartContents";
import { buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useCartStore } from "@/store/cart";

// The cart, sliding in from the right. It's open while `isOpen` in the cart
// store is true: CartButton and "Add to cart" open it. The close button,
// Escape, a click outside it and the links in it close it.
export function CartDrawer() {
  const isOpen = useCartStore((state) => state.isOpen);
  const setOpen = useCartStore((state) => state.setOpen);

  return (
    <Sheet open={isOpen} onOpenChange={setOpen}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Cart</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4">
          <CartContents />
        </div>
        <SheetFooter>
          <Link
            href="/cart"
            onClick={() => setOpen(false)}
            className={buttonVariants({ variant: "outline" })}
          >
            View cart
          </Link>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
