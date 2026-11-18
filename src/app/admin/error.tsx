"use client"; // Next.js requires error files to be client components.

import { Button } from "@/components/ui/button";

// Shown inside the admin nav when an admin page throws (Next.js error file
// convention). In production the browser only gets a generic message, so
// the details are in the server log.
export default function AdminError({
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <div className="flex flex-col items-start gap-4">
      <h1 className="text-3xl font-semibold">Something went wrong</h1>
      <p className="text-muted-foreground">
        This page couldn&apos;t load. The server log has the details.
      </p>
      {/* retry() loads the page from the server again. */}
      <Button onClick={() => retry()}>Try again</Button>
    </div>
  );
}
