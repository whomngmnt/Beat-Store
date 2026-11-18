// Search engine helpers (Phase 9): the site's own address, and the JSON-LD
// for a beat page. JSON-LD is structured data in a <script> tag that tells
// search engines what a page sells, in schema.org terms.
import type { BeatDetail } from "@/lib/catalog";
import { centsToDollars } from "@/lib/pricing";
import { publicUrl } from "@/lib/storage";

// The site's address, without a trailing slash (as in .env.example). The
// sitemap, robots.txt and JSON-LD need full URLs. `||` also covers an empty
// value.
export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

// The JSON-LD for one beat page, as the text to put in
// <script type="application/ld+json">. One object is both a Product (what
// search engines show prices for) and a MusicRecording (what it is).
export function beatJsonLd(beat: BeatDetail): string {
  const data = {
    "@context": "https://schema.org",
    "@type": ["Product", "MusicRecording"],
    name: beat.title,
    // JSON.stringify leaves out every key whose value is undefined.
    description: beat.description || undefined,
    url: `${siteUrl}/beats/${beat.slug}`,
    // publicUrl() gives a path like "/covers/x.jpg" while PUBLIC_CDN_URL is
    // empty. new URL makes that a full URL and leaves a full one as it is.
    image: beat.coverKey
      ? new URL(publicUrl(beat.coverKey), siteUrl).href
      : undefined,
    genre: beat.genre,
    keywords: beat.tags.join(", ") || undefined,
    // A sold beat's page shows no prices, so it gets no offers: search
    // engines want structured data to match what the page shows.
    offers:
      beat.status === "SOLD"
        ? undefined
        : beat.licenses.map((license) => ({
            "@type": "Offer",
            name: license.licenseTier.name,
            // 2999 → "29.99", with whole numbers only.
            price: centsToDollars(license.priceCents),
            priceCurrency: "USD",
            // While a checkout holds the beat, its exclusive can't be bought.
            availability:
              beat.status === "RESERVED" &&
              license.licenseTier.code === "EXCLUSIVE"
                ? "https://schema.org/OutOfStock"
                : "https://schema.org/InStock",
          })),
  };

  // Every "<" becomes <, which JSON reads back as "<". So no text from
  // the database (say, a description with "</script>" in it) can end the
  // script tag early.
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
