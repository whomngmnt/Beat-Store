# Beat Store: Full Project Plan

---

## 1. Context

You want a real online storefront for your type beats. Visitors can browse beats, listen to watermarked previews, pick a license tier (MP3 / WAV / Stems / Exclusive), and pay through a Stripe checkout in **test mode**. After paying, they get secure download links (a license PDF comes in a later slice). You manage beats, prices and orders from an admin panel.

The project covers the full stack: **frontend, backend, database, file storage and payments**. It's a working product for your music business and also a strong portfolio piece.

**Goals**

- Fast, good-looking catalog with an audio player that keeps playing as you move between pages
- 4 license tiers per beat, each with its own price, files and rights
- Cart plus Stripe Checkout (test mode), with order confirmation by webhook
- Full-quality files are never public. Buyers get signed, expiring download links.
- Admin panel for uploading beats, editing prices and viewing orders and sales
- Deployed online with CI, tests and a seeded demo catalog

**Out of scope for v1:** multiple producers or a marketplace, subscriptions, real (live-mode) payments, mobile apps.

**Later slices (after v1):** rate limiting (Upstash), email with receipts and magic-link sign-in (Resend), license PDF (@react-pdf/renderer) and E2E tests (Playwright). See §8.

---

## 2. Tech Stack (recommended)

| Layer            | Choice                                                                               | Why                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Framework        | **Next.js 16 (latest 16.x, App Router) + TypeScript**                                | One codebase for the frontend and backend (Route Handlers / Server Actions), good SEO for beat pages |
| Styling/UI       | **Tailwind CSS + shadcn/ui**                                                         | Fast, consistent dark "studio" look                                                                  |
| Audio            | **wavesurfer.js** (waveform) + a global `<audio>` player kept in a **Zustand** store | Persistent player bar, waveform display                                                              |
| Database         | **PostgreSQL** (local via Docker, hosted on **Neon** or **Supabase**)                | Relational data: beats, licenses, orders                                                             |
| ORM              | **Prisma**                                                                           | Type-safe queries, migrations, seeding                                                               |
| Auth             | **Better Auth**: Google sign-in in v1 (magic link later); `role` field for admin     | Simple and secure; Auth.js is now in maintenance mode                                                |
| File storage     | **Cloudflare R2** (S3-compatible) or AWS S3                                          | Cheap storage; signed URLs for private files                                                         |
| Payments         | **Stripe Checkout + Webhooks (test mode)**                                           | Hosted, secure, test cards                                                                           |
| Email            | **Later slice:** **Resend** + React Email                                            | Order receipts with download links; magic-link sign-in                                               |
| PDF              | **Later slice:** **@react-pdf/renderer**                                             | License agreement generated per order                                                                |
| Audio processing | **ffmpeg** (script)                                                                  | Produce tagged/watermarked MP3 previews                                                              |
| Validation       | **Zod**                                                                              | Validate forms and API input                                                                         |
| Rate limiting    | **Later slice:** **Upstash** ratelimit                                               | Limit magic-link, checkout and download requests                                                     |
| Testing          | **Vitest** (unit + integration), Stripe CLI (webhooks); Playwright E2E: later slice  |                                                                                                      |
| Deploy           | **Vercel** (app) + Neon (DB) + R2 (files)                                            | Free tiers available                                                                                 |
| CI               | **GitHub Actions**: lint, typecheck, test, build                                     |                                                                                                      |

---

## 3. Features

### Public storefront

1. **Home**: hero section, featured beats, newest beats, genre/"type" tags (e.g. "Travis Scott type", "Drill", "Lo-fi")
2. **Catalog `/beats`**: grid/list view, search by title/tag, filters (genre, mood, BPM range, key, price), sort (newest, popular, price), pagination
3. **Beat page `/beats/[slug]`**: cover art, waveform player, BPM/key/tags, license tier selector with a "what's included" comparison table, "Add to cart", similar beats
4. **Global player bar**: play/pause, seek, next/prev, volume. It stays across page navigation and has a queue built from the current list.
5. **Cart**: drawer plus `/cart` page, one license per beat line, totals, simple bundle deal (e.g. "Buy 2 get 1 free" on leases, optional)
6. **Checkout**: redirect to Stripe Checkout (test mode), then a `/checkout/success` page
7. **Account `/account`**: order history and re-download links (guest checkout supported; orders are matched by email)
8. **Static pages**: Licensing info, FAQ, Contact, Terms, Privacy

