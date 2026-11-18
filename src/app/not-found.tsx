import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Page not found" };

// The 404 page (Next.js not-found file convention). Here at the root it's
// shown for a URL that matches no page, inside the root layout only, so
// without the store's header. (store)/not-found.tsx re-exports it for
// notFound() in store pages, such as a beat that doesn't exist or is a
// draft: those keep the header.
export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-muted-foreground">
        This page doesn&apos;t exist or isn&apos;t available any more.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Link href="/beats" className={buttonVariants()}>
          Browse beats
        </Link>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          Home
        </Link>
      </div>
    </div>
  );
}
