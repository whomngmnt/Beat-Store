// Uploads the demo beats' full files to the private bucket (PLAN.md §5.1),
// so downloads can be tested for real. The S3_* values in .env say where:
// locally, the storage server from docker-compose.yml.
//
//   pnpm demo:upload
//
// For each beat that has audio-src/<slug>.wav:
// - the WAV itself goes up as uploads/<beatId>/<uuid>.wav
// - a full-length 320 kbps MP3 made from it with ffmpeg (no tag, no cut)
//   goes up as uploads/<beatId>/<uuid>.mp3
// The script picks the keys the way admin uploads will (PLAN.md §5.5).
//
// A file goes up only if the beat has no key for it yet, so a re-run changes
// nothing and never replaces a file the admin uploaded. The key is saved
// after the upload succeeds, so the database never points at a file that
// isn't there. Stems are skipped: there are no demo stems.
//
// Deleting the storage volume leaves keys that point at missing files.
// To start over: `pnpm prisma migrate reset`, then `pnpm db:seed`, then this.
// Needs ffmpeg on PATH (`winget install Gyan.FFmpeg`).

// First, so DATABASE_URL and S3_* are set before db.ts and storage.ts use them.
import "dotenv/config";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { db } from "@/lib/db";
import { getS3 } from "@/lib/storage";

// execFile passes the arguments straight to ffmpeg, with no shell in between.
const run = promisify(execFile);

// The whole WAV as a 320 kbps MP3, kept in memory (about 7 MB for 3 minutes).
async function toMp3(wav: string) {
  // prettier-ignore
  const { stdout } = await run("ffmpeg", [
    "-nostdin", // never wait for keyboard commands
    "-hide_banner",
    "-loglevel", "error",
    "-i", wav,
    // Don't copy the source's tags (title, software, comments) into the MP3.
    "-map_metadata", "-1",
    "-c:a", "libmp3lame",
    "-b:a", "320k",
    "-f", "mp3",
    "pipe:1", // write the MP3 to stdout instead of a file
  ], { encoding: "buffer", maxBuffer: 50 * 1024 * 1024 });
  return stdout;
}

async function upload(bucket: string, key: string, body: Buffer, type: string) {
  await getS3().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: type,
    }),
  );
  console.log(`  ${key} (${(body.length / 1024 / 1024).toFixed(1)} MB)`);
}

async function main() {
  const bucket = process.env.S3_PRIVATE_BUCKET;
  if (!bucket) throw new Error("S3_PRIVATE_BUCKET must be set");

  const beats = await db.beat.findMany({
    select: { id: true, slug: true, mp3Key: true, wavKey: true },
    orderBy: { slug: "asc" },
  });

  let uploaded = 0;
  for (const beat of beats) {
    const wav = path.join("audio-src", `${beat.slug}.wav`);
    if (!existsSync(wav) || (beat.wavKey && beat.mp3Key)) continue;
    console.log(beat.slug);

    if (!beat.wavKey) {
      const key = `uploads/${beat.id}/${randomUUID()}.wav`;
      await upload(bucket, key, await readFile(wav), "audio/wav");
      await db.beat.update({ where: { id: beat.id }, data: { wavKey: key } });
      uploaded++;
    }
    if (!beat.mp3Key) {
      const key = `uploads/${beat.id}/${randomUUID()}.mp3`;
      await upload(bucket, key, await toMp3(wav), "audio/mpeg");
      await db.beat.update({ where: { id: beat.id }, data: { mp3Key: key } });
      uploaded++;
    }
  }

  const [withMp3, withWav] = await Promise.all([
    db.beat.count({ where: { mp3Key: { not: null } } }),
    db.beat.count({ where: { wavKey: { not: null } } }),
  ]);
  console.log(
    `Done: ${uploaded} files uploaded. ${withMp3} beats have an MP3, ${withWav} a WAV.`,
  );
}

main()
  .catch((error) => {
    // ENOENT from "spawn ffmpeg" means the program itself wasn't found.
    const notInstalled =
      error.code === "ENOENT" && String(error.syscall).startsWith("spawn");
    console.error(
      notInstalled
        ? "ffmpeg not found. Install it with `winget install Gyan.FFmpeg`, then open a new terminal."
        : error,
    );
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