### License tiers (defaults, editable per beat)

| Tier             | Files delivered                     | Typical rights                                           | Example price         |
| ---------------- | ----------------------------------- | -------------------------------------------------------- | --------------------- |
| Basic Lease      | Tagged-free MP3                     | Up to 5k streams, non-profit video                       | $29.99                |
| Premium Lease    | MP3 + WAV                           | Up to 50k streams, 1 music video                         | $49.99                |
| Trackout / Stems | MP3 + WAV + Stems (ZIP)             | Up to 500k streams, live shows                           | $99.99                |
| Exclusive        | All files + full ownership transfer | Unlimited; the beat is removed from the store after sale | $499+ or "Make offer" |

### Admin panel `/admin` (role = ADMIN only)

- Dashboard: revenue (test), orders count, top beats, plays (simple charts)
- Beats CRUD: upload cover, preview MP3, full MP3, WAV, stems ZIP; set BPM, key, tags, status (draft / published / sold-exclusive)
- License tier templates plus per-beat price overrides
- Orders list and details, manual refund (Stripe test); "resend download email" comes with the email slice
- Coupons (optional): percent or fixed amount codes

---

## 4. Data Model (Prisma schema outline)

`?` = optional (can be empty). The real schema is `prisma/schema.prisma`; this outline matches it.

```
User          id, name, email (unique), emailVerified (boolean), image?, role (USER|ADMIN),
              createdAt, updatedAt
              ← Better Auth's core user fields plus role. Its Session, Account and
                Verification tables are added in Phase 7.
Beat          id, slug (unique), title, description (plain text, default ""), bpm, musicalKey,
              genre, mood, tags[], coverUrl?, previewKey?, mp3Key?, wavKey?, stemsKey?,
              status (DRAFT|PUBLISHED|RESERVED|SOLD), reservedByOrderId? (→ Order),
              reservedUntil?, plays, featured, createdAt
              ← file keys are empty until the admin uploads the files
LicenseTier   id, code (unique: BASIC|PREMIUM|TRACKOUT|EXCLUSIVE), name, description,
              defaultPriceCents, includesMp3, includesWav, includesStems,
              streamLimit?, videoLimit? (null = unlimited), terms (text), sortOrder
BeatLicense   id, beatId, licenseTierId, priceCents, active
              @@unique([beatId, licenseTierId])
              ← priceCents is this beat's price for the tier: copied from defaultPriceCents,
                then editable by the admin
Order         id, userId?, email?, status (PENDING|PAID|EXPIRED|REFUNDED|FAILED),
              stripeSessionId? (unique), stripePaymentIntentId?, totalCents,
              currency (default "usd"), couponId?, downloadTokenHash? (unique),
              downloadTokenExpiresAt?, fulfilledAt?, createdAt, paidAt?
              ← the order is created before the Stripe session, so the Stripe ids, token
                and paidAt are filled in later. A guest's email comes from Stripe Checkout
                after payment.
              later slice (email): emailSentAt?
OrderItem     id, orderId, beatId, licenseTierId, priceCents,
              beatTitleSnapshot, licenseNameSnapshot
              later slice (PDF): licensePdfKey?
Download      id, orderItemId, fileType (MP3|WAV|STEMS), count, maxCount (default 5), lastAt?
              @@unique([orderItemId, fileType])
              later slice (PDF): fileType LICENSE
Coupon        id, code (unique), percentOff?, amountOffCents?, active, expiresAt? (null = never)
              ← exactly one of percentOff / amountOffCents; Zod checks it when a coupon is saved
WebhookEvent  id (Stripe event id, PRIMARY KEY → unique), type, processedAt
              ← inserted INSIDE the fulfilment transaction; a duplicate insert fails and rolls back
```

