import type { Metadata } from "next";
import { LicenseTierForm } from "@/components/admin/LicenseTierForm";
import { requireAdmin } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import { centsToDollars } from "@/lib/pricing";

export const metadata: Metadata = { title: "Licenses" };

// The four license tier templates (PLAN.md §3). The files each tier
// includes are fixed: publishing checks beats against them, and changing
// them would leave published beats without the files a license promises.
export default async function AdminLicensesPage() {
  await requireAdmin();

  const tiers = await db.licenseTier.findMany({
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold">Licenses</h1>
        <p className="text-muted-foreground">
          The templates every beat&apos;s licenses start from. Set a beat&apos;s
          own prices on its page.
        </p>
      </div>

      {tiers.map((tier) => {
        const files = [
          tier.includesMp3 && "MP3",
          tier.includesWav && "WAV",
          tier.includesStems && "stems",
        ].filter(Boolean);
        return (
          <section
            key={tier.id}
            className="flex flex-col gap-3 rounded-lg border p-4"
          >
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-semibold">{tier.name}</h2>
              <p className="text-sm text-muted-foreground">
                Code {tier.code} · Files: {files.join(", ")}
              </p>
            </div>
            <LicenseTierForm
              tier={{
                id: tier.id,
                name: tier.name,
                description: tier.description,
                defaultPrice: centsToDollars(tier.defaultPriceCents),
                streamLimit: tier.streamLimit,
                videoLimit: tier.videoLimit,
                terms: tier.terms,
              }}
            />
          </section>
        );
      })}
    </div>
  );
}
