"use client"; // Next.js requires error files to be client components.

import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";

// Shown inside the store's header and footer when a store page throws
// (Next.js error file convention), e.g. when the database is down. The
// error itself isn't shown: in production the browser only gets a generic
// message, and the details are in the server log.
export default function StoreError({
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="text-muted-foreground">
        This page couldn&apos;t load. Try again in a moment, and contact us if
        it keeps happening.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {/* retry() loads the page from the server again. */}
        <Button onClick={() => retry()}>Try again</Button>
        <Link
          href="/contact"
          className={buttonVariants({ variant: "outline" })}
        >
          Contact
        </Link>
      </div>
    </div>
  );
}
