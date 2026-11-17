// Sets up the two storage buckets (PLAN.md §5.1, §5.5):
//
//   pnpm storage:setup
//
// - S3_PRIVATE_BUCKET: full MP3/WAV/stems. Never public. The browser only
//   PUTs uploads into it and GETs files through 10-minute signed links.
// - S3_PUBLIC_BUCKET: previews and covers, readable by anyone. The store
//   links to them through PUBLIC_CDN_URL.
//
// For each bucket it creates the bucket if it's missing and sets CORS: only
// NEXT_PUBLIC_SITE_URL (plus http://localhost:3000 outside production) may
// PUT or GET from a browser. Then it makes the public bucket readable with a
// bucket policy.
//
// Locally (the storage server from docker-compose.yml) every step works.
// On R2, create the buckets in the Cloudflare dashboard first if the key
// can't. R2 has no bucket policies: turn on public access for the public
// bucket in the dashboard instead (a custom domain or r2.dev), and put that
// address in PUBLIC_CDN_URL. Safe to run again.

// First, so S3_* is set before storage.ts reads it.
import "dotenv/config";
import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketCorsCommand,
  PutBucketPolicyCommand,
} from "@aws-sdk/client-s3";
import { getS3 } from "@/lib/storage";

function allowedOrigins() {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const origins = new Set([site]);
  if (process.env.NODE_ENV !== "production") {
    origins.add("http://localhost:3000");
  }
  return [...origins];
}

async function ensureBucket(bucket: string) {
  try {
    await getS3().send(new HeadBucketCommand({ Bucket: bucket }));
    console.log(`${bucket}: exists`);
  } catch {
    await getS3().send(new CreateBucketCommand({ Bucket: bucket }));
    console.log(`${bucket}: created`);
  }
}

async function setCors(bucket: string) {
  const origins = allowedOrigins();
  await getS3().send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: origins,
            AllowedMethods: ["PUT", "GET"],
            // An upload sends Content-Type, which the signed link fixes.
            AllowedHeaders: ["content-type"],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    }),
  );
  console.log(`${bucket}: CORS allows PUT and GET from ${origins.join(", ")}`);
}

async function makeReadable(bucket: string) {
  try {
    await getS3().send(
      new PutBucketPolicyCommand({
        Bucket: bucket,
        Policy: JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Principal: "*",
              Action: ["s3:GetObject"], // read one file; no listing
              Resource: [`arn:aws:s3:::${bucket}/*`],
            },
          ],
        }),
      }),
    );
    console.log(`${bucket}: anyone can read its files`);
  } catch (error) {
    console.warn(
      `${bucket}: couldn't set a public-read policy (${String(error)}). On R2, turn on public access in the dashboard.`,
    );
  }
}

async function main() {
  const { S3_PRIVATE_BUCKET, S3_PUBLIC_BUCKET } = process.env;
  if (!S3_PRIVATE_BUCKET || !S3_PUBLIC_BUCKET) {
    throw new Error("S3_PRIVATE_BUCKET and S3_PUBLIC_BUCKET must be set");
  }
  for (const bucket of [S3_PRIVATE_BUCKET, S3_PUBLIC_BUCKET]) {
    await ensureBucket(bucket);
    await setCors(bucket);
  }
  await makeReadable(S3_PUBLIC_BUCKET);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
