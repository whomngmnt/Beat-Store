import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePlayerStore, type Track } from "../../src/store/player";

const queue: Track[] = ["a", "b", "c"].map((id) => ({
  id,
  slug: id,
  title: id.toUpperCase(),
  previewUrl: `/previews/${id}.mp3`,
}));

// The parts of a real <audio> element the store uses.
function fakeAudio() {
  return {
    src: "",
    currentTime: 0,
    volume: 1,
    paused: true,
    play: vi.fn(() => Promise.resolve()),
    pause: vi.fn(),
  };
}

let audio: ReturnType<typeof fakeAudio>;
const player = () => usePlayerStore.getState();

beforeEach(() => {
  usePlayerStore.setState(usePlayerStore.getInitialState(), true);
  audio = fakeAudio();
  usePlayerStore.setState({ audio: audio as unknown as HTMLAudioElement });
});

describe("playQueue", () => {
  it("loads the chosen track and plays it", () => {
    player().playQueue(queue, 1);
    expect(player().queue).toBe(queue);
    expect(player().index).toBe(1);
    expect(audio.src).toBe("/previews/b.mp3");
    expect(audio.play).toHaveBeenCalledOnce();
  });

  it("can start part-way through the track", () => {
    player().playQueue(queue, 0, 42);
    expect(audio.currentTime).toBe(42);
    expect(player().currentTime).toBe(42);
    expect(audio.play).toHaveBeenCalledOnce();
  });

  it("ignores an index outside the queue", () => {
    player().playQueue(queue, 5);
    expect(player().index).toBe(-1);
    expect(audio.play).not.toHaveBeenCalled();
  });

  it("still records the track before the <audio> element exists", () => {
    usePlayerStore.setState({ audio: null });
    player().playQueue(queue, 0);
    expect(player().index).toBe(0);
  });
});

describe("next and prev", () => {
  it("move through the queue", () => {
    player().playQueue(queue, 1);
    player().next();
    expect(player().index).toBe(2);
    expect(audio.src).toBe("/previews/c.mp3");
    player().prev();
    player().prev();
    expect(player().index).toBe(0);
    expect(audio.src).toBe("/previews/a.mp3");
  });

  it("next on the last track pauses and stays there", () => {
    player().playQueue(queue, 2);
    player().next();
    expect(player().index).toBe(2);
    expect(audio.pause).toHaveBeenCalledOnce();
  });

  it("prev on the first track starts it again", () => {
    player().playQueue(queue, 0);
    audio.currentTime = 30;
    player().prev();
    expect(player().index).toBe(0);
    expect(audio.currentTime).toBe(0);
  });
});

describe("toggle", () => {
  it("does nothing when no track is loaded", () => {
    player().toggle();
    expect(audio.play).not.toHaveBeenCalled();
    expect(audio.pause).not.toHaveBeenCalled();
  });

  it("plays when paused and pauses when playing", () => {
    player().playQueue(queue, 0);
    audio.play.mockClear();

    audio.paused = true;
    player().toggle();
    expect(audio.play).toHaveBeenCalledOnce();

    audio.paused = false;
    player().toggle();
    expect(audio.pause).toHaveBeenCalledOnce();
  });
});

describe("timeUpdate (play counting)", () => {
  // Plays from `from` to `to` seconds in 0.25 s steps, like the element's
  // timeupdate events, and returns how many times a play was counted.
  function listen(from: number, to: number) {
    let counted = 0;
    for (let time = from + 0.25; time <= to; time += 0.25) {
      if (player().timeUpdate(time)) counted++;
    }
    return counted;
  }

  it("counts once, after 10 s of listening", () => {
    player().playQueue(queue, 0);
    expect(listen(0, 9.75)).toBe(0);
    expect(listen(9.75, 10)).toBe(1);
    expect(listen(10, 60)).toBe(0);
    expect(player().currentTime).toBe(60);
  });

  it("doesn't count a seek as listening", () => {
    player().playQueue(queue, 0);
    expect(listen(0, 5)).toBe(0);
    player().timeUpdate(80); // jumped forward
    player().timeUpdate(2); // jumped back
    expect(player().listenedSeconds).toBe(5);
    expect(listen(2, 7)).toBe(1);
  });

  it("starts again for the next track", () => {
    player().playQueue(queue, 0);
    expect(listen(0, 10)).toBe(1);
    player().next();
    expect(player().listenedSeconds).toBe(0);
    expect(listen(0, 10)).toBe(1);
  });

  it("counts from a start part-way through", () => {
    player().playQueue(queue, 0, 30);
    expect(listen(30, 40)).toBe(1);
  });
});

describe("seek and setVolume", () => {
  it("set the element's time and volume", () => {
    player().seek(42);
    expect(audio.currentTime).toBe(42);

    player().setVolume(0.5);
    expect(audio.volume).toBe(0.5);
    expect(player().volume).toBe(0.5);
  });
});
