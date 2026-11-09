import { BeatCard } from "@/components/beats/BeatCard";
import type { BeatCardData } from "@/lib/catalog";
import { previewUrl } from "@/lib/storage";
import type { Track } from "@/store/player";

// A grid of beat cards. The grid is also the player queue: pressing play
// on a card plays the grid from that card on. Beats without a preview have
// no play button and aren't in the queue.
export function BeatGrid({ beats }: { beats: BeatCardData[] }) {
  const queue: Track[] = beats.flatMap((beat) =>
    beat.previewKey
      ? [
          {
            id: beat.id,
            slug: beat.slug,
            title: beat.title,
            previewUrl: previewUrl(beat.previewKey),
          },
        ]
      : [],
  );

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {beats.map((beat) => (
        <li key={beat.id}>
          <BeatCard beat={beat} queue={queue} />
        </li>
      ))}
    </ul>
  );
}
