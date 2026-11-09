"use client";

// The beat page's waveform. It draws the preview and shows how far the
// global player has got on this beat, but never plays anything itself: the
// one <audio> element in PlayerBar does all the playing. Giving wavesurfer
// that element instead would make it change the element's src to this
// beat and cut off whatever is playing.
//
// Clicking seeks the player if this beat is loaded, or starts this beat at
// the clicked spot. Keyboard users get the same with the play button next
// to it and the player bar's seek slider, so the drawing is aria-hidden.
import { useEffect, useRef } from "react";
import WaveSurfer from "wavesurfer.js";
import { usePlayerStore, type Track } from "@/store/player";

export function Waveform({
  track,
  className,
}: {
  track: Track;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // The canvas can't read CSS variables, so pass the theme colours as
    // values: mid grey for the unplayed part, near white for the played part.
    const styles = getComputedStyle(container);
    const wavesurfer = WaveSurfer.create({
      container,
      url: track.previewUrl,
      height: 64,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      cursorWidth: 0,
      waveColor: styles.getPropertyValue("--ring").trim(),
      progressColor: styles.getPropertyValue("--primary").trim(),
    });

    // Shows the player's position if this beat is loaded, otherwise the start.
    function showProgress() {
      if (wavesurfer.getDuration() === 0) return; // not drawn yet
      const player = usePlayerStore.getState();
      const isCurrent = player.queue[player.index]?.id === track.id;
      wavesurfer.setTime(isCurrent ? player.currentTime : 0);
    }
    wavesurfer.on("ready", showProgress);
    const unsubscribe = usePlayerStore.subscribe(showProgress);

    wavesurfer.on("interaction", (time) => {
      const player = usePlayerStore.getState();
      if (player.queue[player.index]?.id === track.id) player.seek(time);
      else player.playQueue([track], 0, time);
    });

    return () => {
      unsubscribe();
      wavesurfer.destroy();
    };
  }, [track]);

  return <div ref={containerRef} aria-hidden className={className} />;
}
