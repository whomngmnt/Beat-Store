import type { ReactNode } from "react";
import { Check, Minus } from "lucide-react";
import type { BeatDetailLicense } from "@/lib/catalog";
import { formatPrice } from "@/lib/pricing";

type Tier = BeatDetailLicense["licenseTier"];

// "What's included": one column per license on sale for this beat. Every
// row comes from a LicenseTier column in the database.
export function LicenseTable({ licenses }: { licenses: BeatDetailLicense[] }) {
  const tiers = licenses.map((license) => license.licenseTier);

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th scope="col" className="p-3 text-left font-medium">
              <span className="sr-only">Feature</span>
            </th>
            {licenses.map(({ licenseTier, priceCents }) => (
              <th key={licenseTier.id} scope="col" className="p-3 font-medium">
                {licenseTier.name}
                <span className="block font-normal text-muted-foreground">
                  {formatPrice(priceCents)}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <Row
            label="MP3"
            tiers={tiers}
            cell={(tier) => <Included value={tier.includesMp3} />}
          />
          <Row
            label="WAV"
            tiers={tiers}
            cell={(tier) => <Included value={tier.includesWav} />}
          />
          <Row
            label="Stems (ZIP)"
            tiers={tiers}
            cell={(tier) => <Included value={tier.includesStems} />}
          />
          <Row
            label="Streams"
            tiers={tiers}
            cell={(tier) => limit(tier.streamLimit)}
          />
          <Row
            label="Music videos"
            tiers={tiers}
            cell={(tier) => limit(tier.videoLimit)}
          />
        </tbody>
      </table>
    </div>
  );
}

function Row({
  label,
  tiers,
  cell,
}: {
  label: string;
  tiers: Tier[];
  cell: (tier: Tier) => ReactNode;
}) {
  return (
    <tr className="border-b last:border-0">
      <th scope="row" className="p-3 text-left font-medium">
        {label}
      </th>
      {tiers.map((tier) => (
        <td key={tier.id} className="p-3 text-center">
          {cell(tier)}
        </td>
      ))}
    </tr>
  );
}

// The icon is hidden from screen readers, so the text says it instead.
function Included({ value }: { value: boolean }) {
  return value ? (
    <>
      <Check className="mx-auto size-4" aria-hidden />
      <span className="sr-only">Included</span>
    </>
  ) : (
    <>
      <Minus className="mx-auto size-4 text-muted-foreground" aria-hidden />
      <span className="sr-only">Not included</span>
    </>
  );
}

const count = new Intl.NumberFormat("en-US");

// null means no limit (prisma/schema.prisma). 5000 → "5,000".
function limit(value: number | null) {
  return value === null ? "Unlimited" : count.format(value);
}
