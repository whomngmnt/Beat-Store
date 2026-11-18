import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { getSitemapBeats } from "@/lib/catalog";
import { siteUrl } from "@/lib/seo";

// /sitemap.xml (Next.js sitemap file convention): the pages a search engine
// should find. Account, cart, checkout and sign-in pages aren't listed.
// There are no "last modified" dates: Beat has no updatedAt column.
const pages = [
  "/",
  "/beats",
  "/licenses",
  "/faq",
  "/contact",
  "/terms",
  "/privacy",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Made on each request, like the home page: `pnpm build` needs no
  // database, and a newly published beat is listed straight away.
  await connection();

  const beats = await getSitemapBeats();
  return [
    ...pages.map((path) => ({ url: `${siteUrl}${path}` })),
    ...beats.map((beat) => ({ url: `${siteUrl}/beats/${beat.slug}` })),
  ];
}
