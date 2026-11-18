// Makes the public preview MP3s (PLAN.md §5.1) from full-quality source audio.
//
//   pnpm make-preview <file or folder> [--out public/previews]
//     [--tag audio-src/tag.wav] [--start 0] [--length 90]
//
// Each source becomes <out>/<name>.mp3, so name the source after the beat's
// slug: audio-src/midnight-drive.wav → public/previews/midnight-drive.mp3.
// A folder means every audio file in it except the tag (PowerShell doesn't
// expand `*.wav` for us).
//
// A preview is a cut of the beat (from --start, at most --length seconds)
// with the producer tag mixed in at 0 s, 20 s, 40 s and so on, a fade-out,
// 128 kbps stereo MP3, and no metadata copied from the source file.
// Needs ffmpeg and ffprobe on PATH (`winget install Gyan.FFmpeg`).
import { execFile } from "node:child_process";
import { mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { parseArgs, promisify } from "node:util";
import { beatSlugSchema } from "@/lib/validators";

// execFile passes the arguments straight to the program, with no shell in
// between, so a file name can't be read as a command.
const run = promisify(execFile);

const SAMPLE_RATE = 44100;
const TAG_EVERY_SECONDS = 20;
const FADE_SECONDS = 3;
const AUDIO_EXTENSIONS = [".wav", ".mp3", ".flac", ".aif", ".aiff"];

function toSeconds(value: string, name: string, min: number) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds < min) {
    throw new Error(`--${name} must be a number of seconds, at least ${min}`);
  }
  return seconds;
}

// A file gives itself; a folder gives every audio file in it except the tag.
async function findSources(input: string, tag: string) {
  if (!(await stat(input)).isDirectory()) return [input];

  const names = await readdir(input);
  return names
    .filter((name) =>
      AUDIO_EXTENSIONS.includes(path.extname(name).toLowerCase()),
    )
    .map((name) => path.join(input, name))
    .filter((file) => file !== tag)
    .sort();
}

async function getDurationSeconds(file: string) {
  // Here and in makePreview, prettier-ignore keeps each flag on one line
  // with its value.
  // prettier-ignore
  const { stdout } = await run("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "csv=p=0",
    file,
  ]);
  return Number(stdout.trim());
}

// Returns the preview's length in seconds.
async function makePreview(
  source: string,
  tag: string,
  output: string,
  start: number,
  maxLength: number,
) {
  const length = Math.min(
    maxLength,
    (await getDurationSeconds(source)) - start,
  );
  if (!(length > FADE_SECONDS)) {
    throw new Error(`${source} is too short to start a preview at ${start} s`);
  }

  // Both inputs become 44.1 kHz stereo so they can be mixed.
  const format = `aformat=sample_rates=${SAMPLE_RATE}:channel_layouts=stereo`;
  const filter = [
    // The tag, padded with silence to 20 s, then repeated forever.
    `[1:a]${format},apad=whole_dur=${TAG_EVERY_SECONDS},aloop=loop=-1:size=${TAG_EVERY_SECONDS * SAMPLE_RATE}[tag]`,
    `[0:a]${format}[beat]`,
    // Mix at full volume and stop when the beat ends. The limiter keeps the
    // beat + tag sum from clipping. Then fade out over the last 3 s.
    `[beat][tag]amix=inputs=2:duration=first:normalize=false,alimiter=limit=0.95:level=false,afade=t=out:st=${length - FADE_SECONDS}:d=${FADE_SECONDS}[preview]`,
  ].join(";");

  // prettier-ignore
  await run("ffmpeg", [
    "-nostdin", // never wait for keyboard commands
    "-hide_banner",
    "-loglevel", "error",
    "-y",
    // -ss and -t before -i cut the source input only.
    "-ss", String(start),
    "-t", String(length),
    "-i", source,
    "-i", tag,
    "-filter_complex", filter,
    "-map", "[preview]",
    // Don't copy the source's tags (title, software, comments) into the MP3.
    "-map_metadata", "-1",
    "-c:a", "libmp3lame",
    "-b:a", "128k",
    output,
  ]);
  return length;
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      out: { type: "string", default: "public/previews" },
      tag: { type: "string", default: "audio-src/tag.wav" },
      start: { type: "string", default: "0" },
      length: { type: "string", default: "90" },
    },
  });
  if (positionals.length !== 1) {
    throw new Error(
      "Usage: pnpm make-preview <file or folder> [--out public/previews] [--tag audio-src/tag.wav] [--start 0] [--length 90]",
    );
  }

  const start = toSeconds(values.start, "start", 0);
  const length = toSeconds(values.length, "length", FADE_SECONDS + 1);
  const tag = path.resolve(values.tag);
  await stat(tag); // fails early with "no such file" if the tag is missing

  const sources = await findSources(path.resolve(positionals[0]), tag);
  if (sources.length === 0) throw new Error("No audio files found");

  // Check every name before making anything, so a bad name doesn't stop
  // the run halfway through.
  for (const source of sources) {
    const name = path.parse(source).name;
    if (!beatSlugSchema.safeParse(name).success) {
      throw new Error(
        `"${path.basename(source)}": name the file after the beat's slug (lowercase letters, digits and -), e.g. midnight-drive.wav`,
      );
    }
  }

  await mkdir(values.out, { recursive: true });
  for (const source of sources) {
    const output = path.join(values.out, `${path.parse(source).name}.mp3`);
    const seconds = await makePreview(source, tag, output, start, length);
    console.log(
      `${path.basename(source)} → ${output} (${seconds.toFixed(1)} s)`,
    );
  }
}

main().catch((error) => {
  // ENOENT from "spawn ffmpeg" means the program itself wasn't found.
  const notInstalled =
    error.code === "ENOENT" && String(error.syscall).startsWith("spawn");
  console.error(
    notInstalled
      ? "ffmpeg or ffprobe not found. Install it with `winget install Gyan.FFmpeg`, then open a new terminal."
      : error.message,
  );
  process.exitCode = 1;
});
