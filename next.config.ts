import type { NextConfig } from "next";

// Where covers come from: the public bucket (PUBLIC_CDN_URL, see
// .env.example). next/image resizes images from there and refuses any
// other site. While it's empty, covers are local paths, which next/image
// allows by default.
const cdnUrl = process.env.PUBLIC_CDN_URL;

const nextConfig: NextConfig = {
  // Don't let `next dev` write AGENTS.md; CLAUDE.md is our agent file.
  agentRules: false,
  images: {
    remotePatterns: cdnUrl ? [new URL(`${cdnUrl}/**`)] : [],
    // Next.js 16 won't fetch images from a local address (a guard against
    // SSRF), but local storage runs on localhost:8333. So only in
    // development, never in a production build.
    dangerouslyAllowLocalIP: process.env.NODE_ENV === "development",
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
