import Link from "next/link";
import { AudioLines } from "lucide-react";
import { badgeVariants } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { BeatCardData } from "@/lib/catalog";
import { formatPrice } from "@/lib/pricing";

// Badges are plain spans styled with badgeVariants: shadcn's <Badge> calls a
// Base UI hook, and this is a server component.
export function BeatCard({ beat }: { beat: BeatCardData }) {
  const fromPriceCents = beat.licenses[0]?.priceCents;

  return (
    <Card className="h-full pt-0">
      {/* Cover art comes with admin uploads (Phase 8). Until then every beat
          gets this placeholder. */}
      <div className="relative flex aspect-square items-center justify-center bg-muted">
        <AudioLines className="size-12 text-muted-foreground" aria-hidden />
        {beat.status === "RESERVED" && (
          <span
            className={badgeVariants({ className: "absolute top-3 left-3" })}
          >
            Exclusive reserved
          </span>
        )}
      </div>

      <CardHeader>
        <CardTitle>
          <Link href={`/beats/${beat.slug}`} className="hover:underline">
            {beat.title}
          </Link>
        </CardTitle>
        <CardDescription>
          {beat.genre} · {beat.mood}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3">
        <p className="text-muted-foreground">
          {beat.bpm} BPM · {beat.musicalKey}
        </p>
        <ul aria-label="Tags" className="flex flex-wrap gap-1">
          {beat.tags.slice(0, 3).map((tag) => (
            <li key={tag} className={badgeVariants({ variant: "secondary" })}>
              {tag}
            </li>
          ))}
        </ul>
        {fromPriceCents !== undefined && (
          <p className="mt-auto font-medium">
            From {formatPrice(fromPriceCents)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
