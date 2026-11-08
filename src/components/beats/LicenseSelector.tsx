"use client";

import { useState } from "react";
import type { BeatDetailLicense } from "@/lib/catalog";
import { formatPrice } from "@/lib/pricing";

// Pick one license tier. The choice only lives here until the cart arrives
// (Phase 4), which adds { beatId, licenseTierId } with an "Add to cart"
// button. Prices are for display: checkout reads them again from the database.
export function LicenseSelector({
  licenses,
  exclusiveReserved,
}: {
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

  return (
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
  );
}
