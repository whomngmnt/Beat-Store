// The shopping cart (PLAN.md §3, feature 5).
//
// It holds only which beat and which license tier the buyer picked, never a
// price. The server reads every price from the database (PLAN.md §5.2), so
// editing the saved cart in the browser can only change what's in the cart,
// the same as clicking would.
//
// `persist` saves `items` in localStorage, so the cart survives a reload.
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  MAX_CART_ITEMS,
  cartItemsSchema,
  type CartItem,
} from "@/lib/validators";

type CartState = {
  items: CartItem[];
  isOpen: boolean; // the cart drawer
  add: (item: CartItem) => boolean;
  remove: (beatId: string) => void;
  clear: () => void;
  setOpen: (isOpen: boolean) => void;
};

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,

      // One tier per beat: adding a beat that's already in the cart swaps
      // its tier in place. Returns false, and adds nothing, when a new beat
      // doesn't fit.
      add: (item) => {
        const { items } = get();
        if (items.some((line) => line.beatId === item.beatId)) {
          set({
            items: items.map((line) =>
              line.beatId === item.beatId ? item : line,
            ),
          });
          return true;
        }
        if (items.length >= MAX_CART_ITEMS) return false;
        set({ items: [...items, item] });
        return true;
      },

      remove: (beatId) =>
        set({ items: get().items.filter((line) => line.beatId !== beatId) }),

      clear: () => set({ items: [] }),

      setOpen: (isOpen) => set({ isOpen }),
    }),
    {
      name: "beat-store-cart",
      // Save only the items. The drawer starts closed on every page load.
      partialize: (state) => ({ items: state.items }),
      // The saved cart comes back from the browser, so it's checked like
      // any other input. If it's broken or was edited into something
      // invalid, the cart starts empty instead of breaking the page.
      merge: (saved, current) => {
        const items = cartItemsSchema.safeParse(
          (saved as { items?: unknown } | undefined)?.items,
        );
        return { ...current, items: items.success ? items.data : [] };
      },
      // Don't read localStorage when the store is created. The server can't
      // see it, so the browser's first render has to show the same empty
      // cart as the server's HTML, or React reports a hydration mismatch.
      // The cart UI calls `useCartStore.persist.rehydrate()` after mounting.
      skipHydration: true,
    },
  ),
);
