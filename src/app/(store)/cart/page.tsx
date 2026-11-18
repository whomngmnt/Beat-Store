import type { Metadata } from "next";
import { CartContents } from "@/components/cart/CartContents";

export const metadata: Metadata = { title: "Cart" };

// The cart is saved in the browser, so the server sends the same page to
// everyone and CartContents fills it in the browser, Checkout button
// included.
export default function CartPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <h1 className="text-3xl font-semibold">Cart</h1>
      <CartContents />
    </div>
  );
}
