// Global audio player (PLAN.md §3, feature 4).
//
// The app's one <audio> element lives in PlayerBar and registers itself
// here as `audio`. The actions below act on that element directly.
// `isPlaying`, `currentTime` and `duration` are written only by the
// element's own events (see PlayerBar and timeUpdate), so the UI always
// shows what the element is really doing, even when a file fails to load.
//
// Only client components change this store. The server never writes to it,
// so every server render starts from the empty state below.
import { create } from "zustand";

// A play is counted after this much real listening to one track.
export const COUNT_PLAY_AFTER_SECONDS = 10;

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
  listenedSeconds: number; // real listening to the current track so far
  timeUpdate: (time: number) => boolean;
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
    set({
      queue,
      index,
      currentTime: startAt,
      duration: 0,
      listenedSeconds: 0,
    });

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
    listenedSeconds: 0,

    // Called by the element's timeupdate event (about every 0.25 s while
    // playing). Adds up real listening: only small forward steps count, so
    // a seek doesn't. Returns true once per loaded track, at the moment it
    // passes COUNT_PLAY_AFTER_SECONDS, which is when PlayerBar records a play.
    timeUpdate: (time) => {
      const { currentTime, listenedSeconds } = get();
      const step = time - currentTime;
      const listened =
        step > 0 && step < 1 ? listenedSeconds + step : listenedSeconds;
      set({ currentTime: time, listenedSeconds: listened });
      return (
        listenedSeconds < COUNT_PLAY_AFTER_SECONDS &&
        listened >= COUNT_PLAY_AFTER_SECONDS
      );
    },

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