Key rules:

- Every id is a random **UUID v4** (`@default(uuid())`), so none can be guessed or counted through. The one exception is `WebhookEvent.id`, which is Stripe's event id.
- Table and column names stay exactly as in the schema (no snake_case mapping), because raw SQL such as the reservation in §5.4 quotes them (`"Beat"`, `"reservedUntil"`).
- Download tokens are random and unguessable. Only the **SHA-256 hash** of the guest download token is stored; the raw token exists only in the email/success-page link.
- Prices are stored in **cents (integers)**, never floats.
- `OrderItem` keeps a snapshot of title, license name and price, so later edits don't change past orders.
- File columns hold **storage keys**, not public URLs. URLs are signed when a download is requested.

---

## 5. Architecture & Key Flows

### 5.1 Audio preview & file protection

- Upload the full WAV, then run `scripts/make-preview.ts` (ffmpeg): 128kbps MP3, optional 60–90s cut, and a voice tag ("producer tag") mixed in every ~20s.
- **Preview** files sit in a public bucket/path behind a CDN. **Full** MP3/WAV/stems sit in a **private** bucket.
- Until R2 exists (Phase 5), demo previews are generated into `public/previews/<slug>.mp3` from source files in `audio-src/` (both gitignored), and Next serves them. Their keys (`previews/<slug>.mp3`) stay the same when they move to the public bucket.
- Downloads go through `GET /api/download/[orderItemId]/[fileType]`. That route:
  1. Authorizes the request: the signed-in owner of the order, **or** a guest `?token=` whose SHA-256 hash matches `Order.downloadTokenHash` (compared in constant time) and has not expired.
  2. Checks the order is PAID (not REFUNDED).
  3. **Enforces the limit**: `UPDATE Download SET count = count + 1 WHERE id = ? AND count < maxCount` as one atomic statement. If 0 rows change, it returns 429 "download limit reached, contact support".
  4. Redirects to a **signed URL that expires in 10 minutes**.
- Guest token: 32 random bytes (`crypto.randomBytes(32)`, base64url), valid for 30 days. The admin can reset the count or issue a new token from the order page.

### 5.2 Checkout flow (Stripe test mode)

1. The client sends the cart (`[{beatId, licenseTierId}]`) to the server action `createCheckoutSession` (rate-limited).
2. The server **re-reads prices from the DB** (it never trusts client prices) and checks every beat is PUBLISHED.
3. In **one DB transaction** it creates the `PENDING` Order and, for each EXCLUSIVE item, **reserves the beat atomically** (see 5.4). If a reservation fails, the whole transaction rolls back and the buyer sees "this exclusive was just taken".
4. The server creates a Stripe Checkout Session with `line_items` (price_data), `metadata.orderId`, `expires_at = now + 30 min`, and success/cancel URLs. It saves `stripeSessionId` and returns the URL, and the client redirects. If creating the session fails, it releases the reservation and marks the order FAILED.
5. Stripe sends `checkout.session.completed` to `POST /api/webhooks/stripe`. The handler:
   - reads the **raw body** (`await req.text()`, not `req.json()`) and verifies it with `stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET)`. On failure it returns 400.
   - fulfils only if `session.payment_status === "paid"`, `amount_total === order.totalCents` and `currency` matches. Otherwise it logs, flags the order for review and does not fulfil.
6. **Fulfilment transaction**, which only touches the database:
   - `INSERT WebhookEvent(id = event.id)`. The primary key makes this the idempotency guard. A concurrent or repeated delivery hits a unique-violation and is treated as "already done", returning 200.
   - `UPDATE Order SET status = PAID, paidAt = now WHERE id = ? AND status = PENDING`
   - for EXCLUSIVE items: `UPDATE Beat SET status = SOLD WHERE id = ? AND reservedByOrderId = order.id`. If 0 rows change (another buyer won the beat), mark that item for **automatic refund**.
   - create `Download` rows
   - commit
