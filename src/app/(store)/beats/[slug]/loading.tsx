import { Skeleton } from "@/components/ui/skeleton";

// Shown while a beat page loads (Next.js loading file convention), in the
// page's own layout: the cover on the left; title, play button, description
// and the 4 license cards on the right; "What's included" below. On a phone
// they stack, like the page.
// It's about as tall as the real page on purpose. A shorter skeleton left
// the footer on screen and the page without a scrollbar, so both jumped
// when the beat arrived (a layout shift Lighthouse counts against speed).
export default function BeatLoading() {
  return (
    <div className="flex flex-col gap-10">
      <p className="sr-only">Loading beat…</p>
      <div className="grid gap-8 md:grid-cols-[2fr_3fr]">
        <Skeleton className="aspect-square self-start rounded-xl" />

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-9 w-2/3" />
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-5 w-40" />
          </div>
          <Skeleton className="size-12" />
          <Skeleton className="h-6 w-3/4" />
          <div className="flex flex-col gap-3">
            <Skeleton className="h-6 w-36" />
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-20 rounded-xl" />
            ))}
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        </div>
      </div>
      <Skeleton className="h-80 rounded-xl" />
    </div>
  );
}
