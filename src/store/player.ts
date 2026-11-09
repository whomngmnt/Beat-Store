// Global audio player (PLAN.md §3, feature 4).
//
// The app's one <audio> element lives in PlayerBar and registers itself
// here as `audio`. The actions below act on that element directly.
// `isPlaying`, `currentTime` and `duration` are written only by the
// element's own events (see PlayerBar), so the UI always shows what the
// element is really doing, even when a file fails to load.
//
// Only client components change this store. The server never writes to it,
// so every server render starts from the empty state below.
import { create } from "zustand";

export type Track = {
  id: string;
  slug: string;
  title: string;
  previewUrl: string;
};

type PlayerState = {
  audio: HTMLAudioElement | null;
  queue: Track[];
  index: number; // position of the current track in `queue`, -1 = none
  isPlaying: boolean;
  currentTime: number; // seconds
  duration: number; // seconds, 0 until the file's length is known
  volume: number; // 0 to 1
  playQueue: (queue: Track[], index: number, startAt?: number) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
};

export const usePlayerStore = create<PlayerState>()((set, get) => {
  // Makes queue[index] the current track and plays it from `startAt`
  // seconds.
  function load(queue: Track[], index: number, startAt = 0) {
    const track = queue[index];
    if (!track) return;
    set({ queue, index, currentTime: startAt, duration: 0 });

    const { audio } = get();
    if (!audio) return;
    audio.src = track.previewUrl;
    // The file hasn't loaded yet, so this sets where playback will start.
    audio.currentTime = startAt;
    // play() rejects when a newer track interrupts it or the file can't
    // play. Nothing to do then: the element's events keep the state right.
    audio.play().catch(() => {});
  }

  return {
    audio: null,
    queue: [],
    index: -1,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 1,

    playQueue: load,

    toggle: () => {
      const { audio, index } = get();
      if (!audio || index === -1) return;
      if (audio.paused) audio.play().catch(() => {});
      else audio.pause();
    },

    // On the last track, Next just pauses.
    next: () => {
      const { audio, queue, index } = get();
      if (index < queue.length - 1) load(queue, index + 1);
      else audio?.pause();
    },

    // On the first track, Previous starts it again.
    prev: () => {
      const { queue, index, seek } = get();
      if (index > 0) load(queue, index - 1);
      else seek(0);
    },

    seek: (time) => {
      const { audio } = get();
      if (audio) audio.currentTime = time;
    },

    setVolume: (volume) => {
      const { audio } = get();
      if (audio) audio.volume = volume;
      set({ volume });
    },
  };
});
