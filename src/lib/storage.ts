// File storage (PLAN.md §5.1). Previews are public. Full MP3/WAV/stems sit
// in the private R2 bucket, reached only through short-lived signed URLs.
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Public URL of a preview file from its storage key, such as
// "previews/midnight-drive.mp3". PUBLIC_CDN_URL is the R2 public bucket
// (Phase 5). While it's empty, the URL is "/previews/midnight-drive.mp3",
// which Next serves from public/.
// Call it on the server only: PUBLIC_CDN_URL isn't sent to the browser.
export function previewUrl(key: string) {
  return `${process.env.PUBLIC_CDN_URL ?? ""}/${key}`;
}

// How long a download link from signDownloadUrl() works.
export const DOWNLOAD_URL_SECONDS = 10 * 60;

let client: S3Client | undefined;

// Created on first use, like getStripe(): `next build` loads route modules
// where the S3_* variables aren't set.
function getS3(): S3Client {
  if (client) return client;

  const { S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } = process.env;
  if (!S3_ENDPOINT || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) {
    throw new Error(
      "S3_ENDPOINT, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY must be set",
    );
  }
  client = new S3Client({
    region: process.env.S3_REGION || "auto", // R2 ignores it, the SDK needs it
    endpoint: S3_ENDPOINT,
    credentials: {
      accessKeyId: S3_ACCESS_KEY_ID,
      secretAccessKey: S3_SECRET_ACCESS_KEY,
    },
  });
  return client;
}

// A 10-minute link to a file in the private bucket. `filename` is the name
// the browser saves it under; without it, it would use the key's random id.
// Signing happens offline: nothing is sent to R2 until the link is opened.
export function signDownloadUrl(key: string, filename: string) {
  const bucket = process.env.S3_PRIVATE_BUCKET;
  if (!bucket) throw new Error("S3_PRIVATE_BUCKET must be set");

  return getSignedUrl(
    getS3(),
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${filename}"`,
    }),
    { expiresIn: DOWNLOAD_URL_SECONDS },
  );
}
