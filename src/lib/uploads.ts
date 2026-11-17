// Admin uploads (PLAN.md §5.5, .claude/rules/uploads.md): which files a beat
// can have, where they go, how they're checked after upload, and which ones
// a beat needs before it can be published.
import { randomUUID } from "node:crypto";
import { deleteFile, fileSize, firstBytes } from "@/lib/storage";

export const FILE_KINDS = ["cover", "preview", "mp3", "wav", "stems"] as const;
export type FileKind = (typeof FILE_KINDS)[number];

const MB = 1024 * 1024;

// Per kind of file: its bucket, its size limit, the Content-Types the
// browser may send (with the extension each one gets), and the Beat column
// that holds its key. Covers and previews are public. Full files are private.
export const fileRules = {
  cover: {
    label: "cover image",
    bucket: "public",
    maxBytes: 5 * MB,
    types: { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" },
    column: "coverKey",
  },
  preview: {
    label: "preview MP3",
    bucket: "public",
    maxBytes: 20 * MB,
    types: { "audio/mpeg": "mp3" },
    column: "previewKey",
  },
  mp3: {
    label: "full MP3",
    bucket: "private",
    maxBytes: 20 * MB,
    types: { "audio/mpeg": "mp3" },
    column: "mp3Key",
  },
  wav: {
    label: "WAV",
    bucket: "private",
    maxBytes: 200 * MB,
    // Browsers name WAV files in different ways.
    types: { "audio/wav": "wav", "audio/x-wav": "wav", "audio/wave": "wav" },
    column: "wavKey",
  },
  stems: {
    label: "stems ZIP",
    bucket: "private",
    maxBytes: 1024 * MB,
    // Windows browsers send the second one for .zip files.
    types: { "application/zip": "zip", "application/x-zip-compressed": "zip" },
    column: "stemsKey",
  },
} as const satisfies Record<
  FileKind,
  {
    label: string;
    bucket: "private" | "public";
    maxBytes: number;
    types: Record<string, string>;
    column: string;
  }
>;

// The extension for this Content-Type, or null if the kind doesn't allow it.
export function extensionFor(kind: FileKind, contentType: string) {
  const types: Record<string, string> = fileRules[kind].types;
  return types[contentType] ?? null;
}

// The server picks every key: uploads/<beatId>/<random uuid>.<ext>. The
// browser never chooses where a file goes.
export function newUploadKey(beatId: string, extension: string) {
  return `uploads/${beatId}/${randomUUID()}.${extension}`;
}

// True if `key` has the shape newUploadKey() makes for this beat and kind,
// so a key sent back by the browser can't point anywhere else.
export function isUploadKey(key: string, beatId: string, kind: FileKind) {
  const extensions = [...new Set(Object.values(fileRules[kind].types))];
  const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
  return new RegExp(
    `^uploads/${beatId}/${uuid}\\.(${extensions.join("|")})$`,
  ).test(key);
}

// How many bytes looksLike() reads from the start of a file.
export const SNIFF_BYTES = 12;

const startsWith = (bytes: Uint8Array, text: string, at = 0) =>
  [...text].every((char, i) => bytes[at + i] === char.charCodeAt(0));

// Checks the file's first bytes ("magic bytes"), which say what the file
// really is, whatever its name or Content-Type claim.
export function looksLike(kind: FileKind, bytes: Uint8Array) {
  switch (kind) {
    case "cover":
      return (
        startsWith(bytes, "\x89PNG\r\n\x1a\n") ||
        (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) || // JPEG
        (startsWith(bytes, "RIFF") && startsWith(bytes, "WEBP", 8))
      );
    case "preview":
    case "mp3":
      // An ID3 tag, or straight away an MPEG audio frame (11 bits set).
      return (
        startsWith(bytes, "ID3") ||
        (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)
      );
    case "wav":
      return startsWith(bytes, "RIFF") && startsWith(bytes, "WAVE", 8);
    case "stems":
      return startsWith(bytes, "PK\x03\x04");
  }
}

// The check after an upload: the file is there, isn't too big, and is the
// kind of file it should be. A presigned PUT can't limit any of that.
// Returns null when it passes. A file that fails is deleted, and its key is
// never saved on the beat, so publishing stays blocked until a good file is
// uploaded.
export async function checkUpload(kind: FileKind, key: string) {
  const rule = fileRules[kind];
  const size = await fileSize(rule.bucket, key);
  if (size === null) return "The upload didn't arrive. Please try again.";

  let problem: string | null = null;
  if (size === 0) {
    problem = "The file is empty.";
  } else if (size > rule.maxBytes) {
    problem = `The file is too big: a ${rule.label} can be ${rule.maxBytes / MB} MB at most.`;
  } else if (
    !looksLike(kind, await firstBytes(rule.bucket, key, SNIFF_BYTES))
  ) {
    problem = `This file isn't a ${rule.label}.`;
  }
  if (problem) await deleteFile(rule.bucket, key);
  return problem;
}

type BeatFiles = {
  previewKey: string | null;
  mp3Key: string | null;
  wavKey: string | null;
  stemsKey: string | null;
};

type BeatLicenseInfo = {
  active: boolean;
  licenseTier: {
    name: string;
    includesMp3: boolean;
    includesWav: boolean;
    includesStems: boolean;
  };
};

// Why this beat can't be published yet, or [] if it can. It needs a preview,
// at least one active license, and every file an active license includes.
// Cover art is optional.
export function publishProblems(
  beat: BeatFiles,
  licenses: BeatLicenseInfo[],
): string[] {
  const problems: string[] = [];
  if (!beat.previewKey) problems.push("Upload a preview MP3.");

  const active = licenses.filter((license) => license.active);
  if (active.length === 0) problems.push("Turn on at least one license.");

  const needs = [
    { key: beat.mp3Key, label: "full MP3", tier: "includesMp3" },
    { key: beat.wavKey, label: "WAV", tier: "includesWav" },
    { key: beat.stemsKey, label: "stems ZIP", tier: "includesStems" },
  ] as const;
  for (const need of needs) {
    const tiers = active
      .filter((license) => license.licenseTier[need.tier])
      .map((license) => license.licenseTier.name);
    if (tiers.length > 0 && !need.key) {
      problems.push(
        `Upload the ${need.label}, or turn off ${tiers.join(", ")}.`,
      );
    }
  }
  return problems;
}