7. **After the commit**, run the side effects. These don't depend on the webhook retrying, so they must be safe to run again:
   - automatic refund (`stripe.refunds.create` with idempotency key `refund-<orderItemId>`) for any lost exclusive, plus an apology email once the email slice exists
   - later slice (PDF): generate license PDFs, upload them, set `licensePdfKey`
   - later slice (email): send the receipt email, then set `emailSentAt`
   - If any step fails, it's retried by a job (Vercel Cron every 5 min: `PAID AND (emailSentAt IS NULL OR PDFs missing)`). The webhook still returns 200, because the payment is already recorded.
8. The **success page always shows the downloads**. It looks the order up by `session_id`, retrieves the session from Stripe on the server, and if the webhook hasn't arrived yet it **runs the same idempotent fulfilment function itself**. Delivery therefore never depends on email. It also shows the guest download link, so the buyer can bookmark it.
9. `checkout.session.expired` releases the reservations (`status = PUBLISHED, reservedByOrderId = null WHERE reservedByOrderId = order.id`) and sets the order to EXPIRED. A cron job also releases any reservation past `reservedUntil` in case the event is lost.
10. `charge.refunded` sets the order to REFUNDED and disables downloads. If the order included an exclusive, the admin decides whether to re-list the beat.

Test cards: `4242 4242 4242 4242` (success), `4000 0000 0000 9995` (decline), `4000 0025 0000 3155` (3-D Secure).

### 5.3 Auth & roles

- Better Auth with its Prisma adapter. v1 sign-in is Google only; magic-link sign-in comes with the email slice.
- **Middleware is only a convenience redirect, not the security boundary.** CVE-2025-29927 let attackers skip middleware on Next.js < 15.2.3. Every admin and account **page, route handler and server action** calls `requireAdmin()` / `requireUser()` from `lib/auth-guards.ts` on the server before doing anything.
- **Guest orders are linked to an account only when the email is verified.** A magic-link sign-in proves it. Google sign-in counts only if the profile has `email_verified === true`. Unverified accounts never see guest orders.
- When magic links ship (email slice), magic-link requests are **rate-limited** per email and per IP (e.g. 3 per 15 min).
- The first admin is created by the seed script using `ADMIN_EMAIL` from env.

### 5.4 Exclusive reservation (race-condition fix)

The problem is that two buyers can both pass the "not sold" check and both pay before the webhook marks the beat SOLD. The fix is to reserve atomically at checkout start:

```sql
UPDATE "Beat"
SET status = 'RESERVED', "reservedByOrderId" = $orderId, "reservedUntil" = now() + interval '30 minutes'
WHERE id = $beatId
  AND (status = 'PUBLISHED' OR (status = 'RESERVED' AND "reservedUntil" < now()));
-- 1 row changed → reserved. 0 rows changed → someone else has it.
```

- It's a single conditional UPDATE, so Postgres row locking guarantees only one winner. It's the same pattern as a coupon "claim" race (the CouponRush problem).
- RESERVED beats show "Reserved, check back soon" and can't be added to the cart as Exclusive. Leases stay purchasable.
- If a payment still gets through for an expired reservation that someone else then won, step 6 detects it (0 rows) and step 7 **refunds automatically**.
- Test: an integration test fires 20 concurrent `createCheckoutSession` calls for the same exclusive and asserts exactly 1 reservation.

### 5.5 Admin uploads

- `/api/upload` (admin only) issues presigned PUT URLs only under a fixed key prefix such as `uploads/<beatId>/<uuid>.<ext>`. The server picks the key; the client never chooses it. Content-Type is restricted by an allowlist.
- A presigned PUT **doesn't limit file size**. So after upload, before a beat can be published, the server runs a `HeadObject` to check size (cover ≤ 5 MB, MP3 ≤ 20 MB, WAV ≤ 200 MB, stems ZIP ≤ 1 GB) and **sniffs the magic bytes** (ID3/MPEG, RIFF/WAVE, PK zip, PNG/JPEG/WebP). Files that fail are deleted and publishing is blocked.
- Bucket CORS allows only `NEXT_PUBLIC_SITE_URL` (and `http://localhost:3000` in dev), with methods PUT and GET only.

