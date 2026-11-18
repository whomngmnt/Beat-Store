import { Skeleton } from "@/components/ui/skeleton";

// Shown while /beats loads, and again after Apply in the filters (Next.js
// loading file convention). It copies the page's layout: title, the filter
// form's grid (BeatFilters) and 6 cards in BeatGrid's grid, so nothing
// jumps when the beats arrive.
export default function BeatsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <p className="sr-only">Loading beats…</p>
      <div className="flex flex-col gap-1">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-5 w-16" />
      </div>

      {/* Search (2 columns wide), 7 fields, then the buttons. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Skeleton className="col-span-2 h-14" />
        {Array.from({ length: 7 }, (_, index) => (
          <Skeleton key={index} className="h-14" />
        ))}
        <Skeleton className="h-8 w-32 self-end lg:col-span-3" />
      </div>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <li key={index} className="flex flex-col gap-3">
            <Skeleton className="aspect-square rounded-xl" />
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
          </li>
        ))}
      </ul>
    </div>
  );
}
