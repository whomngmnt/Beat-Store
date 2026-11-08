import Link from "next/link";
import { connection } from "next/server";
import { BeatCard } from "@/components/beats/BeatCard";
import { buttonVariants } from "@/components/ui/button";
import {
  getFeaturedBeats,
  getFilterOptions,
  getNewestBeats,
} from "@/lib/catalog";

export default async function Home() {
  // Render on every request. Without this, `pnpm build` would render the
  // page once with the database (CI has none) and it would never update.
  await connection();

  const [featured, newest, { genres }] = await Promise.all([
    getFeaturedBeats(),
    getNewestBeats(),
    getFilterOptions(),
  ]);

  return (
    <div className="flex flex-col gap-12">
      <section className="flex flex-col items-start gap-4 py-8">
        <h1 className="text-4xl font-semibold">
          Type beats for your next release
        </h1>
        <p className="max-w-xl text-muted-foreground">
          Listen to the previews, pick a license and download your files right
          after checkout.
        </p>
        <Link href="/beats" className={buttonVariants({ size: "lg" })}>
          Browse beats
        </Link>
      </section>

      {newest.length === 0 ? (
        <p className="rounded-xl border border-dashed p-10 text-center">
          No beats yet, check back soon.
        </p>
      ) : (
        <>
          {featured.length > 0 && (
            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-semibold">Featured</h2>
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {featured.map((beat) => (
                  <li key={beat.id}>
                    <BeatCard beat={beat} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-2xl font-semibold">New releases</h2>
              {/* The catalog sorts newest first by default. */}
              <Link
                href="/beats"
                className={buttonVariants({ variant: "ghost" })}
              >
                View all
              </Link>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {newest.map((beat) => (
                <li key={beat.id}>
                  <BeatCard beat={beat} />
                </li>
              ))}
            </ul>
          </section>

          <section className="flex flex-col gap-4">
            <h2 className="text-2xl font-semibold">Browse by genre</h2>
            <ul className="flex flex-wrap gap-2">
              {genres.map((genre) => (
                <li key={genre}>
                  {/* URLSearchParams encodes the value, so "R&B" becomes
                      genre=R%26B instead of breaking the link. */}
                  <Link
                    href={`/beats?${new URLSearchParams({ genre })}`}
                    className={buttonVariants({ variant: "outline" })}
                  >
                    {genre}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
