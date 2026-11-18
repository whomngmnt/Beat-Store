import type { Metadata } from "next";
import Link from "next/link";
import { BeatFilters } from "@/components/beats/BeatFilters";
import { BeatGrid } from "@/components/beats/BeatGrid";
import { buttonVariants } from "@/components/ui/button";
import { getCatalogPage, getFilterOptions } from "@/lib/catalog";
import { catalogSearchSchema, type CatalogFilters } from "@/lib/validators";

export const metadata: Metadata = { title: "Beats" };

// Reading searchParams makes this page render on every request, so the
// build never needs the database.
export default async function BeatsPage({ searchParams }: PageProps<"/beats">) {
  const filters = catalogSearchSchema.parse(await searchParams);
  const [{ beats, total, totalPages }, options] = await Promise.all([
    getCatalogPage(filters),
    getFilterOptions(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Beats</h1>
        <p className="text-sm text-muted-foreground">
          {total} {total === 1 ? "beat" : "beats"}
        </p>
      </div>

      <BeatFilters filters={filters} options={options} />

      {beats.length > 0 ? (
        <BeatGrid beats={beats} />
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center">
          {total === 0 ? (
            <>
              <p>No beats match these filters.</p>
              <Link
                href="/beats"
                className={buttonVariants({ variant: "outline" })}
              >
                Clear filters
              </Link>
            </>
          ) : (
            <>
              <p>There are no beats on this page.</p>
              <Link
                href={pageHref(filters, 1)}
                className={buttonVariants({ variant: "outline" })}
              >
                Go to page 1
              </Link>
            </>
          )}
        </div>
      )}

      {beats.length > 0 && totalPages > 1 && (
        <nav
          aria-label="Pagination"
          className="flex items-center justify-center gap-4"
        >
          {filters.page > 1 && (
            <Link
              href={pageHref(filters, filters.page - 1)}
              className={buttonVariants({ variant: "outline" })}
            >
              Previous
            </Link>
          )}
          <span className="text-sm text-muted-foreground">
            Page {filters.page} of {totalPages}
          </span>
          {filters.page < totalPages && (
            <Link
              href={pageHref(filters, filters.page + 1)}
              className={buttonVariants({ variant: "outline" })}
            >
              Next
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}

// The same filters with another page number. It's built from the checked
// filters, not the raw URL, so ignored junk params don't carry over.
function pageHref(filters: CatalogFilters, page: number) {
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries({ ...filters, page })) {
    if (value !== undefined) query.set(name, String(value));
  }
  return `/beats?${query}`;
}
