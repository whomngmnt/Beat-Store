import { Skeleton } from "@/components/ui/skeleton";

// Shown inside the admin nav while an admin page loads (Next.js loading
// file convention): a heading and a block where the table or form goes.
export default function AdminLoading() {
  return (
    <div className="flex flex-col gap-6">
      <p className="sr-only">Loading…</p>
      <Skeleton className="h-9 w-48" />
      <Skeleton className="h-64 rounded-lg" />
    </div>
  );
}
