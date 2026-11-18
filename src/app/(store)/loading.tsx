import { Skeleton } from "@/components/ui/skeleton";

// Shown while a store page without its own loading.tsx waits for data
// (Next.js loading file convention): home, /account, /licenses, and the
// success page, which can wait on Stripe. So it's plain: a heading, two
// lines and a block. Static pages like /faq are ready at once and never
// show it.
export default function StoreLoading() {
  return (
    <div className="flex flex-col gap-4">
      <p className="sr-only">Loading…</p>
      <Skeleton className="h-9 w-64 max-w-full" />
      <Skeleton className="h-4 w-full max-w-xl" />
      <Skeleton className="h-4 w-full max-w-md" />
      <Skeleton className="mt-4 h-48 rounded-xl" />
    </div>
  );
}
