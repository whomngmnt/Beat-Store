// File storage (PLAN.md §5.1, §5.5). Previews and covers sit in the public
// bucket. Full MP3/WAV/stems sit in the private bucket, reached only through
// short-lived signed URLs. Admin uploads go straight from the browser to a
// bucket through a signed PUT link.
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Public URL of a file in the public bucket from its storage key, such as
// "previews/midnight-drive.mp3" or an uploaded cover. PUBLIC_CDN_URL is the
// public bucket's address. While it's empty, the URL is
// "/previews/midnight-drive.mp3", which Next serves from public/.
// Call it on the server only: PUBLIC_CDN_URL isn't sent to the browser.
export function publicUrl(key: string) {
  return `${process.env.PUBLIC_CDN_URL ?? ""}/${key}`;
}

// How long a download link from signDownloadUrl() works.
export const DOWNLOAD_URL_SECONDS = 10 * 60;

let client: S3Client | undefined;

// Created on first use, like getStripe(): `next build` loads route modules
// where the S3_* variables aren't set. Exported for the demo upload script.
export function getS3(): S3Client {
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
    // Bucket in the path (<endpoint>/<bucket>/<key>), not in the host name.
    // The local storage server only understands this form, and R2 accepts
    // both, so local and R2 links look the same.
    forcePathStyle: true,
    // By default the SDK adds a CRC32 checksum to every PUT. In a presigned
    // upload link that's the checksum of an empty body, so any real file
    // would be refused. Only add checksums where S3 requires them.
    requestChecksumCalculation: "WHEN_REQUIRED",
    credentials: {
      accessKeyId: S3_ACCESS_KEY_ID,
      secretAccessKey: S3_SECRET_ACCESS_KEY,
    },
  });
  return client;
}

// The bucket's name from .env. Throws if it's missing, so a typo can't
// send a file to the wrong place.
export function bucketName(bucket: "private" | "public") {
  const name =
    bucket === "private"
      ? process.env.S3_PRIVATE_BUCKET
      : process.env.S3_PUBLIC_BUCKET;
  if (!name) throw new Error(`S3_${bucket.toUpperCase()}_BUCKET must be set`);
  return name;
}

// How long an upload link from signUploadUrl() works.
export const UPLOAD_URL_SECONDS = 10 * 60;

// A 10-minute link the admin's browser PUTs one file to. The server picked
// the key. The Content-Type is part of the signature, so the browser must
// send exactly this type. The link can't limit the size: checkUpload() in
// src/lib/uploads.ts checks that after the upload.
export function signUploadUrl(
  bucket: "private" | "public",
  key: string,
  contentType: string,
) {
  return getSignedUrl(
    getS3(),
    new PutObjectCommand({
      Bucket: bucketName(bucket),
      Key: key,
      ContentType: contentType,
    }),
    {
      expiresIn: UPLOAD_URL_SECONDS,
      // The S3 presigner leaves Content-Type out of the signature by
      // default. Signing it means the PUT must send exactly this type.
      signableHeaders: new Set(["content-type"]),
    },
  );
}

// The file's size in bytes, or null if there's no file under this key.
export async function fileSize(bucket: "private" | "public", key: string) {
  try {
    const head = await getS3().send(
      new HeadObjectCommand({ Bucket: bucketName(bucket), Key: key }),
    );
    return head.ContentLength ?? null;
  } catch {
    return null;
  }
}

// The first `count` bytes of a file, for checking what kind of file it is.
export async function firstBytes(
  bucket: "private" | "public",
  key: string,
  count: number,
) {
  const object = await getS3().send(
    new GetObjectCommand({
      Bucket: bucketName(bucket),
      Key: key,
      Range: `bytes=0-${count - 1}`,
    }),
  );
  return object.Body ? object.Body.transformToByteArray() : new Uint8Array();
}

export async function deleteFile(bucket: "private" | "public", key: string) {
  await getS3().send(
    new DeleteObjectCommand({ Bucket: bucketName(bucket), Key: key }),
  );
}

// A 10-minute link to a file in the private bucket. `filename` is the name
// the browser saves it under; without it, it would use the key's random id.
// Signing happens offline: nothing is sent to R2 until the link is opened.
export function signDownloadUrl(key: string, filename: string) {
  return getSignedUrl(
    getS3(),
    new GetObjectCommand({
      Bucket: bucketName("private"),
      Key: key,
      ResponseContentDisposition: `attachment; filename="${filename}"`,
    }),
    { expiresIn: DOWNLOAD_URL_SECONDS },
  );
}