---

## 6. Project Structure

```
Claude-code-project/
├─ PLAN.md
├─ README.md
├─ .env.example
├─ docker-compose.yml            # local Postgres
├─ prisma/
│  ├─ schema.prisma
│  ├─ migrations/
│  └─ seed.ts                    # license tiers, admin, ~12 demo beats
├─ scripts/
│  └─ make-preview.ts            # ffmpeg preview + tag
├─ audio-src/                    # full-quality demo sources + tag.wav (gitignored)
├─ public/                       # logo, placeholder covers
│  └─ previews/                  # generated demo previews (gitignored, until R2)
├─ src/
│  ├─ app/
│  │  ├─ (store)/layout.tsx      # header + footer (store pages only, not admin)
│  │  ├─ (store)/page.tsx        # home
│  │  ├─ (store)/beats/page.tsx
│  │  ├─ (store)/beats/[slug]/page.tsx
│  │  ├─ (store)/beats/[slug]/opengraph-image.tsx   # share image for social links
│  │  ├─ (store)/cart/page.tsx
│  │  ├─ (store)/checkout/success/page.tsx
│  │  ├─ (store)/account/page.tsx
│  │  ├─ (store)/licenses|faq|contact|terms|privacy/page.tsx
│  │  ├─ admin/(dashboard|beats|beats/new|beats/[id]|orders|coupons)/page.tsx
│  │  ├─ api/webhooks/stripe/route.ts
│  │  ├─ api/download/[orderItemId]/[fileType]/route.ts
│  │  ├─ api/upload/route.ts     # presigned upload URLs for admin
│  │  ├─ api/auth/[...all]/route.ts              # Better Auth handler
│  │  ├─ api/cron/fulfilment-retry/route.ts      # retry post-commit side effects: refunds (emails/PDFs in later slices), CRON_SECRET protected
│  │  ├─ api/cron/release-reservations/route.ts  # free expired exclusive reservations
│  │  └─ layout.tsx              # root: <html class="dark">, fonts; includes <PlayerBar/>
│  ├─ components/
│  │  ├─ layout/SiteHeader.tsx, SiteFooter.tsx
│  │  ├─ player/PlayerBar.tsx, PlayButton.tsx, Waveform.tsx
│  │  ├─ beats/BeatCard.tsx, BeatGrid.tsx, BeatFilters.tsx, LicenseSelector.tsx, LicenseTable.tsx
│  │  ├─ cart/CartDrawer.tsx
│  │  └─ ui/                     # shadcn components
│  ├─ lib/
│  │  ├─ db.ts                   # Prisma client singleton
│  │  ├─ catalog.ts              # catalog queries: filters, search, sort, pagination
│  │  ├─ stripe.ts
│  │  ├─ storage.ts              # previewUrl(); S3/R2 client, signUrl(), presignUpload()
│  │  ├─ auth.ts
│  │  ├─ auth-guards.ts          # requireUser(), requireAdmin(): called in every protected page/route/action
│  │  ├─ fulfilment.ts           # idempotent fulfilOrder() + post-commit side effects
│  │  ├─ reservation.ts          # reserveExclusive(), releaseReservation()
│  │  ├─ tokens.ts               # random download token + SHA-256 hash
│  │  ├─ ratelimit.ts            # later slice (Upstash)
│  │  ├─ email.ts                # later slice (Resend)
│  │  ├─ license-pdf.tsx         # later slice (PDF)
│  │  ├─ pricing.ts              # cart total, coupon, bundle logic (pure → unit-tested)
│  │  └─ validators.ts           # Zod schemas
│  ├─ actions/                   # server actions: checkout.ts, beats.ts, orders.ts, plays.ts
│  ├─ store/                     # Zustand: player.ts, cart.ts (persisted)
│  └─ emails/OrderReceipt.tsx    # later slice (Resend)
├─ tests/
│  ├─ unit/pricing.test.ts, validators.test.ts
│  └─ e2e/browse.spec.ts, checkout.spec.ts, admin.spec.ts   # later slice (Playwright)
└─ .github/workflows/ci.yml
```

