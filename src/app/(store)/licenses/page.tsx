import type { Metadata } from "next";
import { connection } from "next/server";
import { LicenseTable } from "@/components/beats/LicenseTable";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: "Licenses",
  description:
    "What each license includes: files, stream limits, music videos and terms.",
};

// All four license tiers side by side (PLAN.md §3, static pages). Read from
// the database, so an edit on /admin/licenses shows up here too.
export default async function LicensesPage() {
  // Render on every request, like the home page: `pnpm build` has no
  // database in CI.
  await connection();

  const tiers = await db.licenseTier.findMany({
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">Licenses</h1>
        <p className="text-muted-foreground">
          Every beat is sold under one of these licenses. The prices below are
          the usual ones. Each beat&apos;s page shows its own prices.
        </p>
      </div>

      {/* The beat page's table, filled with each tier's default price. */}
      <LicenseTable
        licenses={tiers.map((tier) => ({
          priceCents: tier.defaultPriceCents,
          licenseTier: tier,
        }))}
      />

      {tiers.map((tier) => (
        <section key={tier.id} className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold">{tier.name}</h2>
          <p className="text-muted-foreground">{tier.description}</p>
          <p>{tier.terms}</p>
        </section>
      ))}
    </div>
  );
}
