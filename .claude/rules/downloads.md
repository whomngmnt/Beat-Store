---
paths:
  - "src/app/api/download/**"
  - "src/lib/tokens.ts"
  - "src/lib/storage.ts"
  - "src/app/**/account/**"
  - "src/app/**/checkout/**"
---

# Files and downloads (PLAN.md §5.1)

- DB file columns hold **storage keys**, never URLs.
- Full MP3/WAV/stems live in the **private** bucket. Only watermarked previews are public.
- The download route `GET /api/download/<orderItemId>/<fileType>` runs in this order:
  1. Authorize: the signed-in owner of the order, or a guest `?token=` whose SHA-256 hash matches `Order.downloadTokenHash` (constant-time compare) and hasn't expired. Otherwise 403.
  2. The order is PAID (not REFUNDED). Otherwise 403.
  3. `UPDATE Download SET count = count + 1 WHERE id = ? AND count < maxCount` as one statement. If 0 rows change, return 429 "download limit reached, contact support".
  4. Redirect to a signed URL that expires in **10 minutes**.
- Guest token: `crypto.randomBytes(32)` as base64url, 30-day expiry. Store **only its SHA-256 hash**. The raw token appears only in the success-page link (and in the receipt email once that slice exists).
- Order IDs are UUID v4 / cuid2, never sequential.
- Guest orders appear in `/account` only for a verified email (Google with `email_verified === true`).
- The admin can reset a download count or issue a new guest token.
- Tests: someone else's order returns 403, a wrong or expired token returns 403, and the 6th download of a file returns 429.
