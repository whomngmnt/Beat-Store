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
import { PlayButton } from "@/components/player/PlayButton";
import type { BeatCardData } from "@/lib/catalog";
import { formatPrice } from "@/lib/pricing";
import type { Track } from "@/store/player";

// Badges are plain spans styled with badgeVariants: shadcn's <Badge> calls a
// Base UI hook, and this is a server component.
// `queue` is the grid this card is in (see BeatGrid).
export function BeatCard({
  beat,
  queue,
}: {
  beat: BeatCardData;
  queue: Track[];
}) {
  const fromPriceCents = beat.licenses[0]?.priceCents;
  // -1 when the beat has no preview, so it gets no play button.
  const queueIndex = queue.findIndex((track) => track.id === beat.id);

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
        {queueIndex !== -1 && (
          <PlayButton
            queue={queue}
            index={queueIndex}
            className="absolute right-3 bottom-3"
          />
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
