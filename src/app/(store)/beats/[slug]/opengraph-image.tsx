import { ImageResponse } from "next/og";
import { getBeatBySlug } from "@/lib/catalog";
import { formatPrice } from "@/lib/pricing";

// The picture social apps show when someone shares a beat link (Next.js
// opengraph-image file convention: it adds the og:image tags to the page).
// Beats have no cover yet (Phase 8), so it's a dark card with the details.
// Like the page, it's made on each request.

export const alt = "Beat title, genre, BPM, key and price";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Colours from the dark theme in globals.css, as hex.
const background = "#0a0a0a";
const foreground = "#fafafa";
const muted = "#a1a1a1";

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const beat = await getBeatBySlug((await params).slug);
  if (!beat) return new Response("Not found", { status: 404 });

  const price =
    beat.status === "SOLD"
      ? "Sold"
      : `From ${formatPrice(Math.min(...beat.licenses.map((license) => license.priceCents)))}`;

  // ImageResponse supports flexbox only, and every element with more than
  // one child needs display: flex. Text is one string per element.
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 80,
        background,
        color: foreground,
      }}
    >
      <div style={{ fontSize: 32, color: muted }}>Beat Store</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ fontSize: 88 }}>{beat.title}</div>
        <div style={{ fontSize: 40, color: muted }}>
          {`${beat.genre} · ${beat.bpm} BPM · ${beat.musicalKey}`}
        </div>
      </div>
      <div style={{ fontSize: 48 }}>{price}</div>
    </div>,
    size,
  );
}
