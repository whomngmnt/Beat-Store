"use client";

import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlayerStore, type Track } from "@/store/player";

// Plays queue[index]. The whole queue (the list the button is shown in)
// goes to the player, so Next and Previous move through that list. If this
// track is already loaded, the button pauses or resumes it instead.
export function PlayButton({
  queue,
  index,
  className,
}: {
  queue: Track[];
  index: number;
  className?: string;
}) {
  const track = queue[index];
  const isCurrent = usePlayerStore(
    (state) => state.queue[state.index]?.id === track.id,
  );
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const showPause = isCurrent && isPlaying;

  function handleClick() {
    const { toggle, playQueue } = usePlayerStore.getState();
    if (isCurrent) toggle();
    else playQueue(queue, index);
  }

  return (
    <Button
      size="icon-lg"
      aria-label={`${showPause ? "Pause" : "Play"} ${track.title}`}
      onClick={handleClick}
      className={className}
    >
      {showPause ? <Pause /> : <Play />}
    </Button>
  );
}
