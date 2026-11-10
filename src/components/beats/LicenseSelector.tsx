"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { BeatDetailLicense } from "@/lib/catalog";
import { formatPrice } from "@/lib/pricing";
import { MAX_CART_ITEMS } from "@/lib/cart";
import { useCartStore } from "@/store/cart";

// Pick one license tier and add it to the cart. The cart gets only
// { beatId, licenseTierId }. Prices here are for display: the cart and
// checkout read them again from the database.
export function LicenseSelector({
  beatId,
  licenses,
  exclusiveReserved,
}: {
  beatId: string;
  licenses: BeatDetailLicense[];
  exclusiveReserved: boolean;
}) {
  // While a checkout holds the exclusive, it can't be picked. Leases can
  // (.claude/rules/exclusives.md).
  const isDisabled = (license: BeatDetailLicense) =>
    exclusiveReserved && license.licenseTier.code === "EXCLUSIVE";

  const [selectedId, setSelectedId] = useState(
    () => licenses.find((license) => !isDisabled(license))?.licenseTier.id,
  );
  const selected = licenses.find(
    (license) => license.licenseTier.id === selectedId,
  );

  // The tier of this beat that's in the cart, if the beat is there.
  const tierInCart = useCartStore(
    (state) =>
      state.items.find((item) => item.beatId === beatId)?.licenseTierId,
  );
  const [cartFull, setCartFull] = useState(false);

  // One tier per beat: if the beat is already in the cart, this swaps its
  // tier (src/store/cart.ts). Then the drawer opens to show the cart.
  function addToCart() {
    if (!selectedId) return;
    const { add, setOpen } = useCartStore.getState();
    if (add({ beatId, licenseTierId: selectedId })) setOpen(true);
    else setCartFull(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <fieldset>
        <legend className="mb-3 font-medium">Choose a license</legend>
        <div className="flex flex-col gap-3">
          {licenses.map((license) => {
            const tier = license.licenseTier;
            const disabled = isDisabled(license);
            return (
              <label
                key={tier.id}
                className="flex cursor-pointer items-start gap-3 rounded-xl border p-4 has-checked:border-primary has-disabled:cursor-not-allowed has-disabled:opacity-50"
              >
                <input
                  type="radio"
                  name="license"
                  value={tier.id}
                  checked={tier.id === selectedId}
                  disabled={disabled}
                  onChange={() => setSelectedId(tier.id)}
                  className="mt-1"
                />
                <span className="flex flex-1 flex-col gap-1">
                  <span className="flex justify-between gap-2 font-medium">
                    <span>{tier.name}</span>
                    <span>{formatPrice(license.priceCents)}</span>
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {disabled ? "Reserved, check back soon" : tier.description}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
        {selected && (
          <p className="mt-3 text-sm text-muted-foreground">
            {selected.licenseTier.terms}
          </p>
        )}
      </fieldset>

      <Button size="lg" onClick={addToCart} disabled={!selectedId}>
        {tierInCart === undefined
          ? "Add to cart"
          : tierInCart === selectedId
            ? "In cart"
            : "Change license in cart"}
      </Button>
      {cartFull && (
        <p role="alert" className="text-sm text-destructive">
          Your cart is full. It holds up to {MAX_CART_ITEMS} beats.
        </p>
      )}
    </div>
  );
}
