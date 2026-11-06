---
paths:
  - "src/app/api/upload/**"
  - "src/lib/storage.ts"
  - "src/actions/beats.ts"
  - "src/app/admin/**"
  - "scripts/**"
---

# Admin uploads and previews (PLAN.md §5.5)

- `/api/upload` is admin-only (`requireAdmin()`) and issues presigned PUT URLs.
- The **server picks the key**: `uploads/<beatId>/<uuid>.<ext>`. The client never chooses it.
- Content-Type must be on an allowlist: MP3, WAV, ZIP, PNG, JPEG, WebP.
- A presigned PUT doesn't limit size. Before a beat can be published, run `HeadObject` on each file and check its size (cover ≤ 5 MB, MP3 ≤ 20 MB, WAV ≤ 200 MB, stems ZIP ≤ 1 GB). Then sniff the magic bytes (ID3/MPEG, RIFF/WAVE, PK zip, PNG/JPEG/WebP). Delete files that fail and block publishing.
- Bucket CORS allows only `NEXT_PUBLIC_SITE_URL` (plus `http://localhost:3000` in dev), with methods PUT and GET only.
- Beat descriptions are plain text, rendered as text.
- Previews come from `scripts/make-preview.ts` (ffmpeg): 128 kbps MP3, optional 60–90 s cut, producer tag every ~20 s. Only previews go in the public bucket.
- Tests: an oversized or wrong-type upload blocks publishing, and a `<script>` in a description renders as plain text.