---

## 7. Environment Variables (`.env.example`)

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/beatstore   # local Docker, host port 5433
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=          GOOGLE_CLIENT_SECRET=
ADMIN_EMAIL=admin@example.com      # put your real address only in .env (never committed)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
S3_ENDPOINT=               S3_REGION=auto
S3_ACCESS_KEY_ID=          S3_SECRET_ACCESS_KEY=
S3_PUBLIC_BUCKET=beatstore-previews
S3_PRIVATE_BUCKET=beatstore-files
PUBLIC_CDN_URL=
RESEND_API_KEY=            EMAIL_FROM=                # later slice (Resend)
NEXT_PUBLIC_SITE_URL=http://localhost:3000
CRON_SECRET=
UPSTASH_REDIS_REST_URL=    UPSTASH_REDIS_REST_TOKEN=  # later slice (Upstash)
```

`.env.example` contains **placeholders only**. It's committed to GitHub, so no real emails or keys go in it. It lists the v1 variables only; the later-slice ones (Resend, Upstash) are added when their slice starts.

---

## 8. Step-by-Step Roadmap

### Phase 0: Setup (day 1)

- [x] Install Node 24 LTS, pnpm and Docker Desktop (Stripe CLI comes in Phase 5, ffmpeg in Phase 3)
- [x] `pnpm create next-app` (TS, Tailwind, App Router, ESLint, `src/`); confirm it installed Next.js 16.x (well past the 15.2.3 fix for CVE-2025-29927)
- [x] Add Prettier, shadcn/ui init, Husky + lint-staged
- [x] `docker-compose.yml` with Postgres; add Prisma; write `.env.example`
- [x] Push the `develop` branch to a GitHub repo; add a basic CI workflow

### Phase 1: Database & seed (days 2–3)

- [x] Write `schema.prisma` (section 4) and run `prisma migrate dev`
- [ ] `seed.ts`: 4 license tiers, admin user, ~12 demo beats with royalty-free/own audio
- [x] `lib/db.ts` singleton

### Phase 2: Catalog & beat pages (days 4–7)

- [x] Layout, header/nav, footer, dark theme
- [x] `BeatCard`, catalog page with server-side filtering/search/sort/pagination (URL search params)
- [x] Beat detail page with metadata, `LicenseTable`, `LicenseSelector`, SEO metadata + Open Graph image
- [x] Home page sections

### Phase 3: Audio player (days 8–10)

- [x] Zustand `player` store (current track, queue, isPlaying, progress)
- [x] `PlayerBar` in the root layout using a single `<audio>` element
- [x] `Waveform` with wavesurfer.js on the beat page, synced to the global player
- [x] Increment `plays` (debounced, server action) after 10s of listening
- [x] Install ffmpeg
- [x] `scripts/make-preview.ts` ffmpeg pipeline

### Phase 4: Cart (days 11–12)

- [ ] Zustand `cart` store persisted to localStorage; one tier per beat
- [ ] `CartDrawer` plus `/cart` page; `lib/pricing.ts` (totals, bundle, coupon) with unit tests

### Phase 5: Stripe checkout (days 13–16)

- [ ] Create Stripe (test), Cloudflare R2 and Neon accounts, plus a Google OAuth client for sign-in
- [ ] `lib/stripe.ts`, `actions/checkout.ts` (section 5.2, server-side price lookup)
- [ ] `lib/reservation.ts`: atomic exclusive reservation inside the order transaction (5.4), session `expires_at` = 30 min
- [ ] Webhook route: raw-body signature check, `payment_status`/amount/currency check, `WebhookEvent` insert inside the transaction
- [ ] `lib/fulfilment.ts`: DB-only transaction, then retryable side effects (refund; PDF and email come with their later slices)
- [ ] Handle `checkout.session.expired` and `charge.refunded`; cron routes for retrying fulfilment and releasing reservations
- [ ] Success page runs fulfilment itself if the webhook is late and always shows the downloads; cancel page
- [ ] Concurrency test: 20 parallel checkouts for one exclusive → exactly 1 reservation
- [ ] Install the Stripe CLI and run `stripe login`
- [ ] Local testing: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`

