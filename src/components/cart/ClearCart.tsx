"use client";

import { useEffect } from "react";
import { useCartStore } from "@/store/cart";

// Empties the cart after a paid order. The success page renders it only
// for a PAID order. clear() also saves the empty cart to localStorage, so
// it stays empty even if the saved cart hasn't been read yet.
export function ClearCart() {
  useEffect(() => {
    useCartStore.getState().clear();
  }, []);
  return null;
}
