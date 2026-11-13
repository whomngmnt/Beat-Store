import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AudioLines } from "lucide-react";
import { LicenseSelector } from "@/components/beats/LicenseSelector";
import { LicenseTable } from "@/components/beats/LicenseTable";
import { PlayButton } from "@/components/player/PlayButton";
import { Waveform } from "@/components/player/Waveform";
import { badgeVariants } from "@/components/ui/badge";
import { getBeatBySlug } from "@/lib/catalog";
import { formatPrice } from "@/lib/pricing";
import { previewUrl } from "@/lib/storage";
import type { Track } from "@/store/player";

// There's no generateStaticParams, so this page renders on every request:
// status and prices are always current, and the build never needs the
// database. The share image comes from opengraph-image.tsx next to this file.

export async function generateMetadata({
  params,
}: PageProps<"/beats/[slug]">): Promise<Metadata> {
  const beat = await getBeatBySlug((await params).slug);
  if (!beat) notFound();

  const title = `${beat.title} – ${beat.genre} beat`;
  const price =
    beat.status === "SOLD"
      ? "Sold with exclusive rights."
      : `Licenses from ${formatPrice(Math.min(...beat.licenses.map((license) => license.priceCents)))}.`;
  const description = [
    beat.description,
    `${beat.bpm} BPM · ${beat.musicalKey}.`,
    price,
  ]
    .filter(Boolean)
    .join(" ");
  const url = `/beats/${beat.slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website" },
    twitter: { card: "summary_large_image" },
  };
}

export default async function BeatPage({ params }: PageProps<"/beats/[slug]">) {
  const beat = await getBeatBySlug((await params).slug);
  if (!beat) notFound();

  const sold = beat.status === "SOLD";
  // A sold exclusive belongs to its buyer, so its preview no longer plays.
  const track: Track | null =
    beat.previewKey && !sold
      ? {
          id: beat.id,
          slug: beat.slug,
          title: beat.title,
          previewUrl: previewUrl(beat.previewKey),
        }
      : null;

  return (
    <div className="flex flex-col gap-10">
      <div className="grid gap-8 md:grid-cols-[2fr_3fr]">
        {/* Cover art comes with admin uploads (Phase 8). Until then every beat
            gets this placeholder, as on BeatCard. self-start: if the square
            stretched to the row's height, its width would follow and squeeze
            the license column until it spilled over the table below. */}
        <div className="relative flex aspect-square items-center justify-center self-start rounded-xl bg-muted">
          <AudioLines className="size-16 text-muted-foreground" aria-hidden />
          {beat.status !== "PUBLISHED" && (
            <span
              className={badgeVariants({ className: "absolute top-3 left-3" })}
            >
              {sold ? "Sold" : "Exclusive reserved"}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold">{beat.title}</h1>
            <p className="text-muted-foreground">
              {beat.genre} · {beat.mood} · {beat.bpm} BPM · {beat.musicalKey}
            </p>
            <ul aria-label="Tags" className="flex flex-wrap gap-1">
              {beat.tags.map((tag) => (
                <li
                  key={tag}
                  className={badgeVariants({ variant: "secondary" })}
                >
                  {tag}
                </li>
              ))}
            </ul>
          </div>

          {/* The queue is just this beat, so Next is off in the player bar. */}
          {track && (
            <div className="flex items-center gap-4">
              <PlayButton queue={[track]} index={0} className="size-12" />
              <Waveform track={track} className="h-16 min-w-0 flex-1" />
            </div>
          )}

          {/* Plain text: React escapes it, and line breaks stay visible. */}
          {beat.description && (
            <p className="whitespace-pre-line">{beat.description}</p>
          )}

          {sold ? (
            <p className="rounded-xl border p-4">
              Sold. This beat was sold with exclusive rights and is no longer
              for sale.
            </p>
          ) : (
            <LicenseSelector
              beatId={beat.id}
              licenses={beat.licenses}
              exclusiveReserved={beat.status === "RESERVED"}
            />
          )}
        </div>
      </div>

      {!sold && (
        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">What&apos;s included</h2>
          <LicenseTable licenses={beat.licenses} />
        </section>
      )}
    </div>
  );
}
