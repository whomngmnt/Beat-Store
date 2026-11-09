"use client";

// The bar at the bottom of every page, and the app's only <audio> element.
// It sits in the root layout, so it stays mounted (and keeps playing) while
// the user moves between pages.
import Link from "next/link";
import { Pause, Play, SkipBack, SkipForward, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlayerStore } from "@/store/player";

const setPlayerState = usePlayerStore.setState;

// Registers the element in the store, and removes it when it unmounts
// (React then calls this with null). Defined out here so it's the same
// function on every render and React doesn't re-attach it each time.
function registerAudio(element: HTMLAudioElement | null) {
  setPlayerState({ audio: element });
}

// 75.4 → "1:15"
function formatTime(seconds: number) {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

export function PlayerBar() {
  const track = usePlayerStore((state) => state.queue[state.index]);
  const isLast = usePlayerStore(
    (state) => state.index === state.queue.length - 1,
  );
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const currentTime = usePlayerStore((state) => state.currentTime);
  const duration = usePlayerStore((state) => state.duration);
  const volume = usePlayerStore((state) => state.volume);
  // Actions never change, so reading them once is enough.
  const { toggle, next, prev, seek, setVolume } = usePlayerStore.getState();

  return (
    <>
      {/* The element's own events are the only writers of isPlaying,
          currentTime and duration. */}
      <audio
        ref={registerAudio}
        onPlay={() => setPlayerState({ isPlaying: true })}
        onPause={() => setPlayerState({ isPlaying: false })}
        onError={() => setPlayerState({ isPlaying: false })}
        onTimeUpdate={(event) =>
          setPlayerState({ currentTime: event.currentTarget.currentTime })
        }
        // NaN until the file's length is known.
        onDurationChange={(event) => {
          const { duration } = event.currentTarget;
          setPlayerState({
            duration: Number.isFinite(duration) ? duration : 0,
          });
        }}
        onEnded={next}
      />

      {track && (
        <>
          {/* Keeps the end of the page from hiding behind the fixed bar. */}
          <div className="h-20" aria-hidden />
          <section
            aria-label="Player"
            className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 backdrop-blur"
          >
            <div className="mx-auto flex h-20 max-w-6xl items-center gap-4 px-4">
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Previous"
                  onClick={prev}
                >
                  <SkipBack />
                </Button>
                <Button
                  size="icon-lg"
                  aria-label={isPlaying ? "Pause" : "Play"}
                  onClick={toggle}
                >
                  {isPlaying ? <Pause /> : <Play />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Next"
                  onClick={next}
                  disabled={isLast}
                >
                  <SkipForward />
                </Button>
              </div>

              <Link
                href={`/beats/${track.slug}`}
                className="w-24 truncate font-medium hover:underline sm:w-40"
              >
                {track.title}
              </Link>

              <div className="flex min-w-0 flex-1 items-center gap-2 text-xs text-muted-foreground tabular-nums">
                <span>{formatTime(currentTime)}</span>
                <input
                  type="range"
                  aria-label="Seek"
                  min={0}
                  max={duration}
                  step="any"
                  value={Math.min(currentTime, duration)}
                  onChange={(event) => seek(Number(event.target.value))}
                  className="min-w-0 flex-1 accent-primary"
                />
                <span>{formatTime(duration)}</span>
              </div>

              <div className="hidden items-center gap-2 sm:flex">
                <Volume2 className="size-4 text-muted-foreground" aria-hidden />
                <input
                  type="range"
                  aria-label="Volume"
                  min={0}
                  max={1}
                  step={0.05}
                  value={volume}
                  onChange={(event) => setVolume(Number(event.target.value))}
                  className="w-24 accent-primary"
                />
              </div>
            </div>
          </section>
        </>
      )}
    </>
  );
}