### Phase 6: Delivery (days 17–19)

- [ ] `lib/storage.ts` with signed GET URLs
- [ ] `lib/tokens.ts`: 32-byte random guest token, only its SHA-256 hash stored, 30-day expiry
- [ ] Download route: owner or token check, PAID check, atomic `count < maxCount` limit (5 per file), 10-min signed URL
- [ ] Exclusive sale marks the beat SOLD (only if it's still reserved by this order) and hides it from the catalog
- [ ] Admin: reset download count / reissue guest token

### Phase 7: Auth & account (days 20–21)

- [ ] Better Auth with the Prisma adapter and Google sign-in (magic link comes with the email slice)
- [ ] `lib/auth-guards.ts` (`requireUser`, `requireAdmin`) called in **every** protected page, route and server action; `proxy.ts` (Next.js 16's name for middleware) only for redirects
- [ ] `/account` order history and re-downloads; link guest orders by email **only for verified emails** (Google with `email_verified`; magic link once the email slice exists)

### Phase 8: Admin panel (days 22–26)

- [ ] Admin layout and route guard
- [ ] Beat create/edit form (Zod), direct-to-R2 uploads via presigned PUT URLs with server-chosen keys under `uploads/<beatId>/`
- [ ] Post-upload check (5.5): `HeadObject` size limit and magic-byte type sniffing; publishing is blocked until all files pass
- [ ] R2 CORS: only the site origin (and localhost in dev), PUT/GET only
- [ ] Descriptions are plain text: render as text (React escapes it), never `dangerouslySetInnerHTML`
- [ ] License tier template editor and per-beat price overrides
- [ ] Orders table and detail page, refund (Stripe API)
- [ ] Dashboard stats and charts (revenue by day, top beats)
- [ ] Coupons CRUD (optional)

### Phase 9: Polish (days 27–29)

- [ ] Responsive/mobile pass, loading skeletons, empty states, error boundaries
- [ ] Accessibility: keyboard-controllable player, aria labels, contrast
- [ ] SEO: sitemap.xml, robots.txt, JSON-LD (Product/MusicRecording)
- [ ] Performance: `next/image`, caching of catalog queries, Lighthouse ≥ 90
- [ ] Legal/static pages and a "TEST MODE — no real payments" banner

### Phase 10: Testing & deploy (days 30–32)

- [ ] Vitest unit tests (pricing, validators, license tier rules, token hashing)
- [ ] Integration tests against a real Postgres: reservation race, duplicate and concurrent webhook delivery, download limit
- [ ] CI: `pnpm audit --audit-level=high` (plus Dependabot) so vulnerable Next.js/Better Auth versions fail the build
- [ ] Deploy to Vercel; Neon DB (`prisma migrate deploy`); R2 buckets plus CORS; production webhook endpoint in the Stripe dashboard (test mode)
- [ ] README with setup steps, screenshots, architecture diagram

### Later slices (after v1)

Built one at a time, only once the v1 phases above work. Each slice brings its own tests.

- [ ] **Rate limiting (Upstash):** `lib/ratelimit.ts`; limit checkout and download requests, and magic-link requests per email and per IP (e.g. 3 per 15 min)
- [ ] **Email (Resend + React Email):** receipt email after commit with `emailSentAt` set and retried by cron; apology email for a lost exclusive; "resend email" on the admin order page; magic-link sign-in. Magic links need the rate-limiting slice first.
- [ ] **License PDF (@react-pdf/renderer):** PDF per order item (buyer name/email, beat, tier, rights, date, order id), generated after commit and downloadable as `LICENSE`
- [ ] **E2E tests (Playwright):** browse, checkout and admin specs (section 10)

### Later ideas (v2)

Make-an-offer for exclusives, Stripe Connect, PayPal, beat bundles and packs, sound kits, analytics (PostHog), newsletter, live mode.

---

## 9. Security Checklist

**Payments**

- Prices are always recalculated on the server; client totals are ignored
- Exclusives are reserved atomically at checkout start, released on session expiry, and refunded automatically if a second payment slips through (5.4)
- The webhook verifies the signature against the **raw body** and fulfils only when `payment_status === "paid"` and amount and currency match the order
- Idempotency comes from a **unique `WebhookEvent` insert inside the fulfilment transaction**, not a check-then-process step
- No email or PDF work inside the DB transaction; side effects run after commit, are idempotent and retried by cron; the success page always shows the downloads

**Downloads**

- Private bucket for full files, 10-minute signed URLs, ownership or token checked on every download
- Guest token: 32 random bytes, only its SHA-256 hash stored, expires; order IDs are UUID/cuid2
- Download limit enforced atomically (`count < maxCount`), not just counted

**Auth**

- Middleware isn't a security wall (CVE-2025-29927). Use Next.js ≥ 15.2.3, and call `requireAdmin()` / `requireUser()` in every protected page, route handler and server action
- Guest orders link to an account only for verified emails
- Rate-limit magic-link emails, checkout and download endpoints (Upstash ratelimit)

**Uploads and content**

- Presigned uploads use server-chosen keys under a fixed prefix and a Content-Type allowlist; size and type are checked after upload (`HeadObject` + magic bytes) before publishing
- Bucket CORS allows only the site origin
- Beat descriptions are plain text and never rendered as raw HTML; Zod validation on all inputs

**Repo and CI**

- Secrets live only in env vars; `.env` is in `.gitignore`; `.env.example` has placeholders only (no real email)
- `pnpm audit` and Dependabot in CI

---

## 10. Verification (definition of done)

1. `docker compose up -d && pnpm prisma migrate dev && pnpm db:seed && pnpm dev`, then the catalog shows 12 demo beats
2. Previews play, the player bar keeps playing across page navigation, and the waveform seeks correctly
3. Add Basic + Exclusive to the cart, check out with `4242…`, and land on the success page. The order is PAID in the DB, MP3/WAV/stems download, and the exclusive beat now shows SOLD. (With the email and PDF slices, the email also arrives and the PDF downloads.)
4. The decline card `4000 0000 0000 9995` leaves the order PENDING/FAILED with no downloads
5. Replay the webhook with `stripe events resend <id>`, and also send two deliveries at the same time. Exactly one fulfilment happens.
6. Opening a download URL for someone else's order returns 403; a wrong or expired guest token returns 403; the 6th download of a file returns 429; a signed URL stops working after it expires
7. A non-admin visiting `/admin` is redirected, **and** calling admin server actions or routes directly (e.g. with an `x-middleware-subrequest` header) returns 401/403; an admin can upload a beat and see it published
8. **Exclusive race:** two browsers start checkout for the same exclusive and only one reaches Stripe. Let one session expire: the beat becomes available again. Force a second payment through (test helper) and it's refunded automatically.
9. **Late or failed email (email slice):** with Resend disabled, the purchase still shows downloads on the success page, and the cron job sends the email once Resend works again
10. A webhook with a tampered body or a mismatched amount isn't fulfilled
11. An oversized or wrong-type upload blocks publishing; a description containing `<script>` renders as plain text
12. Signing up with Google using an unverified email that matches a guest order does **not** show that order
13. `pnpm lint && pnpm typecheck && pnpm test && pnpm audit` all pass in CI (plus `pnpm test:e2e` once the Playwright slice exists)
14. The deployed Vercel URL runs the same checkout flow end to end in test mode
