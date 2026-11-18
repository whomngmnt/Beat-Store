import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";

// /robots.txt (Next.js robots file convention). Crawlers may visit every
// page except the admin panel and the API routes. It only asks politely:
// the admin pages still check requireAdmin() themselves.
// /account, /checkout and /sign-in stay open on purpose. Their metadata
// says noindex, and a crawler only reads that if it may load the page.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/"] },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
