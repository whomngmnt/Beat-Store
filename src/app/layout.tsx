import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { PlayerBar } from "@/components/player/PlayerBar";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  // Turns relative metadata URLs (canonical link, share image) into full
  // ones. `||` also covers an empty value, which `new URL` would reject.
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  ),
  // A page's own title becomes "<title> · Beat Store".
  title: { default: "Beat Store", template: "%s · Beat Store" },
  description: "Type beats with instant licensing.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={cn("dark font-sans", geist.variable)}>
      <body>
        {children}
        {/* Here, not in a page layout, so it stays mounted and keeps
            playing on every page (store and admin). */}
        <PlayerBar />
      </body>
    </html>
  );
}
