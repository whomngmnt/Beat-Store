# Progress

Claude updates this file at the end of each task. Newest entries go first in the log.

## Current status

- **Stage:** Phase 8 (admin panel) is built and every Phase 8 box is ticked. It is committed and pushed to `develop` (commit "Phase 8: admin panel, uploads, license tiers, dashboard and coupons"). Lint, typecheck, 169 unit tests and 79 integration tests pass. Phases 6 and 7 are done. Phase 6's admin box moved to Phase 8 (user's choice, 2026-11-17), so every Phase 6 box is ticked. All three Phase 7 boxes are ticked. Phase 7 is committed and pushed to `develop` (commit "Phase 7: Google sign-in, /account and owner downloads"). Only the Phase 5 accounts box is open (R2 and Neon; Stripe and Google are done).
- **Branch:** all work on `develop`. `main` is protected on GitHub and only changes through a pull request. Everything up to the Phase 8 commit is pushed to `origin/develop`.
- **Phase 9 (polish): all 5 items are done and ticked.**
  - Item 5 (legal and static pages, "TEST MODE" banner) is committed on `develop` (commit "Phase 9: legal pages, contact page and test-mode banner"), not pushed yet.
  - Item 3 (SEO: sitemap.xml, robots.txt, JSON-LD) is committed on `develop` (commit "Phase 9: sitemap, robots.txt and JSON-LD on beat pages"), not pushed yet.
  - Items 1, 2 and 4 (mobile pass, skeletons, empty states and error pages; accessibility; performance) are committed together on `develop` (commit "Phase 9: mobile pass, error pages, accessibility and performance", user's OK on 2026-11-18), not pushed yet. That includes removing the beat page's waveform and the `wavesurfer.js` package (user's choice, 2026-11-18). Lint, typecheck, 175 unit tests, 79 integration tests and `pnpm build` pass. The status-code question below was committed as Claude suggested (keep the skeletons) and can still change.
- **Next step:** Phase 10 (testing and deploy). The user OK'd the plan on 2026-11-18: commit Phase 9 first, `main` is the branch that goes live on Vercel, and the cron jobs run once a day.

## Open questions

- **Lighthouse scores depend on how busy this PC is.** The final runs (log, 2026-11-18, waveform removed) give 94–100 for mobile performance on all three pages. Earlier runs, while the PC was busier, gave 78–90 for home with no change to its code. Lighthouse's own CPU speed measure for the machine was 379–1182 then and 1496–2030 for the final runs. If a later run on a busy PC dips under 90, run it again before changing code. Phase 10's deployed site is the better place to measure.
- **The beat page's meta description arrives in `<body>`.** Lighthouse SEO says "Document does not have a meta description" (91). The tag is there, but after `</head>`. `generateMetadata` reads the database, and Next.js 16 streams metadata to browsers. It holds the page back for metadata only for HTML-only bots, the `htmlLimitedBots` list. Next.js says this is fine for Googlebot, which runs JavaScript. Not changed. If wanted: `htmlLimitedBots: /.*/` in `next.config.ts` puts metadata in `<head>` for everyone, at the cost of a later first paint. Claude didn't check whether this started before item 1's skeletons.
- **No cover image seen through `next/image` yet.** No beat in the local database has a cover (11 published, 1 sold, 0 covers). Checked by asking the optimizer directly on `pnpm start`:
  - a storage URL passes `remotePatterns`;
  - a foreign URL (`example.org`) is refused by the pattern;
  - the storage URL is then refused because `localhost` is a private IP. `dangerouslyAllowLocalIP` is on only in dev, so locally covers show on `pnpm dev` but not on `pnpm start`. On Vercel the R2 public URL isn't a private IP.
  - To see one: upload a cover in `/admin` on `pnpm dev`, then look at the card and the beat page.
- **A localhost tab may keep reloading in the user's Chrome.** During this task the dev server got `GET /beats/first-light` about once a second from a Chrome tab outside Claude's tab group. A recompile followed each request. Cause not found; the guess is that the dev server's own log and trace writes set off reloads. Claude stopped the dev server. If a `localhost:3000` tab keeps reloading the next time `pnpm dev` runs, close it.
- **Status codes after a skeleton (decision for the user, 2026-11-18).** With a `loading.tsx` above a page, Next.js sends the skeleton with status 200 first, so the status can't change afterwards (Next.js docs, loading.js "Status codes").
  - A missing or draft beat (`/beats/<bad-slug>`) still shows the 404 page and gets `<meta name="robots" content="noindex">`, but the status is 200, not 404.
  - `/account` signed out still goes to `/sign-in`, but as a redirect done in the page, not an HTTP 307.
  - Admin pages keep the real 307: `requireAdmin()` runs in the admin layout, above `admin/loading.tsx`.
  - Unknown URLs (`/nope`) still return a real 404.
  - Nothing in PLAN.md or the tests depends on these codes. Buyers see the same pages, and `noindex` keeps missing beats out of search.
  - Claude's suggestion: keep it. The other way is to drop the `(store)` and `/beats` skeletons, or move the catalog page into its own route group, so the beat page and `/account` render fully before sending a status.
- **Mobile pass: not seen in a browser.**
  - `/account`: Chrome wasn't signed in, so it went to `/sign-in`. Its header stacks on phones from the code only.
  - The admin pages: the user's earlier choice. The nav wrap and the "No beats yet" message are from the code only.
  - `/checkout/success`: needs a real order.
- **Docker Desktop is now running** (Claude started it on 2026-11-18 with the user's OK), with `docker compose up -d`. So `/sitemap.xml`, `/licenses` and a beat page's JSON-LD can be checked now. They weren't checked in this task.
- **`/sitemap.xml` and the beat page's JSON-LD not seen running yet.** Docker was off on 2026-11-18, so on the dev server only `/robots.txt` loaded (200, right content). `/sitemap.xml` gave 500 because Postgres refused the connection. Both need `docker compose up -d`. Then also paste a beat page's URL into Google's Rich Results Test or validator.schema.org once the site is deployed (Phase 10): neither can reach localhost.
- **Contact details are placeholders.** The user doesn't have the accounts yet (2026-11-18). Their local `.env` now has `CONTACT_EMAIL=contact@example.com` and `your-name` links for Instagram, TikTok and YouTube, to swap for real ones later. `.env.example` keeps them empty. Where they're empty (e.g. on Vercel until set), `/contact` says "Contact details aren't set up yet". The page has no dynamic code, so `next build` bakes the values in: on Vercel, changing one needs a redeploy.
- **Terms and privacy text is Claude's plain-English summary, not legal text.** Fine while the store is test mode only. It needs a real review before live mode (v2). The privacy page lists only what the code stores today; the email and PDF slices must update it.

- **Phase 8 admin pages not checked in a browser (user's choice, 2026-11-17).** The user said not to check them. They're covered by the integration tests only. Checked in the browser:
  - the catalog, the beat page, and the cart with its new coupon field (a wrong code shows "This coupon code isn't valid")
  - signed-out visits to `/admin/*` and `/api/upload` go to `/sign-in`

  Never seen in a browser:
  - each admin page
  - a real cover and file upload
  - publish and back to draft
  - a price change
  - a coupon, then a test checkout with it (Stripe's page should show the discount)
- **Phase 8 was built without the plan-first step.** The user said "do phase 8" after the task list, so there was no plan to OK per task. Every decision is in the 2026-11-17 Phase 8 log entry below and can still change.
- **Stripe test coupons pile up.** Each checkout with a discount creates its own one-off Stripe coupon (`max_redemptions: 1`). That keeps Stripe's total equal to ours to the cent, but the Stripe test account collects one coupon per discounted checkout. Fine for test mode; revisit if it gets noisy.
- **Replaced uploads stay in storage.** Uploading a new file for a beat saves the new key and leaves the old object where it is. Download links always use the beat's current key, so nothing points at the old file, but deleting files can't be undone, so that's left for a decision (a clean-up job is a later idea).
- **License terms aren't snapshotted.** `OrderItem` keeps the license name and price, but not the terms or limits. Editing a tier on `/admin/licenses` changes what new buyers read; no page shows terms for a past order. The license PDF slice will need a terms snapshot on the order item.
- **`storage:setup` on R2 (Phase 10).** The script sets CORS on both buckets the same way on R2. R2 has no bucket policies: the public bucket is made public in the Cloudflare dashboard (r2.dev or a custom domain), and `PUBLIC_CDN_URL` points there. The script prints a warning about that.
- **Signed-in re-download not tried in a browser.** On 2026-11-17 the user skipped the test payment, so the admin account has no paid order. Downloading from `/account` without a token is covered by integration tests only (`download.test.ts`). A PENDING test order (Glass Heart Premium, $49.99, owned by the admin) is left in the local database. Its Stripe session expires 31 minutes after it was made.
- **Google sign-in is in Testing mode.** Only the test users listed in Google Cloud (project `beat-store-dev`, Google Auth Platform → Audience) can sign in. Right now that's the admin's Google account. Before real buyers sign in (Phase 10): publish the app, add the production redirect URI `https://<domain>/api/auth/callback/google`, and check Google's current rules for apps that ask only for `openid email profile`.
- **Better Auth is pinned to 1.7.22.** The 2026-11-14 plan note called 1.7.23 the latest, and 1.7.25 is out now. No advisory was found for 1.7.22, and `pnpm audit --audit-level=high` passes. The user asked to commit Phase 7 at 1.7.22 without deciding, so whether to bump is still open.
- **Hydration warning from Grammarly, not our code.** The Next.js dev overlay shows "1 issue": a hydration mismatch on `<body>` from `data-gr-*` attributes, which the Grammarly browser extension adds. It doesn't happen in a browser without the extension.
- **Downloads work locally, but R2 hasn't been tried.** On 2026-11-14 a real test purchase downloaded real files from the local SeaweedFS server. R2 itself still has to be set up before deploying (Phase 10): create the bucket, put its `S3_*` values in the deployed env, upload a file and download it once. The links use path style there too.
- **The raw guest token is stored at Stripe.** It's part of the Checkout Session's `success_url`, so anyone with access to the Stripe account can see it. This was accepted when choosing option A.
- **Stripe feedback not sent.** The user approved sending feedback about `stripe listen` needing `--events`. Claude Code's auto mode blocked the command as an external write. The user can run it with `!` if they still want it sent.
- **Phase 5 was built without the plan-first step.** The user asked to "implement every task from phase 5 and just tell how you did it", so there was no plan to OK. After reading the summary, which listed the timing change and the new fields below, the user asked to commit and push. So both are in `aa610f2`, and either can still change if the user says so.
- **Timing change from PLAN.md (committed).** Stripe refuses a session that expires less than 30 minutes after it creates it, so "now + 30 min" counted on our server can fail. The session now lasts 31 minutes and the exclusive hold 35, so the hold can't run out while the buyer can still pay. PLAN.md §5.2 and §5.4, `exclusives.md` and `stripe-checkout.md` were changed to match.
- **New schema fields (committed).** `Order.reviewNote` (a payment that doesn't match the order) and `OrderItem.refundNeeded` / `refundedAt` (the lost-exclusive refund the cron job retries). PLAN.md §5.2 needs both, but §4 didn't have them. Migration `20261111065236_phase5_review_and_refund`.
- **Cancel blocks your own exclusive.** If a buyer cancels on Stripe's page, their exclusive stays held until the session expires (up to 31 min), so they can't check it out again until then. A possible fix: put the order id in the cancel URL and have the cancel page expire the Stripe session. Not built: the decision is the user's.
- **An expired hold looks reserved until it's freed.** The cart blocks the exclusive of any RESERVED beat, even when `reservedUntil` has passed, until the `checkout.session.expired` webhook or the cron job frees it. The reservation SQL's "take over an expired hold" branch is then only a safety net.
  - **Seen for real on 2026-11-13:** Dusty Crates stayed RESERVED for about 22 hours after its hold ran out. `stripe listen` wasn't running when Stripe sent the expired event, and the CLI doesn't replay missed events. Nothing runs the cron locally either. Resending the event freed it.
  - **In production** Stripe retries webhooks and the cron runs, so this gap is local only.
- **`CRON_SECRET` isn't in `.env`.** Both cron routes return 401 locally until it's set. `.env.example` already has the placeholder. It wasn't added because `.env` is the user's file.
- **Vercel Cron limits (Phase 10).** The plan runs the cron routes every 5 minutes. Check Vercel's current plan limits when deploying: the Hobby plan has allowed only daily cron jobs. No `vercel.json` yet: deploying is Phase 10.
- Known issue, set aside by the user: GitHub refuses every Actions run with "account is locked due to a billing issue", so CI shows red. Only GitHub Support can lift it. Don't investigate again unless the user asks.

## Decisions needed later

Recorded 2026-11-07. The user said not to change any code for these now.

- **Guest download link (Phase 6): decided 2026-11-13, option A.** The token is made at checkout. Its hash goes on the order, and the raw token goes in Stripe's `success_url`, so the success page is the bookmarkable download link.
- **Guest email (Phase 5): done with the default.** Fulfilment saves the email the buyer typed in Stripe Checkout (`customer_details.email`) on the order.
- **Admin sign-in (Phase 7): done 2026-11-17.** The seed now marks the admin as verified. Signing in with Google under `ADMIN_EMAIL` linked to the seeded admin: one user, role ADMIN, a `google` account row, and no second user.
- **Neon time zone (when Neon is set up, Phase 5).** Reminder: Neon is in this phase's account list. Timestamps are `timestamp(3)` without time zone, which is safe only while the database session runs in UTC (local Docker: `UTC`). The raw reservation SQL uses `now()`. Check Neon's time zone then and decide whether anything needs to change.

## Log

### 2026-11-18: Phase 9 item 4, waveform removed from the beat page (built, not committed)

Lighthouse showed that the beat page's waveform downloaded the whole 1.4 MB preview and decoded it in the browser on every visit, just to draw the bars. On a phone that's about 1 s of work before taps respond. Claude suggested saving the peaks at upload. Because ffmpeg isn't on Vercel, that meant computing them in the admin's browser or adding a decoder package. The user chose to remove the waveform instead, knowing it changes PLAN.md, and OK'd the file list.

- **Removed:**
  - `src/components/player/Waveform.tsx`.
  - The `wavesurfer.js` package (`pnpm remove`). The lockfile only lost its own lines.
  - `playQueue`'s `startAt` option in `src/store/player.ts`, with its 2 tests. Only the waveform's "click a spot to start there" used it.
- **Beat page:** the big Play button stands alone. A comment says why there's no waveform. Seeking is in the player bar. The skeleton's 64 px waveform row is now a Play-button-sized block.
- **Docs:**
  - `CLAUDE.md`: Stack line without wavesurfer.js.
  - PLAN.md: §2 Audio row, §3 beat page ("a play button"), §6 player folder, §10 manual test 2 ("its seek slider works"). The Phase 3 Waveform box stays ticked, with a removal note.
  - §8 item 4 ticked.
- **Seen in Chrome** (production build): the page has no drawing and no console errors. The MP3 is requested only by the player's `<audio>` after Play is pressed, and Play works from the keyboard.
- **Lighthouse 13.6.0**, production build, all runs in the same session:

  | Page | Mobile performance (3 runs) | Median |
  |---|---|---|
  | Home | 99 / 100 / 99 | 99 |
  | `/beats` | 97 / 100 / 99 | 99 |
  | Beat page | 100 / 94 / 99 | 99 |

  - Beat page on desktop: 100.
  - Accessibility and best practices: 100 on every run.
  - SEO: 100, except 91 on the beat page (meta description, see Open questions).
  - No MP3 request on page load.
  - This PC was less busy than in the earlier runs (see Open questions), so the before/after gap is partly the machine. The waveform's own cost (the 1.4 MB download and the decoding) is gone for certain.
- **Checks:** lint, typecheck, Prettier, 175 unit tests (177 minus the 2 `startAt` tests) and `pnpm build` pass. Integration tests weren't re-run: nothing they cover changed.

### 2026-11-18: Phase 9 items 2 and 4, accessibility and performance (built, not committed)

The user asked for "2 and 4 from phase 9" and OK'd the plan, including a one-off `pnpm dlx lighthouse@13.6.0` (not added to `package.json`).

- **Accessibility (item 2):**
  - `src/components/layout/SkipLink.tsx` (new, not in the plan's file list): a "Skip to content" link, hidden until focused. It's the first child of the store and admin layouts, and each layout's `<main>` now has `id="main"`.
  - `PlayerBar`: the seek slider says "0:12 of 1:30" and the volume slider says "90%" to screen readers (`aria-valuetext`), instead of raw numbers.
  - `skeleton.tsx`: the pulse stops for people who turn animations off (`motion-reduce:animate-none`).
  - **Bug found in the keyboard test, fixed:** quick arrow presses on the seek slider moved the audio only one step. `seek()` in `src/store/player.ts` set the audio's time but left the store's `currentTime` until the next `timeupdate`, so the slider jumped back between presses. `seek()` now stores the new time at once, which also stops small arrow-key skips from counting toward the 10 s "listened" total. There are 2 new tests in `player-store.test.ts`; both fail without the fix. The waveform listens to the store too, so it now moves as soon as it's clicked. It only seeks on a click, so this can't cause a loop.
  - **Keyboard-only check** on the beat page, production build, desktop Chrome:
    - Tab 1 is the skip link, and Enter on it lands on Play.
    - Enter plays the beat, and the label becomes "Pause First Light".
    - The arrow keys change the license.
    - Enter on Add to cart opens the cart drawer, with focus inside.
    - Tab can't leave the drawer (8 Tabs and focus is still inside).
    - Escape closes the drawer and puts focus back on the button that opened it.
    - In the player bar: Space plays and pauses; Right and Left move 0.9 s, Page Up 9 s, Home goes to 0:00; Down lowers the volume.
    - Every stop shows a focus ring. Afterwards the cart was put back as it was (Glass Heart only).
  - Contrast: Lighthouse's accessibility score, which checks contrast, is 100 on all 6 runs.
- **Performance (item 4):**
  - `next/image` now resizes covers: `unoptimized` is gone from `BeatCard`, the beat page and the admin beat page. `sizes` matches each layout, and the beat page cover has `preload`. `next.config.ts` allows images from `PUBLIC_CDN_URL` only (`remotePatterns`), and allows localhost only in dev (`dangerouslyAllowLocalIP`).
  - Catalog caching in `src/lib/catalog.ts`: the catalog page, featured, newest, sitemap and filter-option queries are wrapped in `unstable_cache`, tagged `catalog`, and kept for at most 60 s. `use cache` would need `cacheComponents: true`, a much bigger change. The beat page and the cart stay uncached, so prices and status there are always read fresh. The admin actions that change what's on show call `updateTag("catalog")`: update beat, status, prices, file. Creating a beat doesn't, because drafts aren't listed. Sales flip a beat to RESERVED or SOLD outside those actions, so the catalog can show the old badge for up to 60 s. The beat page and checkout always check the real status.
  - **Lighthouse fixes:**
    - The beat page shifted by 0.27 when it replaced its skeleton (desktop performance 73). The skeleton was much shorter than the page, so the footer showed and the scrollbar appeared afterwards. The beat skeleton is now about as tall as the page, and `scrollbar-gutter: stable` in `globals.css` keeps room for the scrollbar. Shift is now 0, and desktop performance is 91.
    - Every page logged a 404 for `/favicon.ico` (best practices 96). `src/app/icon.svg` is a small bars icon, and Next.js adds its `<link>` itself. Best practices is now 100.
  - At this point mobile performance was under 90 on the beat page and home, so the user chose to remove the waveform (next entry up), which has the final scores.
- **Checks:** lint, typecheck, Prettier, 177 unit tests, 79 integration tests and `pnpm build` pass.

### 2026-11-18: Phase 9 item 1, mobile pass, skeletons, empty states, error pages (built, not committed)

The user asked for "phase 9 part 1" and OK'd the plan, including starting Docker Desktop.

- **Skeletons (new):**
  - `src/components/ui/skeleton.tsx`: shadcn's Skeleton, added with `pnpm shadcn add skeleton`. No new package.
  - `(store)/beats/loading.tsx`: title, the filter grid and 6 cards.
  - `(store)/beats/[slug]/loading.tsx`: cover, title lines and the license block.
  - `(store)/loading.tsx`: plain lines, for home, `/account`, `/licenses` and the success page.
  - `admin/loading.tsx`: a heading and a block.
  - Each has an `sr-only` "Loading…".
  - Checked with a temporary 5 s delay in the two beat pages, at 375 and 1280 px. The delay was removed (git diff shows no change to either page).
- **Error pages (new):**
  - `(store)/error.tsx`: inside the header and footer. "Something went wrong", a Try again button (`retry()`, stable since Next.js 16.3) and a link to `/contact`.
  - `admin/error.tsx`: the same inside the admin nav, pointing to the server log.
  - The error itself isn't shown: in production the browser only gets a generic message.
  - No `global-error.tsx`: the root layout only sets the font and the player.
- **404 (new):**
  - `src/app/not-found.tsx`: unknown URLs (real 404, dark like the site).
  - `(store)/not-found.tsx`: re-exports it, so `notFound()` on the beat page keeps the store header.
- **Empty state:** `/admin/beats` says "No beats yet" instead of showing an empty table. Every other list already had one.
- **Mobile fixes**, checked by loading each page in a 375 px-wide iframe (360 px usable) on the dev server:
  - Header: the logo name wrapped onto two lines. It's icon-only below `sm` now, with the name in `sr-only`.
  - `LicenseTable` (beat page, `/licenses`): the page scrolled sideways by 13 px. The `sr-only` labels in the cells are `position: absolute` and escaped the `overflow-x-auto` box. `relative` on the box fixes it.
  - Player bar: the seek slider was 26 px wide. On phones the gaps are smaller and the times are hidden, so it's 108 px now.
  - `/beats` filters: one field per row filled the whole first screen. Two columns below `lg` now (5 rows instead of 9). Desktop is unchanged. The skeleton matches.
  - Admin nav: `flex-wrap`, so its 7 links don't run off a phone screen.
  - `/account` header: the buttons go under the title on phones.
  - No sideways scroll on: home, `/beats`, a beat page, `/cart`, the cart drawer, `/licenses`, `/faq`, `/contact`, `/terms`, `/privacy`, `/sign-in`, `/checkout/cancel`, the 404 page.
- **Seen in the browser:**
  - With the database off: `/beats` showed the new error page inside the store frame.
  - `/beats/Not_A_Slug` showed the 404 with the header.
  - `/nope` returned a real 404.
- **Found along the way:** the beat 404 now returns 200 (see Open questions). Also, a dev server left from the SEO task had broken when `pnpm build` ran next to it (a reload loop and "Jest worker" errors). Claude stopped it and started a fresh one. Don't run `pnpm build` while `pnpm dev` is running.
- **Checks:** lint, typecheck, 176 unit tests and `pnpm build` pass. No new tests: the new files are layout without logic.

### 2026-11-18: Phase 9 item 3, SEO (committed, not pushed)

The user asked for "phase 9 part 3", OK'd the plan, and said to commit.

- **`src/lib/seo.ts`** (new):
  - `siteUrl` (`NEXT_PUBLIC_SITE_URL`, falling back to localhost).
  - `beatJsonLd(beat)`, which builds one object typed `["Product", "MusicRecording"]` with name, description, url, cover image, genre, keywords and one `Offer` per active license.
  - Prices come from `centsToDollars()`, so 2999 → "29.99" with no floats.
  - A RESERVED beat's Exclusive is `OutOfStock`. A SOLD beat gets no offers, because its page shows no prices.
  - Empty fields are left out.
- **No raw HTML.** The beat page renders `<script type="application/ld+json">{text}</script>`. React 19 writes a script's string child unchanged and escapes any `</script` inside it. Before the text reaches React, every `<` is also turned into `<`. `no-raw-html.test.ts` still passes. It caught a comment that named the forbidden prop, which was reworded.
- **`src/app/sitemap.ts`** (new):
  - Lists the 7 store pages, then every beat on show (new `getSitemapBeats()` in `catalog.ts`, same rule as `/beats`, so drafts and sold beats are left out).
  - `await connection()` makes it run per request, so `next build` needs no database.
  - No `lastModified`: `Beat` has no `updatedAt`.
- **`src/app/robots.ts`** (new):
  - Allows everything except `/admin` and `/api/`, and links to the sitemap.
  - `/account`, `/checkout` and `/sign-in` stay crawlable on purpose, so crawlers can read their `noindex`.
- **Not done (kept to SEO):** images in the sitemap, site-wide JSON-LD on the home page, and switching the 3 older `NEXT_PUBLIC_SITE_URL || …` copies (root layout, `checkout.ts`, `downloads.ts`) over to `siteUrl`.
- **Checks:**
  - Lint, typecheck and 176 unit tests pass (7 new in `tests/unit/seo.test.ts`).
  - `pnpm build` passes with the database off: `/robots.txt` is static, `/sitemap.xml` is dynamic.
  - On the dev server, `/robots.txt` was right. `/sitemap.xml` returned 500 (Docker off).
  - PLAN.md §6 lists the new files, and §8's SEO box is ticked.

### 2026-11-18: Phase 9 item 5, legal pages and test-mode banner (committed, not pushed)

The user chose item 5 first, OK'd the plan and picked: contact page with email, Instagram, TikTok and YouTube; banner on shop pages only; "contact support" turned into links.

- **Banner** (`src/app/(store)/layout.tsx`): an amber line above the header, "TEST MODE — no real payments. Pay with the test card 4242 4242 4242 4242." Always shown, with no env check, because `src/lib/stripe.ts` already refuses any key that isn't `sk_test_`. Not on `/admin`.
- **New pages** in `src/app/(store)/`. The footer and header already linked to all five, so they were 404s until now.
  - `licenses`: all four tiers from the database, in the same `LicenseTable` as the beat page (with default prices), then each tier's description and terms. `await connection()` like the home page, so `next build` needs no database. Edits on `/admin/licenses` show here.
  - `faq`: payments in test mode, which license, no account needed, how downloads work (5 per file, 30-day link), re-downloads from `/account`, the exclusive hold, and what to do when downloads run out.
  - `contact`: email and social links from env vars. Any that's empty is left out.
  - `terms`: test mode, licenses, tagged previews, downloads, accounts.
  - `privacy`: what's stored (from `prisma/schema.prisma` and the cart in localStorage), the services used, and how to ask for data to be changed or deleted.
- **"Contact support"** on the success page (expired link) and the sign-in error now links to `/contact`. The download route's 404/429 messages are plain-text responses, so they stay as text.
- **Env:** `CONTACT_EMAIL`, `INSTAGRAM_URL`, `TIKTOK_URL`, `YOUTUBE_URL` added (empty) to `.env.example` and PLAN.md §7.
- **Checks:** lint, typecheck and 169 unit tests pass. No new tests: the pages are text, and `/licenses` is one `findMany`. On the dev server, `/faq`, `/terms`, `/privacy` and `/contact` returned 200 with the banner. `/licenses` wasn't loaded (Docker off).
- **Placeholders:** the user has no contact accounts yet, so placeholder values went into their local `.env` (not committed). The user said to commit.

### 2026-11-17: Phase 8, admin panel (committed and pushed)

The user said "do phase 8" (and earlier "we should build coupons"), so all six tasks were built in one go. Every choice below can be changed.

**1. Admin shell and orders**
- **Layout:** `src/app/admin/layout.tsx` calls `requireAdmin()` and shows the nav: Dashboard, Beats, Orders, Licenses, Coupons. Every admin page, route and action also calls `requireAdmin()` itself.
- **Pages:**
  - `/admin/orders`: 25 orders per page.
  - `/admin/orders/[id]`:
    - the order's details and items
    - each download with "Reset to 0"
    - "Make a new guest download link" (the link is shown once)
    - a refund form with a required tick box
- **Refunds** (`src/actions/orders.ts`):
  - They refund what's left of the payment, with the idempotency key `refund-order-<orderId>`.
  - The order turns REFUNDED when Stripe's `charge.refunded` webhook arrives, not in the action.
  - The amount shown is the total minus any lost exclusive that was already refunded.
- **`/account`:** shows an "Admin panel" link to admins.

**2. Beats (`/admin/beats`, `/new`, `/[id]`, `src/actions/beats.ts`)**
- **New beats:** a new beat is a DRAFT with every license on at its tier's default price. Its files are uploaded on its edit page, because their keys contain the beat id.
- **Publishing** needs (`publishProblems()` in `src/lib/uploads.ts`):
  - a preview
  - at least one license on
  - every file an active license includes

  The cover is optional. The edit page lists what's missing.
- **Status changes** are one conditional UPDATE:
  - DRAFT or SOLD → PUBLISHED
  - PUBLISHED or SOLD → DRAFT
  - A RESERVED beat never changes, because a checkout is holding it.
  - Re-listing a SOLD beat is how "the admin decides whether to re-list" after a refund works.
- **Prices:**
  - Typed in dollars and read into cents with whole-number maths (`dollarsToCents`).
  - Allowed range: $0.50 (Stripe's minimum) to $999,999.99.
  - Unticking a license takes it off sale.
  - A published beat refuses a price change that would leave it unpublishable.
- **No "delete beat":** orders point at beats. Move a beat to draft instead.
- **Descriptions:** stored as typed and rendered by React as text. `tests/unit/no-raw-html.test.ts` fails if any file in `src/` uses `dangerouslySetInnerHTML`.

**3. Uploads (`/api/upload`, `attachBeatFile`)**
- **The upload link:**
  - The browser asks `/api/upload` for a 10-minute PUT link.
  - The server picks the bucket and the key (`uploads/<beatId>/<uuid>.<ext>`). The Content-Type must be on the allowlist for that kind of file.
  - The link **signs the Content-Type**, so the PUT must send exactly that type.
- **The check after the upload** (`attachBeatFile`):
  - It checks the key's shape, runs `HeadObject` for the size limit of that kind of file, and reads the first 12 bytes (magic bytes).
  - A file that fails is deleted and its key is never saved, so publishing stays blocked.
  - PLAN.md §5.5 says "after upload, before publishing"; this runs at upload time. §5.5 and `uploads.md` now say so.
- **Bug found and fixed:**
  - The cause: AWS SDK 3.1167 adds a CRC32 checksum to every PUT. In a presigned link that's the checksum of an empty body, so every real upload failed with `BadDigest`.
  - The fix: the S3 client now uses `requestChecksumCalculation: "WHEN_REQUIRED"`.
  - Checked against local storage: the right type uploads (200), and a different Content-Type is refused (403). A test checks that the link has no checksum.
- **Covers are public, like previews:**
  - `Beat.coverUrl` was renamed to `coverKey` (migration `20261117082201_phase8_cover_key`). It's a RENAME, so no data is lost, and DB columns hold keys, never URLs.
  - Covers show on beat cards and the beat page through `next/image` with `unoptimized` for now. Resizing is Phase 9.
- **Local public bucket:**
  - `pnpm storage:setup` (new, `scripts/setup-storage.ts`) creates both buckets and makes the public one readable.
  - It also sets CORS on both: the site origin plus `http://localhost:3000` outside production, PUT and GET, and the Content-Type header.
  - `pnpm demo:upload` now also puts the 12 demo previews in the public bucket.
  - In `.env`, `PUBLIC_CDN_URL=http://localhost:8333/beatstore-previews`. `.env.example` keeps it empty, with a comment.
- **Rename:** `previewUrl()` in `storage.ts` became `publicUrl()`, since covers use it too.

**4. License tiers (`/admin/licenses`, `src/actions/licenses.ts`)**
- **Editable:** name, short description, default price, stream and video limits (empty means unlimited), and terms.
- **Read-only:** code, included files and display order. Published beats were checked against the included files.
- **Default price:** used for new beats only. Existing beats keep their own prices.

**5. Dashboard (`/admin`, `src/lib/dashboard.ts`)**
- **Tiles:** revenue, paid orders, preview plays, published beats.
- **Revenue:** PAID orders minus items refunded afterwards (lost exclusives). REFUNDED orders count as nothing. Days are UTC.
- **Charts:** revenue by day (30 days) and two top-5 lists (sales, plays), drawn as plain CSS bars in `src/components/admin/Bars.tsx`:
  - one colour, with the values in text
  - a hover/focus label for each day
  - a "Show as a table" view
- **"Top beats by sales"** uses license prices before coupons.

**6. Coupons (`/admin/coupons`, `src/actions/coupons.ts`, checkout)**
- **Creating a code:**
  - Exactly one of percent off (1–100) or amount off, plus an optional last day (UTC).
  - Codes are stored in capitals, so buyers can type them in any case.
  - A coupon can be turned off and on. One that no order uses can be deleted.
  - Its discount can't be edited: make a new code instead.
- **At checkout:**
  - The server looks up the code; it must be on and not expired.
  - The discount: a percent is rounded down to whole cents, and a fixed amount is at most the leases' total.
- **Coupons don't apply to Exclusives:**
  - The reason: a lost exclusive is refunded at its full price (`fulfilment.ts`), which is only right if no coupon touched it.
  - A cart with only an Exclusive gets "Coupons don't apply to Exclusive licenses."
- **The order:**
  - A total under $0.50 is refused.
  - `Order.couponId` is set, and `totalCents` is the discounted total.
- **Stripe:**
  - Stripe gets a one-off coupon for exactly that discount, passed in `discounts`.
  - Its settings: `amount_off`, `duration: once`, `max_redemptions: 1`, idempotency key `coupon-<orderId>`.
  - So Stripe's `amount_total` matches the order to the cent, and the webhook's amount check still passes.
- **Where buyers see it:**
  - The cart has a "Coupon code (optional)" field, but no discount preview. Stripe's page shows the discount.
  - The success page and the admin order page show a coupon line.

**Shared pieces and names**
- **`src/components/admin/FormParts.tsx`:**
  - the form hook, which keeps typed values when the server says no
  - the message and field pieces
  - used by the beat, tier and coupon forms
- **`validators.ts`:** now holds `FormResult` and `invalidForm()`.
- **Files not in PLAN.md §6:** `AdminLabels.tsx` (status badges and UTC dates) and `OrderActionForms.tsx` (refund, new link). §6 now lists `components/admin/`.
- **`MIN_PRICE_CENTS`** (50) in `pricing.ts` is used by both prices and coupons.

**Tests**
- **Unit tests cover:**
  - price parsing and coupon maths
  - the beat, tier and coupon form schemas
  - upload keys and magic bytes
  - `publishProblems`
  - the dashboard's days
  - no raw HTML in `src/`
- **Integration tests:**
  - `admin-orders`
  - `admin-beats`:
    - the actions are admin-only
    - an oversized or wrong-type file is deleted and publishing stays blocked
    - keys from another beat are refused
    - upload links
  - `admin-panel`: tiers, coupons, dashboard numbers
  - coupon cases in `checkout.test.ts`
- **Fake sign-in:** `tests/integration/setup.ts` fakes `getCurrentUser`, so `requireUser` and `requireAdmin` behave like the real ones.
- **Results:** lint, typecheck, 169 unit tests and 79 integration tests pass.

**Other**
- **Dev server restart:** the old process still had the Prisma client from before the `coverKey` rename, so the catalog failed with "Unknown field `coverKey`". The leftover `next dev` process on port 3000 (started earlier in this session) was stopped first, then a new one started.
- **PLAN.md:**
  - §4: `coverKey`
  - §5.4: storage note
  - §5.5: check timing
  - §6: layout
  - all Phase 8 boxes ticked
- **CLAUDE.md:** `pnpm storage:setup` added to Commands.
- **`uploads.md`:** covers are public, the check runs at upload, and the Content-Type is signed.

### 2026-11-17: Phase 7 checked end to end, Phase 6 closed (committed and pushed)

The Phase 7 code was written on 2026-11-14, after the plan below, but PROGRESS.md wasn't updated then. This entry covers what it contains and what was checked today.

**What Phase 7 contains:**
- **`src/lib/auth.ts`:** Better Auth with the Prisma adapter and Google (always shows the account picker). `role` is an extra user field with `input: false`, so sign-in can never set it. Ids come from the schema (`generateId: false`).
- **`src/lib/auth-guards.ts`:** `getCurrentUser()`, `requireUser()` (signed out → `/sign-in`), `requireAdmin()` (non-admin → `/`). There's no `proxy.ts`: it could only see that a cookie exists, so it would never be the real check.
- **`src/lib/account.ts`:** one rule for which orders are the user's: their own, plus guest orders with the same email (any case) only if the email is verified. Used by `/account` and by the download route. Nothing is written: a guest order stays a guest order.
- **Pages:**
  - `/sign-in`: Google button only. A signed-in visitor goes to `/account`.
  - `/account`: `requireUser()` first, then PAID and REFUNDED orders, newest first, with downloads.
  - `/api/auth/[...all]`: Better Auth's endpoints.
- **Components:** `GoogleSignInButton`, `SignOutButton` (through `src/lib/auth-client.ts`), and `OrderItemList`, which is shared by the success page and `/account`.
- **Download route:** a valid token, or else the signed-in owner. The session is looked up only when there's no valid token.
- **Checkout:** a signed-in buyer's order gets their user id, read on the server. Their email pre-fills Stripe's email field.
- **Schema:** `Session`, `Account` and `Verification` tables for Better Auth (migration `20261114083214_phase7_auth`).
- **Seed:** lowercases `ADMIN_EMAIL` and marks the admin verified.
- **Tests:** `auth-guards.test.ts` (unit), `account.test.ts` (integration), new cases in `download.test.ts` and `checkout.test.ts`.

**Set up today (2026-11-17):**
- **Google Cloud:** project `beat-store-dev` on the admin's Google account. The OAuth consent screen is "Beat Store": External, Testing, with the admin as the only test user. The client "Beat Store local dev" is a Web application with redirect URI `http://localhost:3000/api/auth/callback/google`. The user turned on 2-Step Verification, which Google Cloud now requires, accepted the Cloud Terms and the API User Data Policy, and pasted the client id and secret into `.env`.
- **`.env`:**
  - `ADMIN_EMAIL` set to the user's Google address (it was a placeholder).
  - `STRIPE_WEBHOOK_SECRET` replaced with the Stripe CLI's current secret (`stripe listen --print-secret`). The old value didn't match, and both are for the same Stripe account.
- **Local database:** the seed was re-run. The old placeholder admin user was deleted; it had no orders, sessions or accounts.

**Checked:**
- Lint, typecheck and `pnpm audit --audit-level=high` pass. The audit's only finding is a moderate `minimatch` advisory, which comes in through the `shadcn` CLI.
- Unit tests: 143 pass. Integration tests: 48 pass.
- **In the browser:**
  - Signed out, `/account` goes to `/sign-in`.
  - Google sign-in: `POST /api/auth/sign-in/social` 200, then the callback 302. It linked to the seeded admin: one user, ADMIN, verified, a `google` account row.
  - `/account` shows the admin's email and "No orders yet". That's correct: the paid test order belongs to `buyer@example.com`.
  - Checkout while signed in made a PENDING order with the admin's user id.
  - Sign-out deleted the session row, and `/account` went back to `/sign-in`.
- **Not checked:** paying that order and downloading from `/account` (the user skipped the payment). See Open questions.

**PLAN.md:**
- Phase 6's admin box moved to Phase 8, next to the order detail page (option A).
- Phase 6's download-route line updated.
- All three Phase 7 boxes ticked.
- The Phase 5 accounts box now says Stripe and Google are done.

### 2026-11-14: Phase 7 plan

Docs checked 2026-11-14:
- **Version:** Better Auth 1.7.23 is the latest. It ships the Prisma adapter (`better-auth/adapters/prisma`), supports Prisma 7, and works with Next.js 16. Every 2026 advisory found was fixed by 1.7.7.
- **Admin sign-in would fail as seeded.** Better Auth links a Google sign-in to an existing user with the same email only if that user's own `emailVerified` is true (`accountLinking.requireLocalEmailVerified`, default `true`, checked in the 1.7.23 source). The seed creates the admin with `false`, so Google sign-in would end with "account not linked". The plan: the seed marks the admin as verified.
- **New Google users:** `emailVerified` is copied from Google's `email_verified` claim.
- **Cookie check:** `getSessionCookie()` only checks that a cookie exists, so it's never a security check.
- **Rate limiting:** the built-in limiter is on only in production, and stores its counts in memory.

### 2026-11-14: Local S3 storage and a real download (commit `defa98a`, pushed)

The user OK'd the plan below: SeaweedFS, Claude filling the local S3 values in `.env`, and ticking the seed box.

- **`docker-compose.yml`:** a new `storage` service.
  - `chrislusf/seaweedfs:4.53` runs `weed mini`, with S3 on port 8333 and an `s3data` volume.
  - `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` (`local-dev-key` / `local-dev-secret`, local placeholders) create its only user, so every request must be signed.
  - `S3_BUCKET` creates `beatstore-files` on the first start.
- **`src/lib/storage.ts`:**
  - `forcePathStyle: true`. Links are now `<endpoint>/<bucket>/<key>`. Before, the SDK put the bucket in the host name, which `localhost` can't serve. R2 accepts both forms.
  - `getS3()` is exported for the script.
- **`scripts/upload-demo-files.ts`** (`pnpm demo:upload`). For each beat with `audio-src/<slug>.wav`:
  - It uploads the WAV, plus a full-length 320 kbps MP3 made with ffmpeg (no tag), under `uploads/<beatId>/<uuid>.<ext>`.
  - It only fills empty keys, so a re-run uploads nothing.
  - The key is saved after the upload succeeds.
  - Stems are skipped.
- **Tests:** the unit test (`storage.test.ts`) and the integration test (`download.test.ts`) now expect the bucket in the path.
- **`.env.example`:** a comment with the local values. **`.env`:** Claude filled in the three empty values (`S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`). `S3_REGION` and `S3_PRIVATE_BUCKET` were already set.
- **Docs:**
  - `CLAUDE.md`: Stack, plus the Commands entry for `docker compose up -d` and a new `pnpm demo:upload` line.
  - PLAN.md: §5.1, §6, and the Phase 1 seed box ticked.
- **Checks run:**
  - **Storage:** an unsigned GET gives 403. The bucket was created on start.
  - **Upload script:** the first run uploaded 24 files in 17 s (WAV 8.0 MB, MP3 3.6 MB each). The second run uploaded 0.
  - **A link from `signDownloadUrl()`:** 200 with `Content-Disposition: attachment; filename="glass-heart.wav"`, and the bytes match the source WAV. With one changed signature character: 403. The same link used for a PUT: 403. A 1-second link used after 3 s: 403 AccessDenied.
  - **Browser, real Stripe test mode:** First Light Basic and Glass Heart Premium, $79.98, card `4242`. The webhook gave 200, and the success page showed 3 Download buttons at 5 of 5. Download WAV and Download MP3 for Glass Heart each gave a 302 to the storage server. Chrome saved `glass-heart.wav` (identical to the source) and `glass-heart.mp3` (320 kbps, 95 s, the full beat). After a reload both read 4 of 5.
  - **Static checks and tests:** lint, typecheck and Prettier pass. Unit: 136 pass. Integration: 39 pass.
- **Left behind by the test:** a PAID test order (buyer `buyer@example.com`) in the local database, and the two downloaded files in the user's Downloads folder.

### 2026-11-14: PROGRESS.md cleanup, and the plan for local storage

- **PROGRESS.md was out of date.** Fixed:
  - **Current status:** it said Phase 6 wasn't committed, but it's in `25785a7` and pushed.
  - **Open questions:** removed the `stripe listen --events` item. `CLAUDE.md` and the webhook route comment were fixed in `20de8cb`.
  - **Log:** the Phase 6 heading now names its commits, and `b8d360f` is marked as pushed.
  - **Up next:** it still listed the Phase 3 browser check and Phase 4. It now lists the storage test and Phase 7.
- **Researched for the storage plan** (docs checked 2026-11-14):
  - **MinIO:** it stopped publishing free Docker images in October 2025, and its repository was archived in February 2026. Ruled out.
  - **Adobe S3Mock 5.x:** one container, but its README says presigned URLs are "accepted but not validated (expiration, signature, HTTP verb not checked)". A test against it wouldn't show that our signed links work. Ruled out.
  - **SeaweedFS `weed mini` (chosen):** one container (`chrislusf/seaweedfs`, S3 on port 8333). The `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` env vars create a user, and `S3_BUCKET` creates the bucket on first start. Once credentials exist, every request must be signed. The latest release is 4.53 (2026-11-08).
  - **Path-style links:** S3 servers on `localhost` need the bucket in the path (`localhost:8333/beatstore-files/…`), not in the host name. R2 accepts both styles.
- **Status:** committed as `1956f62`. The plan was OK'd and built the same day (entry above).

### 2026-11-13: Phase 6: delivery (commits `20de8cb` and `25785a7`, pushed)

The plan was OK'd by the user:
- **Token:** option A.
- **Dependencies:** the two AWS SDK packages.
- **Admin box:** stays in Phase 6.

The user said they won't do manual testing, so Claude ran every check, including the browser ones.

- **Dependencies:** `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` 3.1167.0. The peer warnings pnpm prints are the old eslint ones.
- **`src/lib/tokens.ts`:**
  - `createDownloadToken()`: 32 random bytes as base64url, their SHA-256 hash, and an expiry 30 days out.
  - `tokenMatches()`: compares hashes with `timingSafeEqual` and refuses an expired token or an order without one.
- **`src/lib/storage.ts`:** a lazy S3 client (like `getStripe()`) and `signDownloadUrl(key, filename)`.
  - A 10-minute GET link with `attachment; filename=…`.
  - No checksum options, matching Cloudflare's current R2 example.
  - The SDK puts the bucket in the host name (`beatstore-files.<account>.r2…`).
- **`src/lib/validators.ts`:** `downloadTokenSchema` (43 base64url characters) and `downloadParamsSchema` (UUID, `MP3|WAV|STEMS`).
- **`src/actions/checkout.ts`:** makes the token before the order transaction, saves its hash and expiry on the order, and puts `&token=<raw>` in `success_url`.
- **`src/app/api/download/[orderItemId]/[fileType]/route.ts`:**
  1. **Params:** bad ones give 404.
  2. **Token:** must match the item's order and not be expired, otherwise 403. An unknown item gets the same 403.
  3. **Order:** must be PAID and not a refunded lost exclusive, otherwise 403.
  4. **File:** must be in the license and uploaded, otherwise 404, and no download is used up.
  5. **Signing:** the link is signed before counting.
  6. **Count:** one `$executeRaw` UPDATE `… WHERE count < "maxCount"`. If 0 rows change, 429.
  7. **Redirect:** 302 to the signed link with `Cache-Control: no-store`.
  - **Why `$executeRaw`:** the plan's exact SQL, as in `reservation.ts`, rather than Prisma `updateMany`, which might run a SELECT and then an UPDATE.
  - **Why sign first:** the browser test showed that a signing failure after counting cost the buyer a download.
- **`src/lib/downloads.ts`** (admin box):
  - `resetDownloadCount(downloadId)` and `reissueDownloadToken(orderId)`. The second returns the new success-page link and turns the old one off.
  - Plain server functions, not server actions: an action is a public endpoint, and `requireAdmin()` doesn't exist until Phase 7.
- **Success page:**
  - Reads `token`, and shows the buttons only if `tokenMatches()` for this order.
  - Each file gets a "Download" `<a>` and "N of 5 downloads left". A plain `<a>`, not `<Link>`, because a prefetch would count as a download.
  - A bookmark note with the expiry date.
  - Without a valid token: "This download link is incomplete or has expired. Please contact support."
- **`confirmCheckout`** also returns the token hash, its expiry and each download's count.
- **Tests:**
  - **Unit:** 136 tests (+25): `tokens.test.ts` (8), `storage.test.ts` (3), validators (+14).
  - **Integration:** 39 tests (+19). `download.test.ts` has 18:
    - 302 to a 10-minute link, with the count +1 and `lastAt` set.
    - A missing, malformed or wrong token, someone else's order's token, an expired token and an unknown item all give 403.
    - REFUNDED, PENDING, EXPIRED and a lost exclusive give 403.
    - A file not in the license gives 404, and a file not uploaded gives 404 with the count unchanged.
    - A signing failure throws, with the count unchanged.
    - Bad params give 404.
    - The 6th download gives 429, while other files keep their own limit.
    - 5 simultaneous requests at count 4 give exactly one 302.
    - Reset and reissue work.
  - **`checkout.test.ts`:** +1 test (the stored hash matches the token in `success_url`, expiry 30 days).
  - **Fixed a timing-dependent Phase 5 test.** In "1 of 20 concurrent checkouts", a loser that reads the cart after the winner commits is refused with "can't be bought right now" instead of "just taken". It failed once in a full run, so it now accepts either refusal. The invariants (1 reservation, 1 order, 1 Stripe call) are unchanged. It passed 3 full runs in a row.
  - **Static checks:** typecheck, lint and Prettier pass.
- **Browser test, real Stripe test mode, Chrome:**
  - **Step 3** (Glass Heart Premium, card `4000 0000 0000 9995`): "insufficient funds". The order stayed PENDING with 0 downloads and no completed event, and already had its token hash and a 13 Dec expiry.
  - **Step 4** (same session, card `4000 0025 0000 3155`): the 3-D Secure popup, then Complete.
    - **Webhook:** 200.
    - **Order:** PAID, 4,999 cents.
    - **Success page:** "Download MP3" and "Download WAV", 5 of 5 left each, and the bookmark note dated December 13, 2026.
  - **Download MP3 click:** 404 "This file isn't available yet" (demo beats have no full files). The count stayed 0.
  - **Without a token or with a wrong one:** the success page shows no buttons and the "incomplete or has expired" note. The route gives 403.
  - **Step 6** (First Light Basic): Stripe's back arrow leads to `/checkout/cancel`, "Nothing was charged. Your cart is still saved.", with the cart badge at 1.
  - **The earlier paid order emptied the cart** (`ClearCart`).
- **Also changed:** `CLAUDE.md` Commands and the webhook route's comment now use `stripe listen --events …`.
- **PLAN.md:**
  - §8 Phase 6 boxes 1–4 ticked, with notes. The admin box is unticked, with a note.
  - §6 lists `downloads.ts` and the new tests, and `signUrl()` is renamed to `signDownloadUrl()`.
  - Phase 5's local-testing box is ticked. The stray `1.` someone typed at the start of that line was removed after the user confirmed it was an accident.

### 2026-11-13: Phase 5 local testing against real Stripe (test mode)

No app code changed in this task.

- **Commit `b8d360f`** (reviewed by the user, pushed together with Phase 6):
  - The beat page's cover square gets `self-start`, so it no longer squeezes the license column.
  - The PLAN.md "Install the Stripe CLI" box is ticked.
- **Setup:**
  - Stripe CLI 1.55.11 is logged in. `.env` has the test keys.
  - `STRIPE_WEBHOOK_SECRET` matches `stripe listen --print-secret`.
  - Docker Desktop was started, and the migrations are up to date.
- **The working listener command:** `stripe listen --events checkout.session.completed,checkout.session.expired,charge.refunded --forward-to localhost:3000/api/webhooks/stripe`. The old command without `--events` exits with an error (see Open questions).
- **Leftover from the user's 2026-11-12 run:**
  - Order `0086ca4d…` ($499 Exclusive for Dusty Crates) was still PENDING, and the beat was still RESERVED, though the hold had run out the day before.
  - `stripe events resend` for its `checkout.session.expired` event gave a webhook 200. The order became EXPIRED and the beat PUBLISHED.
- **Step 2** (card `4242…`, Exclusive for Paper Lanterns + Basic for Glass Heart). Order `cdf3d531…`:
  - **Order:** PAID. 52,899 cents, which equals the sum of the items. No `reviewNote`.
  - **Webhook:** arrived about 1 s after payment and answered 200 in 149 ms. One `WebhookEvent` row.
  - **Paper Lanterns:** SOLD and held by this order. It's gone from `/beats`, and its page shows a "Sold" badge with no preview and no Add to cart.
  - **Glass Heart:** stays PUBLISHED.
  - **Downloads:** Exclusive MP3, WAV and STEMS, each 0/5. Basic MP3 0/5.
- **Step 5:** resending the same completed event gave 200 and changed nothing (4 downloads, 3 webhook events, still PAID).
- **Step 7:** already passed on 2026-11-12. Order `cda9a7ba…` is REFUNDED through `charge.refunded`.
- **Not run yet:** step 3 (declined card), step 4 (3-D Secure) and step 6 (back button to `/checkout/cancel`).
- **Dev server log:** no errors. The first webhook took 6 s because `pnpm dev` compiles a route on its first request.
- **PLAN.md §8:**
  - The accounts box notes that Stripe is done.
  - The local-testing box shows the `--events` command. It stays unticked until steps 3, 4 and 6 pass.

### 2026-11-11: Phase 5: Stripe checkout (commit `aa610f2`)

The user asked for every Phase 5 task at once, explained afterwards, so this skipped the plan-first step.

- **Dependency:** `stripe` 23.1.0 (in the CLAUDE.md stack). It pins API version `2026-10-28.endive`.
  - **Removed option:** this version dropped `payment_method_types` from Checkout Sessions, so the code uses its replacement, `allowed_payment_method_types: ["card"]`.
  - **Lazy client:** `new Stripe()` throws without a key, and `next build` loads route modules where CI has no key. So the client is made on first use.
- **Schema:** `Order.reviewNote`, `OrderItem.refundNeeded`, `OrderItem.refundedAt` (see Open questions). PLAN.md §4 lists them.
- `src/lib/stripe.ts`: `getStripe()`. It refuses any key that doesn't start with `sk_test_`, so a live key can't take real payments.
- `src/lib/reservation.ts`:
  - `reserveExclusive(tx, beatId, orderId)`: the plan's one conditional UPDATE, with a 35-minute hold, through tagged `$executeRaw`. It returns true only if exactly 1 row changed.
  - `releaseReservations(client, orderId)`: frees only RESERVED beats this order holds, so a SOLD beat stays sold.
  - `releaseExpiredReservations()`: the cron's query.
  - All times use the database's `now()`.
- `src/actions/checkout.ts`: `createCheckoutSession(items: unknown)`.
  1. **Input:** Zod checks the cart.
  2. **Prices:** `getCartLines` re-reads every price, and any line with a problem stops checkout.
  3. **Order:** one transaction creates the PENDING order with title/tier/price snapshots and reserves each exclusive. A lost reservation throws, which rolls the order back: "This exclusive was just taken…".
  4. **Stripe session:** price_data lines, `metadata.orderId`, `expires_at` = now + 31 min, success/cancel URLs. Idempotency key `checkout-<orderId>`.
  5. **Stripe fails:** the exclusives are freed and the order becomes FAILED.
  - **No auth guard on purpose:** guests can buy. `userId` is set in Phase 7.
  - **Supporting change:** `CartLine` gained `tierCode`, so checkout can find the exclusives.
- `src/lib/fulfilment.ts`:
  - **`sessionProblem(session, order)`:** pure. It checks the session id, `payment_status === "paid"`, the amount and the currency.
  - **`fulfilOrder(session, eventId?)`:**
    - **Mismatch:** a problem is logged, saved in `reviewNote`, and the order isn't fulfilled.
    - **The transaction (database only):** insert `WebhookEvent`, `updateMany` the order PENDING → PAID (with the email and the PaymentIntent id), SOLD each exclusive `WHERE reservedByOrderId = order.id`, and create `Download` rows from the tier's file flags.
    - **Idempotency:** a duplicate event fails on the primary key (P2002), which means "already done". A second run without an event id (the success page) finds 0 PENDING rows and stops.
    - **A lost exclusive** gets `refundNeeded` and no downloads.
  - **`refundLostExclusives(orderId?)`:** runs after commit, and the cron calls it with no id. `refunds.create` uses idempotency key `refund-<orderItemId>` and sets `refundedAt` on success. A failure is logged, never thrown.
  - **`expireOrder` / `markOrderRefunded`:** handle the expired and refunded events. REFUNDED needs a full refund (`charge.refunded === true`), so a partial lost-exclusive refund leaves the rest of the order downloadable.
  - **`confirmCheckout(sessionId)`:** for the success page. If the order is still PENDING, it fetches the session from Stripe and runs `fulfilOrder()`.
- `src/app/api/webhooks/stripe/route.ts`:
  - **Signature:** reads `await request.text()` and checks it with `constructEvent`. A bad or missing signature gives 400.
  - **Events handled:** `checkout.session.completed`, `checkout.session.expired`, `charge.refunded`.
  - **Missing secret:** 500, so Stripe retries once it's set.
- `src/app/api/cron/release-reservations` and `fulfilment-retry`:
  - **Auth:** `Authorization: Bearer <CRON_SECRET>`, Vercel's pattern. An unset secret refuses everything, so `Bearer ` can't pass.
  - **Response:** each returns a count.
- **Pages:**
  - **`/checkout/success`:** `session_id` is checked with Zod and used only as a lookup key. It shows Not found, Confirming (or a review problem), Not completed (EXPIRED/FAILED), or the paid items with their files, refunded lost exclusives and the total.
  - **The cart** is cleared by `ClearCart` on PAID. Download buttons come in Phase 6.
  - **`/checkout/cancel`:** static. Nothing was charged and the cart is kept.
  - **`CheckoutButton`:** in `CartContents` (drawer and `/cart`). It's off while a line has a problem or the shown lines are stale, and it shows the server's error message.
- **Tests:**
  - **The split:** `pnpm test` is now the unit project only. `pnpm test:integration` runs against the local Docker DB, which must be migrated and seeded. Configured with Vitest `projects` in `vitest.config.mts`.
  - **Unit:** `fulfilment.test.ts` (sessionProblem, 9), `stripe.test.ts` (key check, 4) and `checkoutSessionIdSchema` (7). 111 unit tests in total.
  - **Integration, 20 tests in 3 files.** Each makes its own beat and deletes it afterwards. Stripe network calls are faked, and the signatures are real (`generateTestHeaderString`).
    - **checkout:** 20 concurrent checkouts give exactly 1 reservation, 1 order and 1 Stripe call; a browser price is ignored; a Stripe failure gives FAILED and frees the beat; a SOLD line or an empty cart is refused.
    - **webhook:** a tampered body or no signature gives 400; a wrong amount, an unpaid session or another currency isn't fulfilled; the same event twice, and 6 deliveries plus 2 success-page runs at once, fulfil exactly once; an exclusive becomes SOLD with 3 files; a lost exclusive is refunded with the right idempotency key, or kept for the cron when Stripe fails; expiry frees the beat; only a full refund gives REFUNDED.
    - **cron:** a missing, wrong or empty secret gives 401; only holds that have run out are freed.
  - **What the first run caught:** a test that assumed a second buyer could take an expired hold before it was freed. See Open questions.
- **Checks:**
  - **Static checks:** Prettier, lint, typecheck, 111 unit tests, 20 integration tests and the build pass.
  - **Against `pnpm start` on port 3001:**
    - The webhook gave 400 with no signature or a fake one.
    - Both cron routes gave 401 with no auth, a wrong secret or `x-middleware-subrequest`.
    - `/checkout/success` with an unknown or bad id said "Order not found".
    - `/checkout/cancel` gave 200.
  - **Browser chunks:** none contain a secret's name or the reservation code. The server was stopped by PID afterwards.
- **Not tested yet:** a real payment through Stripe, and the UI in a browser. Checklist, once `.env` has a Stripe test key:
  1. `stripe login`, then `stripe listen --forward-to localhost:3000/api/webhooks/stripe`. Put the printed `whsec_…` in `STRIPE_WEBHOOK_SECRET` and restart `pnpm dev`.
  2. Cart with Basic + Exclusive → Checkout → `4242 4242 4242 4242`. The success page shows PAID and the files, the cart empties, and the beat leaves the catalog (SOLD).
  3. `4000 0000 0000 9995`: Stripe shows a decline, and the order stays PENDING (EXPIRED after 31 min).
  4. `4000 0025 0000 3155`: 3-D Secure, then paid.
  5. `stripe events resend <evt_id>` for a completed event: no second fulfilment (same Download rows).
  6. The back button on Stripe's page leads to `/checkout/cancel`, and the cart is kept.
  7. A full refund in the Stripe dashboard makes the order REFUNDED.
- PLAN.md: §4 fields, §5.2/§5.4 timings, §6 new files, and §8 Phase 5 boxes 2–8 ticked.
- Committed as `aa610f2` and pushed to `origin/develop` when the user asked, after reading the summary. The pre-commit hook (lint-staged) passed. `.env` wasn't staged: files were added by name.

### 2026-11-10: Phase 4 task 3: cart UI (commit `b539e87`)

It follows the approved Phase 4 plan for task 3.

- `src/components/ui/sheet.tsx`: shadcn's `Sheet`, built on Base UI's `Dialog` (already installed).
  - **Written by hand:** copied exactly from `pnpm shadcn add sheet --dry-run --view` and formatted with Prettier. Running the CLI would also have overwritten `button.tsx` (formatting-only changes, per `--diff`) and re-added the `cn` package, which is already installed. Like the other shadcn components here, it imports `cn` from the `cn` package.
  - No new package.
- `src/store/cart.ts`: a `hydrated` flag and a `setHydrated` action, set by `onRehydrateStorage` (the pattern from zustand's docs).
  - **Why:** without it, `/cart` would show "Your cart is empty" until the saved cart was read.
  - **Bad JSON:** the callback runs even when the saved cart is bad JSON, so the cart never stays on "Loading" forever.
  - **Not saved:** `partialize` still saves only `items`.
  - **Comment added:** on the server there's no `window`, so `useCartStore.persist` doesn't exist there. It's used only in effects and event handlers.
- `src/components/cart/CartButton.tsx`: the header cart icon. It shows the count (hidden at 0, and the `aria-label` says "Cart, 2 in cart") and opens the drawer. Its effect calls `useCartStore.persist.rehydrate()` once per full page load. It replaces the `/cart` link in `SiteHeader`.
- `src/components/cart/CartDrawer.tsx`: a `Sheet` from the right, controlled by `isOpen` in the store. It holds `CartContents` and a "View cart" link. The close button, Escape and a click outside close it (Base UI).
- `src/components/cart/CartContents.tsx`: used in the drawer and on `/cart`.
  - **Data:** calls `getCart(items)` whenever the items change. An answer for an old cart is dropped (`current` flag), and a rejected call shows like a bad cart.
  - **States:**
    - "Loading your cart…" until the store has read the saved cart, and again until the first answer arrives.
    - An empty cart shows "Browse beats".
    - A failed call shows "Couldn't load your cart".
    - Otherwise each line shows a title link, tier, price or reason in red, and a Remove button with an `aria-label`, followed by the total.
  - **After a change:** the old answer stays on screen dimmed (`aria-busy`) until the new one arrives, instead of flashing "Loading".
  - **Links** close the drawer when clicked.
- `src/app/(store)/cart/page.tsx`: the title "Cart" and `CartContents`. It's static (`○` in the build), because the cart lives in the browser. No Checkout button until Phase 5.
- `LicenseSelector`:
  - **New prop:** `beatId`, passed from the beat page.
  - **The button** says "Add to cart", "In cart" (same tier) or "Change license in cart" (another tier of this beat). Clicking it adds or swaps the tier and opens the drawer. It's disabled when no tier can be picked.
  - **Full cart:** `role="alert"` says the cart holds up to 20 beats.
- Tests: the store tests check `hydrated` after a normal load and after bad JSON. 60 tests in total. The components have no unit tests: there's no DOM test setup (jsdom or happy-dom would be a new dependency), and E2E is the Playwright later slice.
- Checks:
  - Prettier, lint, typecheck, 60 tests and build pass. `/cart` builds as static.
  - Against `pnpm start` on port 3001:
    - `/cart` returned 200 with the title "Cart · Beat Store", "Loading your cart…" (the server can't see the saved cart) and the header Cart button.
    - The `cold-concrete` beat page had "Add to cart".
  - `getCart` over HTTP, as the browser calls it (POST with its `Next-Action` id from the build manifest):
    - A real cart with `priceCents: 1` sent along came back with the database price, 2999.
    - A bad cart gave `null`.
    - An `Origin` from another site was refused (HTTP 500 with an error digest, as with `recordPlay`).
  - No server code (`getCartLines`, `cartLineProblem`, `findMany`, `DATABASE_URL`) is in any browser chunk, only the action's id.
  - After the server was stopped, a `node` process was still listening on port 3001, as in an earlier session. It was stopped by PID.
- **Zod in the browser, then replaced (user decision).** With Zod, the store's chunk was 31.8 KB gzipped (110 KB raw) and loaded on every store page, because the store checked the saved cart with `cartItemsSchema`. The user chose a hand-written check in the browser, keeping Zod on the server only:
  - **`src/lib/cart.ts` (new):** `MAX_CART_ITEMS`, the `CartItem` type and `parseSavedCart(value)`. Both moved out of `validators.ts`, because any value import from `validators.ts` in browser code pulls in Zod.
  - **The check:** `parseSavedCart` returns the items with only their two ids, or `null` for a broken cart (not a list, more than 20 items, a non-object entry, a bad id, the same beat twice).
  - **Its UUID pattern** is Zod's `z.uuid()` pattern, without Zod's all-zeros and all-`f`s special cases. So anything the browser accepts, the server's `cartItemsSchema` accepts too. Otherwise a hand-edited cart could pass in the browser, fail on the server, and leave the cart page stuck on "Couldn't load your cart".
  - **Updated:** `validators.ts` imports the limit from `cart.ts` for `cartItemsSchema`. The store's `merge`, `catalog.ts`, `LicenseSelector` and `CartContents` import from `cart.ts`.
  - **Tests:** `tests/unit/cart.test.ts` (31) covers 4 good carts, 11 broken ones, a price being dropped, and for all 15 carts, that the server accepts whatever the browser accepts. The existing store tests for broken saved carts still pass. 91 tests in total.
  - **After:** lint, typecheck and build pass. No browser chunk contains `ZodError`. The store's chunk is now 7.6 KB (3.3 KB gzipped), and all browser JavaScript went from 875 KB to 768 KB raw. Not re-run over HTTP: the server action didn't change.
- **Not tested in a real browser yet.** Claude in Chrome wasn't connected ("Browser extension is not connected"). Checklist:
  - **Phase 4 cart:**
    - "Add to cart" opens the drawer with the line and its total.
    - The header count goes up.
    - Picking another tier of the same beat changes the button to "Change license in cart", and clicking it swaps the line.
    - Remove works, and the line dims briefly.
    - A reload keeps the cart, and `/cart` shows "Loading" briefly, not "empty".
    - "View cart" and the title links close the drawer.
    - Escape and a click outside close it.
    - No hydration warning in the console.
  - **Phase 3 player:**
    - Play from a card and from the beat page.
    - The bar keeps playing across pages.
    - The waveform follows the bar and seeks on click.
    - A play is counted after 10 s, once per track.
- PLAN.md: §6 lists `CartButton.tsx`, `CartDrawer.tsx`, `CartContents.tsx` and `lib/cart.ts`. The second §8 Phase 4 box is ticked, so both Phase 4 boxes are done.

### 2026-11-10: Phase 4 task 2: server lookup and cart total (commit `cd87683`)

It follows the approved Phase 4 plan for task 2.

- `src/lib/pricing.ts`: `cartTotalCents(prices)` adds up whole cents. It throws on anything that isn't a whole, non-negative, safe integer (`29.99`, `-1`, `NaN`, `Infinity`), so a bug can't show or charge a wrong total. The header comment no longer promises a bundle or a coupon here. The coupon comes in Phase 8.
- `src/lib/catalog.ts`: `getCartLines(items)` and the `CartLine` type.
  - **The query:** one `findMany` on `BeatLicense` matches each (beatId, licenseTierId) pair. It selects only price, `active`, the beat's slug, title and status, and the tier's name and code, never the file keys.
  - **The result:** one line per cart item, in cart order. Each line has `priceCents` and `problem`. A line that can be bought has a price and `problem: null`. A line that can't has `priceCents: null` and a reason the cart can show.
  - **The reasons:** "Sold" (SOLD beat), "No longer available" (DRAFT beat, license switched off, or a beat/tier pair that doesn't exist, which gives no title either), and "Reserved, check back soon" (the exclusive of a RESERVED beat; its leases are still buyable, per `.claude/rules/exclusives.md`).
  - **Differs from the plan's wording:** the plan said it would reuse `catalogWhere`. Instead, `cartLineProblem()` checks the same rule (PUBLISHED or RESERVED, and this license active) one line at a time, so the cart can say why a line can't be bought. A comment points to `catalogWhere`. The statuses are typed with Prisma's `BeatStatus` / `LicenseCode`, so a misspelt status fails typecheck.
- `src/actions/cart.ts`: the `getCart(items: unknown)` server action.
  - **Input:** `cartItemsSchema` checks the cart, and a bad one returns `null` without querying.
  - **Output:** `{ lines, totalCents }`, where the total counts only lines that can be bought.
  - **No auth guard on purpose:** guests fill a cart, and the comment says so, as in `recordPlay`. It only reads. Checkout (Phase 5) reads the prices again.
- Tests: `tests/unit/pricing.test.ts` has 6 new cases (empty cart, sums, 4 bad prices), 59 tests in total. `getCartLines` and `getCart` are database code with no pure logic worth splitting out, so they were checked against the real database instead (below).
- Checks:
  - Prettier, lint, typecheck, 59 tests and build pass.
  - Docker Desktop wasn't running. It was started from `%LOCALAPPDATA%\Programs\DockerDesktop` (not `Program Files`), then `docker compose up -d`.
  - A throwaway script in the scratchpad called `getCart` against local Docker, with every row restored afterwards. Before and after: 12 PUBLISHED, 48 active licenses, 0 prices off their default. Results:
    - 4 available lines gave the database prices and their sum.
    - Each line has exactly the 7 `CartLine` fields, so no storage key.
    - A reversed cart came back reversed.
    - A SOLD beat, a raised price, the exclusive of a RESERVED beat and a switched-off license gave "Sold", the new price, "Reserved, check back soon" and "No longer available". Only the new price counted in the total.
    - A lease on the RESERVED beat stayed buyable.
    - A DRAFT beat and unknown ids gave "No longer available".
    - 7 bad inputs (a string, `null`, `undefined`, one item, 21 items, the same beat twice, SQL in an id) gave `null`.
    - A `priceCents` sent along was ignored.
    - An empty cart gave no lines and a total of 0.
  - The script's first version wrongly failed its "no file keys" check: the pattern matched the word "Stems" in the tier name "Trackout / Stems". It now checks the field names instead.
- PLAN.md §6: `cart.ts` in the `actions/` line, and "cart lines" on `catalog.ts`. No §8 box: the second Phase 4 box is ticked after task 3.
- Not tested yet: calling the action over HTTP from a browser. No client code imports it until task 3.

### 2026-11-10: Phase 4 plan, and task 1: cart store (commit `48b6576`)

Phase 4 plan (user approved): 3 tasks, each reviewed and committed on its own. (1) cart store, (2) server lookup and cart total, (3) cart UI: "Add to cart", header cart button, drawer and `/cart` page. User decisions:

- **The cart stays in localStorage, as ids only.** The user asked why it isn't saved on the server, so the buyer can't change prices. Answer: the cart holds only beat and tier ids, never a price. The server reads every price from the database, and at checkout (Phase 5) it saves the order with its own prices before Stripe sees anything. Editing the saved cart can only change what's in it, as clicking would. A database cart would need new tables, a cookie for guests and cleanup of abandoned carts, and it wouldn't add protection. The user then approved the localStorage plan.
- **No bundle deal.** It moved to PLAN.md "Later ideas".
- **No coupon yet.** The coupon maths moved to Phase 8, next to Coupons CRUD, with a code field at checkout.
- **The header cart icon opens the drawer.**
- **Guest email:** unchanged default (from Stripe Checkout), so the cart has no email field.

Task 1:

- `src/lib/validators.ts`:
  - `cartItemsSchema` is a list of `{ beatId, licenseTierId }`, both UUIDs, with at most `MAX_CART_ITEMS` (20) items and no beat twice. `z.object` drops any other field, so a price added by hand never gets through.
  - The `CartItem` type is inferred from the schema.
  - Phase 5's checkout will use the same schema.
- `src/store/cart.ts`: Zustand with `persist`, saved under the localStorage key `beat-store-cart`.
  - **State:** `items`, plus `isOpen` for the drawer.
  - **`add`:** if the beat is already in the cart, it swaps the tier in place (one tier per beat). Otherwise it appends the item, or returns `false` when the cart is full. `remove(beatId)`, `clear()` and `setOpen()` do what their names say.
  - **`partialize`:** only `items` are saved, so the drawer starts closed on every page load.
  - **`merge`:** the saved cart comes back from the browser, so it goes through `cartItemsSchema`. A broken or edited cart (bad JSON, not a list, a bad id, a beat twice) starts empty instead of breaking the page.
  - **`skipHydration: true`:** the server can't read localStorage, so the store starts empty and the browser's first render matches the server's HTML. The cart UI (task 3) calls `useCartStore.persist.rehydrate()` after mounting. Checked in zustand 5.0.16's source: `persist` saves on every change, even before rehydrating, so the rehydrate must run on mount, before the user can click anything. Otherwise a click could overwrite the saved cart.
- `vitest.config.mts` (new, **not in the plan**): `resolve: { tsconfigPaths: true }`, an option built into Vite 8.3.6, so no new package.
  - **Why:** the store imports `@/lib/validators`, and Vitest couldn't resolve the `@/` alias ("Cannot find package"). Earlier tests only imported files without `@/` imports.
  - **Why `.mts`:** a `.ts` file made Vite warn that `import` syntax was loaded as CommonJS (`package.json` has no `"type": "module"`).
  - Added to the PLAN.md §6 tree.
- Tests: 20 new, 53 in total.
  - `tests/unit/cart-store.test.ts` (12): add, swap tier, full cart (refuses a new beat but still swaps a tier), remove and clear, only `items` saved, load a saved cart, a price added by hand is dropped, and 5 broken saved carts start empty.
    - Node has no `localStorage` (`window` doesn't exist), and `persist` looks it up when the store is created. Without one, it doesn't save and logs a warning on every change. So `vi.hoisted` puts an in-memory stand-in on `window` before the store is imported.
  - `tests/unit/validators.test.ts` (8): an empty and a 2-beat cart pass, a price is dropped, 20 items pass and 21 fail, and 5 bad inputs fail.
- PLAN.md:
  - §3 cart line: the bundle is gone, and the ids-only rule is written down.
  - §6: the `pricing.ts` comment is updated, and `vitest.config.mts` is added.
  - §8: the Phase 4 store box is ticked, the second box now says "(totals)", and the coupon maths is added to Phase 8's Coupons item. The bundle deal is in "Later ideas".
- Checks: Prettier, lint, typecheck and 53 tests pass. No build: no page imports the store yet.
- **For task 3:** once the UI imports the store, Zod reaches the browser bundle for store pages. It's already a dependency, but it's the first time Zod is sent to the browser.

### 2026-11-09: Phase 3 committed and pushed

- Task 4 committed as `52578f3`. Phase 3's 4 commits (`84b2647`, `d6ab260`, `3460384`, `52578f3`) and this progress update are pushed to `origin/develop`. "Up next" now lists the Phase 3 browser check and the Phase 4 roadmap items.

### 2026-11-09: Phase 3 task 4: count plays after 10 s

Built straight away at the user's request ("do it"). It follows the Phase 3 plan for task 4.

- `src/actions/plays.ts`: the `recordPlay(beatId: unknown)` server action.
  - **No auth guard on purpose:** visitors listen without signing in. The comment says so, because CLAUDE.md asks for guards on protected actions.
  - **Input:** `beatIdSchema` checks the id first, and anything else returns without touching the database.
  - **The update:** one `updateMany` with `plays: { increment: 1 }` (a single `plays = plays + 1` in SQL), only for PUBLISHED or RESERVED beats. Two plays at the same moment can't overwrite each other, and an unknown id doesn't throw.
- `src/lib/validators.ts`: `beatIdSchema = z.uuid()`. Tests: a UUID passes. An empty string, a slug, a UUID one character short, a UUID with SQL appended, a number and `null` fail.
- `src/store/player.ts`: `listenedSeconds` and `timeUpdate(time)`, which replaces the plain `currentTime` write in `PlayerBar`.
  - **Counting:** only forward steps under 1 s are added (the element reports every ~0.25 s while playing), so seeking forward or back doesn't count as listening.
  - **Once per track:** it returns `true` once per loaded track, at the moment the total passes `COUNT_PLAY_AFTER_SECONDS` (10). `load` resets the count, so next/prev and a new `playQueue` start again from 0. Replaying the same loaded track after it ends isn't counted twice.
- `PlayerBar`: `onTimeUpdate` calls `timeUpdate` and, when it returns `true`, `recordPlay(track.id)`. A failed call is caught and dropped, so it never interrupts the music.
- Tests: 4 store tests (counts once after 10 s; a seek isn't listening; the count restarts for the next track; counts from a part-way start) and 7 validator cases. 33 tests in total.
- PLAN.md: `plays.ts` in the §6 `actions/` line, §8 plays box ticked. That completes Phase 3's roadmap boxes.
- Checks:
  - Prettier, lint, typecheck, 33 tests and build pass.
  - Calling `recordPlay` directly against the local database (throwaway script in the scratchpad, every row restored): PUBLISHED +1, RESERVED +1, SOLD +0, DRAFT +0. 20 calls at once added exactly 20. 6 bad or unknown ids changed nothing and threw nothing.
  - Over HTTP against `pnpm start` (POST with the action's `Next-Action` id, as the browser sends it): a real id from the same origin gave +1. A junk id gave no change. An `Origin` from another site was refused by Next (HTTP 500), with no change. The action's code isn't in any browser chunk, only its id. `plays` restored.
- **Known limit, as planned:** anyone on the same site (or a script that sets the headers) can call the action repeatedly to push a beat up the "Popular" sort. The rate-limiting later slice (Upstash) covers that.
- **Not tested yet:** in a real browser, check that a play is recorded after 10 s of listening, and only once per track.

### 2026-11-09: Phase 3 task 3: `Waveform` on the beat page

Built without a separate plan, at the user's request. It follows the Phase 3 plan for task 3.

- Added `wavesurfer.js` **8.0.3**, pinned exactly. 8.0.4 and 8.0.5 were under 2 weeks old (same rule as zustand), and a `~8.0.3` range would have installed 8.0.5 anyway. Checked in the 8.0.3 package source:
  - Importing it doesn't touch `window` or `document`, so server rendering is fine.
  - A click seeks wavesurfer's own idle media element and emits `interaction`, but never starts playback.
  - A failed load is caught inside the library and emitted as an `error` event, so there's no unhandled promise.
- `src/components/player/Waveform.tsx` (client):
  - **Setup:** wavesurfer is created in `useEffect` with the preview's `url` and destroyed on unmount. Bars are 2 px, the cursor is hidden, and it's 64 px tall.
  - **Colours:** the canvas can't read CSS variables, so the colours are read once with `getComputedStyle`. Unplayed is `--ring` (mid grey) and played is `--primary` (near white). `--muted-foreground` was too close to white to tell them apart.
  - **Never plays:** wavesurfer gets its own idle media element. Giving it the global `<audio>` would change that element's `src` to this beat and cut off whatever is playing.
  - **Follows the player:** a `usePlayerStore.subscribe` listener (no React re-render) plus the `ready` event call `setTime`. It shows the player's time when this beat is the current track and 0 otherwise, and is skipped until the waveform is drawn.
  - **Clicks:** `interaction` seeks the global player if this beat is loaded. Otherwise it calls `playQueue([track], 0, clickedTime)`.
  - **Accessibility:** the drawing is `aria-hidden`. Keyboard users have the play button next to it and the bar's seek slider.
- `src/store/player.ts`: `playQueue(queue, index, startAt = 0)`. `load` sets the store's `currentTime` to `startAt`, then sets `audio.currentTime` right after `src`. While the file hasn't loaded, the HTML spec treats that as the start position, and reading `currentTime` returns it. So the store and the element agree from the start, and the waveform doesn't jump back to 0. next/prev still start at 0. New store test: start part-way through.
- Beat page `src/app/(store)/beats/[slug]/page.tsx`: a large `PlayButton` and the `Waveform` above the description. The queue is just this beat, so Next is off in the bar. They're not shown on a SOLD beat (its preview belongs to the buyer now) or on a beat without a preview. `beatDetailSelect` now loads `previewKey`; the full-file keys are still never loaded.
- PLAN.md §8: Waveform box ticked (§6 already listed `Waveform.tsx`).
- Checks:
  - Prettier, lint, typecheck, 22 tests and build pass.
  - Against `pnpm start` on port 3001: the PUBLISHED and RESERVED beat pages (status changed for the test) returned 200 with "Play …", the waveform container and their own preview URL. The SOLD beat page had no button, no waveform and no preview URL. No full-file keys appeared. Restored to 12 PUBLISHED.
  - The wavesurfer chunk is referenced only by the beat page, not by `/` or `/beats`.
- **Not tested yet:** in a real browser, check that the waveform draws, follows the bar while playing, resets when another beat plays, and that a click seeks the current beat or starts a different one at the clicked spot.
- Note: clicking the waveform of a beat that's loaded but paused only seeks. It doesn't resume. Clicking a beat that isn't loaded starts it.

### 2026-11-09: Phase 3 task 2: player store, `PlayerBar`, play buttons

- Added `zustand` **5.0.16**, pinned with `~5.0.16` (user approved). 5.1.0 was only 3 days old, and brand-new releases are where npm supply-chain attacks usually land. 5.0.16 has the same API. The only peer warning is the known ESLint 10 one.
- `src/store/player.ts`: the store and the `Track` type (`id`, `slug`, `title`, `previewUrl`).
  - **State:** `audio`, `queue`, `index` (−1 means none), `isPlaying`, `currentTime`, `duration`, `volume`.
  - **Actions:** `playQueue`, `toggle`, `next`, `prev`, `seek` and `setVolume` act on the `<audio>` element directly. `next` on the last track pauses. `prev` on the first track restarts it. An index outside the queue is ignored.
  - **Who writes what:** `isPlaying`, `currentTime` and `duration` are written only by the element's own events. A failed `play()` (interrupted by a newer track, or a file that can't play) is swallowed, because the events already keep the state right.
  - **On the server:** nothing writes to the store there, so every server render starts empty.
- `src/components/player/PlayerBar.tsx` (client, in the root layout `src/app/layout.tsx`): the only `<audio>` element.
  - **Wiring:** it's always rendered and registers itself with a ref callback defined outside the component, so React doesn't re-attach it on every render. Its events (play, pause, error, timeupdate, durationchange, ended → `next()`) write to the store. A `NaN` duration becomes 0.
  - **The bar:** it shows once a track is loaded and is fixed to the bottom, with an 80 px spacer so it doesn't cover the footer. It has prev / play-pause / next (Next is disabled on the last track), the title linking to the beat page, a time and seek range input, and a volume range input (hidden on narrow screens). Every control is native with an `aria-label`.
- `src/components/player/PlayButton.tsx` (client): props `queue`, `index`. It shows Pause only when its track is the one loaded and playing, and its label reads "Play Midnight Drive" or "Pause Midnight Drive". Clicking it toggles the loaded track, otherwise it calls `playQueue(queue, index)`.
- `src/components/beats/BeatGrid.tsx` (server): builds the queue from the beats that have a `previewKey` and renders the grid. It replaces the 3 copies of the grid markup in `/beats` and on the home page (Featured, New releases). `BeatCard` takes `queue` and shows a `PlayButton` on the cover when its beat is in the queue.
- `src/lib/storage.ts`: `previewUrl(key)` returns `PUBLIC_CDN_URL + "/" + key`, so locally it's `/previews/<slug>.mp3` from `public/`. Server only. `.env.example` has a comment on `PUBLIC_CDN_URL` (no trailing slash; empty locally).
- `src/lib/catalog.ts`: `previewKey` added to `beatCardSelect` only. The full-file keys are still never loaded.
- `tests/unit/player-store.test.ts`: 9 tests with a fake audio object (playQueue, a bad index, no element yet, next/prev in the middle and at both ends, toggle, seek, volume).
- PLAN.md: §6 tree (`PlayButton`, `BeatGrid`, `previewUrl()`), §8 store and PlayerBar boxes ticked.
- Checks:
  - Prettier, lint, typecheck, 21 tests and build pass. The routes are unchanged (`/`, `/beats`, `/beats/[slug]` dynamic).
  - Against `pnpm start` on port 3001: `/previews/midnight-drive.mp3` returned 200 `audio/mpeg` (1.44 MB), a range request returned 206 (seeking needs it), and a missing preview returned 404.
  - Play buttons: 9 on `/` (3 featured + 6 newest), 9 on `/beats`, 3 on page 2, 9 with price sort. No full-file keys appeared in any HTML. The `<audio>` element is on every page, including the 404 page.
  - React sends the shared queue once per grid in the page payload: the first card has it, and the other 8 refer to it.
- **Not tested yet:** playback in a real browser. Claude in Chrome's tools weren't enabled for this session. To check: play from a card, the bar appears, the music keeps playing across page navigation, next/prev follow the grid, seeking and volume work, and the card's icon switches between Play and Pause.
- Not done on purpose: the beat page's play button and waveform (task 3), play counting (task 4), an error message in the bar when a preview fails to load (Phase 9 error states), keeping the player across a page reload, keyboard shortcuts (Phase 9).

### 2026-11-09: Phase 3 plan, and task 1: ffmpeg, preview script, seed previews

Phase 3 plan (user approved): 4 tasks, each reviewed and committed on its own. (1) ffmpeg + `make-preview.ts` + seed previews, (2) player store + `PlayerBar` + play buttons, (3) `Waveform`, (4) play counting. Task 1 comes first because the player needs something to play. User decisions:

- Previews are served from `public/previews/<slug>.mp3` until R2 exists. `previewKey` is `previews/<slug>.mp3`, and in task 2 the URL becomes `PUBLIC_CDN_URL` + key, or `/` + key while that variable is empty. PLAN.md §5.1 has a note.
- Demo audio: source WAVs live in `audio-src/`, which is gitignored, so full files never reach the public repo. The user has no beats ready yet and will add their own later, so for now there are placeholders (see below).
- Producer tag: a placeholder, `audio-src/tag.wav`, a spoken "Beat Store" made once with Windows' built-in speech voice (`System.Speech` in `powershell.exe` 5.1, no new dependency). Swap in a real tag and re-run the script any time.
- Previews are **not** committed. `public/previews/` is gitignored, so a fresh clone has no sound until previews are generated. They move to R2 in Phase 5.

Task 1:

- ffmpeg **9.0.2** installed with `winget install Gyan.FFmpeg` (full build, has `libmp3lame`). winget added its `bin` folder to the user PATH, so only terminals opened afterwards find `ffmpeg`. CI and Vercel never need it.
- `scripts/make-preview.ts` (run with `pnpm make-preview`, new script in `package.json`):
  - **Input:** a file or a folder. A folder means every `.wav`/`.mp3`/`.flac`/`.aif(f)` in it except the tag, because PowerShell doesn't expand `*.wav`.
  - **Options:** `--out` (default `public/previews`), `--tag` (default `audio-src/tag.wav`), `--start` (default 0), `--length` (default 90, capped at what's left of the file). Read with Node's built-in `parseArgs`.
  - **Names:** the output is `<source name>.mp3`. Every source name must be a valid slug (reuses `beatSlugSchema`), checked before any file is made.
  - **ffmpeg:** run with `execFile` (no shell). `ffprobe` gets the length first. Both inputs become 44.1 kHz stereo. The tag is padded to 20 s and looped (`apad` + `aloop`), then mixed at full volume (`amix normalize=false`). `alimiter` keeps the sum from clipping, `afade` fades out the last 3 s. The result is 128 kbps MP3 with `-map_metadata -1`, so the source's tags aren't copied. `prettier-ignore` keeps each ffmpeg flag on one line with its value.
  - **Errors:** clear messages for ffmpeg missing, a bad number, a missing tag, no input, a start past the end and a bad file name. Exit code 1.
- `prisma/seed.ts`: for each demo beat, if `public/previews/<slug>.mp3` exists, an `updateMany ... where previewKey: null` sets `previewKey = previews/<slug>.mp3`. It only fills a missing key, so a re-run never overwrites one, and it works on an existing database without `migrate reset`. The summary line now says how many beats have a preview.
- `.gitignore`: `/audio-src/` and `/public/previews/`.
- PLAN.md: §5.1 note, §6 tree (`audio-src/`, `public/previews/`), §8 "Install ffmpeg" and "make-preview" ticked.
- Checks on synthetic audio in the scratchpad (nothing real or in git):
  - A 120 s source with a title and comment gave exactly 90.0 s, 128 kbps, 44.1 kHz stereo, with only ffmpeg's own `encoder` tag left.
  - A silent source showed the tag at 0, 20, 40 and 60 s (`silencedetect`).
  - A full-scale source peaked at −0.8 dBFS (no clipping), and the last 0.5 s is faded.
  - `--start 100` gave 20 s. All 6 error cases printed their message and exited 1.
  - Folder mode skipped `tag.wav` and a `.txt` file, and a badly named file stopped the run before anything was made.
  - Seed against local Docker: 0 previews → "0 with a preview". One test file → `midnight-drive` got its key. A key changed by hand survived a re-run. Restored afterwards (0 previews, 12 PUBLISHED).
  - Lint, typecheck and 12 tests pass. No new unit tests: the script is a thin wrapper around ffmpeg, checked with ffprobe above.
- **Placeholder demo audio** (one-off, nothing committed):
  - **What it is:** 12 WAVs, `audio-src/<slug>.wav`, made with ffmpeg's `aevalsrc`. Each is 95 s mono: a plucked root-third-fifth chord in the beat's key, one pluck per beat at its BPM, so each beat sounds different when testing the player. The expression is `0.25*(sin(2πrt)+sin(2πr·third·t)+sin(2πr·1.4983·t))·exp(−5·mod(t·bpm/60, 1))`, where the third is 1.1892 for minor and 1.2599 for major.
  - **Result:** `pnpm make-preview audio-src` made 12 previews of 90 s each, and the tag was skipped. `pnpm db:seed` then reported "12 with a preview", and every key is `previews/<slug>.mp3`.
  - **To use real beats later:** put `audio-src/<slug>.wav` in place and run `pnpm make-preview audio-src` again. The seed doesn't need to run again, because the key stays the same.
- Added `-nostdin` to the script's ffmpeg call. The first placeholder loop showed that, without it, ffmpeg reads stdin as keyboard commands (it swallowed the loop's input and mangled 10 file names; those files were deleted and remade). The script's own runs weren't affected, but the flag is ffmpeg's documented way to run non-interactively.
- Note: the Claude permission guard blocks `Remove-Item` on any path containing `public`. It treats it as a system path. The test tone at `public/previews/midnight-drive.mp3` couldn't be deleted, but the placeholder preview overwrote it.

### 2026-11-08: Home page sections

- `src/app/(store)/page.tsx` replaces "Hello world!" with four sections:
  - **Hero:** heading, one line of text and a "Browse beats" button. There's no Licenses button while `/licenses` is a 404.
  - **Featured:** up to 3 featured beats as `BeatCard`s. The section is hidden when none are featured.
  - **New releases:** the 6 newest beats, with a "View all" link to `/beats` (newest first by default).
  - **Browse by genre:** one link per genre, such as `/beats?genre=Trap`. `URLSearchParams` builds the URL, so `R&B` becomes `R%26B` and `Boom Bap` becomes `Boom+Bap`.
  - With no beats on show at all, the page shows the hero and "No beats yet, check back soon."
- `await connection()` (from `next/server`, recommended in the Next 16 docs) at the top of the page makes it render per request. Without it, `pnpm build` would prerender `/` with the database (CI has none) and the page would never update. The build now shows `ƒ /` instead of `○ /`.
- `src/lib/catalog.ts`: `getFeaturedBeats()` (featured, take 3) and `getNewestBeats()` (take 6). Both reuse `catalogWhere({})`, `beatCardSelect` and the newest-first order, so the visibility rule stays in one place. The genre list reuses `getFilterOptions()`.
- A featured beat can also appear in New releases if it's one of the 6 newest. With the seed data they don't overlap, because the featured beats are the oldest.
- The two card grids repeat the `/beats` grid markup (about 7 lines each). It's kept inline rather than becoming a new component.
- No new unit tests: the new code is database queries and markup, with no pure logic.
- Checks: lint, typecheck, 12 tests and build pass. Against `pnpm start` on port 3001: Featured and New releases matched a direct SQL query, and all 7 genres were linked. The `R&B`, `Boom Bap` and `Trap` links showed the right beats. Then rows were changed for the test and restored (12 PUBLISHED, same 3 featured afterwards):
  - A DRAFT beat and two SOLD beats (one of them featured) disappeared from both grids and the genre list.
  - No featured beats hid the Featured section.
  - Every beat DRAFT showed "No beats yet".
- Note: stopping a background `pnpm start` task on Windows left its child `node` process running on port 3001. It was found and stopped by PID after both test runs. The dev server on port 3123 is still crashing on some pages from the earlier build; the user will restart it.
- Not done on purpose: play buttons on cards (Phase 3), real "type" tags like "Travis Scott type" (no such field; genre links stand in), hero artwork.

### 2026-11-08: Beat detail page `/beats/[slug]`

- `src/app/(store)/beats/[slug]/page.tsx`: a server page. On the left is the same cover placeholder as `BeatCard`, with an "Exclusive reserved" or "Sold" badge. On the right: title, genre · mood · BPM · key, all tags, the description as plain text (`whitespace-pre-line`, escaped by React), then the `LicenseSelector`. Below, a "What's included" section holds the `LicenseTable`. There's no `generateStaticParams`, so the page renders per request (`ƒ` in the build): status and prices are always current, and the build never needs the database.
- Who sees what (user decision: SOLD gets a page): beats the catalog shows (PUBLISHED or RESERVED with at least one active license) get the full page. SOLD beats get the page with a "Sold" notice, but no selector and no table. A DRAFT beat, a beat with no active license, an unknown slug or a badly formed slug gives a 404. The catalog still hides SOLD beats.
- `src/lib/catalog.ts`: `getBeatBySlug(slug)`. It checks the slug with Zod, then runs `findFirst` with `OR: [catalogWhere({}), { status: "SOLD" }]`, so the catalog's visibility rule still lives in one place. Active licenses are sorted by the tier's `sortOrder`. An explicit `select` keeps `mp3Key`, `wavKey` and `stemsKey` out of the query, so they can't reach the browser. React `cache` lets `generateMetadata` and the page share one query per request.
- `src/lib/validators.ts`: `beatSlugSchema`, made of lowercase letters, digits and `-`, at most 100 characters. Tested in `tests/unit/validators.test.ts`.
- `src/components/beats/LicenseSelector.tsx`: a client component (`useState`). It's a `<fieldset>` of native radio buttons styled as cards, each showing tier name, price and short description. The value is the `licenseTierId`, which is what the Phase 4 cart stores. On a RESERVED beat, Exclusive is disabled with "Reserved, check back soon". The selected tier's `terms` text shows below. There's no "Add to cart" button yet (user OK'd it): it comes in Phase 4.
- `src/components/beats/LicenseTable.tsx`: a server component and a plain `<table>`. It has one column per active tier (name and price), and rows for MP3, WAV, Stems (ZIP), Streams and Music videos. `null` limits show as "Unlimited". Check and dash icons have screen-reader text. It scrolls sideways on narrow screens.
- SEO: `generateMetadata` sets the title (`Midnight Drive – Trap beat · Beat Store`) and the description (the beat's description + BPM · key + "Licenses from $X", or "Sold with exclusive rights."). It also sets the canonical URL, `openGraph` (title, description, url, `type: "website"`) and `twitter.card: "summary_large_image"`. Next.js fills the `twitter:` title, description and image from the Open Graph data.
- `src/app/(store)/beats/[slug]/opengraph-image.tsx`: a 1200×630 PNG made with `ImageResponse` from `next/og`. It's built into Next, so there's no new package, and it uses the default font. It shows "Beat Store", the title, genre · BPM · key, and "From $X" or "Sold" in the dark theme colours. An unknown beat gives a 404. Added to the PLAN.md §6 tree.
- `src/app/layout.tsx`: `metadataBase` from `NEXT_PUBLIC_SITE_URL` (already in `.env.example`; it falls back to `http://localhost:3000` when the variable is unset or empty, as in CI), plus the title template `%s · Beat Store`. `src/app/(store)/beats/page.tsx` now has the title "Beats" (user decision).
- Checks: lint, typecheck, 12 tests and build pass. The build shows `/beats/[slug]` and its `opengraph-image` as `ƒ`. Against `pnpm start` on port 3001: a seeded slug returned 200 with all the tags above, and the HTML had no storage keys. An unknown slug, an uppercase slug, `..%2Fadmin` and `a%20b` returned 404. The share image returned `image/png` and looked right, and a missing beat's image returned 404. 5 rows in the local database were changed for the test, then restored (12 PUBLISHED, 48 active licenses afterwards). Results: RESERVED disabled only Exclusive, SOLD showed the notice without selector or table (and "Sold" on the share image), DRAFT and "no active license" gave 404, and a `<script>` description came out as escaped text.
- Not tested in a real browser: clicking the radio buttons and seeing the terms change.
- Note: a `pnpm dev` server that was already running on port 3123 started returning 500 for every page while I ran `pnpm build`. Its log shows "Jest worker encountered 2 child process exceptions". I left it running because I didn't start it. Restart it (Ctrl+C, then `pnpm dev`) to fix it. In future, don't run `pnpm build` while `pnpm dev` is running.
- Left out on purpose (other roadmap items): waveform and play button (Phase 3), "Add to cart" (Phase 4), similar beats (PLAN §3 mentions them, but no roadmap item does yet), JSON-LD (Phase 9), cover images (Phase 8).

### 2026-11-08: `BeatCard` and the `/beats` catalog page

- `src/app/(store)/beats/page.tsx`: a server page. Filters, search, sort and page live in the URL (`/beats?genre=Trap&sort=popular&page=2`). It parses `searchParams` with Zod, runs the query and renders the result count, filters, a 3-column grid, an empty state and Previous / "Page X of Y" / Next links. Reading `searchParams` makes it render per request (`ƒ` in the build), so the build never touches the database.
- `src/lib/validators.ts`: `catalogSearchSchema`. Every field has `.catch()`, so junk (`?page=-1`, `?bpmMin=abc`, a repeated `?genre=`, an unknown sort) is ignored and `parse` never throws. Empty form fields count as "not set". Limits: text 50 chars, search 100, BPM 1–300, max price $1–$100,000, page 1–1000.
- `src/lib/catalog.ts` (new, added to PLAN.md §6): `getCatalogPage()` and `getFilterOptions()`. Shown beats: PUBLISHED or RESERVED with at least one active license. DRAFT and SOLD never show. RESERVED stays listed because leases can still be bought. Unset filters are `undefined`, which Prisma ignores. Search matches part of the title (any case) or one whole tag. 9 beats per page. `id` breaks sort ties so pages never repeat or skip a beat.
- Price sort (approved plan): Prisma can't order beats by their cheapest license, so a `groupBy` on `BeatLicense` gets each beat's lowest active price, sorts and pages it, and a second query loads those beats in that order. No schema change.
- Max price is whole dollars in the URL, multiplied by 100 on the server. It matches beats with any active license at or under it, which is the card's "From" price.
- `src/components/beats/BeatFilters.tsx`: a GET form with `next/form` (built into Next, no new package, no client state). It has no page field, so applying filters goes back to page 1. A `key` built from the filters re-mounts the form when the URL changes (Clear, back button), because uncontrolled inputs only read `defaultValue` once.
- `src/components/beats/BeatCard.tsx`: placeholder cover (covers come with uploads, Phase 8), title linked to `/beats/[slug]` (404 until the detail page), genre · mood, BPM · key, up to 3 tags, "From $X", and an "Exclusive reserved" badge. Badges are spans with `badgeVariants`, because shadcn's `<Badge>` calls a Base UI hook from a module that isn't a client component.
- `src/lib/pricing.ts`: `formatPrice(cents)`. The only place cents are divided by 100, and only for display.
- Added: `zod` 4.6.7 (in the stack). shadcn `card`, `badge`, `input`, `native-select` (they only need `cn`, already installed; formatted with Prettier). `pnpm test` no longer has `--passWithNoTests`, because tests exist now.
- Tests: `tests/unit/validators.test.ts` (defaults, valid values, empty fields, junk, page too big) and `tests/unit/pricing.test.ts`. They import with relative paths, so Vitest needs no alias config.
- Checks: lint, typecheck, 6 tests and build pass. Against the dev server: each sort, page 2, every filter, title and tag search, `F#` in a key, a page past the end, and junk and empty params all gave the expected beats. For price sort, max price, the RESERVED badge and hiding SOLD, 4 rows in the local database were changed for the test and then restored (12 PUBLISHED, 0 prices off their default afterwards). Not tested in a real browser: clicking Apply and Clear (client-side navigation and the form re-mount).
- Not done on purpose: sort applies only on Apply (auto-apply needs a client component, Phase 9), no page title (SEO item), no play button (Phase 3), empty fields still appear in the URL (`?q=&genre=Trap`).

### 2026-11-08: Store layout, header, footer, dark theme

- Store pages now live in the `src/app/(store)/` route group (PLAN.md §6). Brackets keep the folder name out of the URL. `src/app/page.tsx` moved to `src/app/(store)/page.tsx` with `git mv`. Its own `<main>` was removed because the layout now provides it (two nested `<main>` elements is invalid HTML).
- `src/app/(store)/layout.tsx`: a full-height column with the header, a centred `max-w-6xl` `<main>` and the footer. Only store pages get it, so the admin panel (Phase 8) can have its own layout. There's still one root layout, which is where the PlayerBar goes in Phase 3. With one root layout, moving between store and admin doesn't reload the page, so the music keeps playing.
- `LayoutProps<"/">` is correct for the group layout: the generated route types list it as `"/"`, because route groups don't appear in the path.
- `src/components/layout/SiteHeader.tsx` and `SiteFooter.tsx` are server components (no state, no client JavaScript). Header: sticky, "Beat Store" home link with an icon, **Beats** and **Licenses** links, and cart and account icon links with `aria-label`s. Footer: Licenses, FAQ, Contact, Terms and Privacy links, plus `© <year> Beat Store` (the year is fixed when the page is built). Links use shadcn's `buttonVariants` on `next/link`.
- Dark theme (user decision: dark only, shadcn's neutral colours, no accent colour yet): `dark` class on `<html>` in `src/app/layout.tsx`, plus `color-scheme: dark` in the `.dark` block of `globals.css` for dark scrollbars and form controls. No toggle, so no `next-themes`. The light `:root` colours stay as shadcn generated them.
- User decision: no placeholder pages. `/beats`, `/licenses`, `/cart`, `/account` and the footer pages show a 404 until their phase builds them.
- Left for later items: mobile hamburger menu (Phase 9 responsive pass), current-page link highlighting (needs a client component), cart count (Phase 4), sign-in button (Phase 7), test-mode banner (Phase 9), page title template (SEO item).
- PLAN.md: §6 tree lists `(store)/layout.tsx` and `components/layout/`. §8 layout box ticked.
- Note: `pnpm typecheck` failed at first on `.next/dev/types/validator.ts`, an old file from a `pnpm dev` run on 2026-11-06 that still pointed at `src/app/page.tsx`. `tsconfig.json` includes `.next/dev/types`, but `next typegen` only rewrites `.next/types`. Deleting `.next/dev` (gitignored, regenerated by `pnpm dev`) fixed it. A fresh clone or CI never has this folder.
- Checks: Prettier, lint, typecheck, test and build pass (`/` prerendered as static). `pnpm dev`: `/` returns 200 with `class="dark"` on `<html>`, the header and footer links as listed, and one `<main>`. `/beats` returns 404 as expected.

### 2026-11-07: `prisma/seed.ts` (tiers, admin, 12 demo beats)

- `pnpm db:seed` runs `tsx prisma/seed.ts`. tsx is a new devDependency (`^4.23.15`, user approved). It resolves the `@/` paths from `tsconfig.json` (stated in its docs) and the generated client's extensionless imports. It loads our `.ts` files as CommonJS and replaces `import.meta` with `{ url, dirname, filename }`, so the generated client's `import.meta.url` works without `"type": "module"`. No seed command in `prisma.config.ts`: Prisma 7 no longer seeds automatically, so `pnpm db:seed` is the one entry point.
- `pnpm-workspace.yaml`: `esbuild: false`. tsx depends on esbuild, and pnpm refused the install (`ERR_PNPM_IGNORED_BUILDS`) until its install script had a decision. esbuild's binary comes from a platform package, so the script isn't needed.
- The seed imports `dotenv/config` first, then reuses `db` from `src/lib/db.ts` and calls `$disconnect()` at the end. It fails early with "ADMIN_EMAIL is not set in .env" if the variable is missing.
- Data: 4 tiers from PLAN.md §3 (2999 / 4999 / 9999 / 49900 cents). Values not in the plan were picked here: Exclusive at 49900, Basic `videoLimit` 1 (non-profit), Trackout `videoLimit` 2. One ADMIN user. 12 PUBLISHED beats across 7 genres, 3 featured, fixed `plays`, original titles. 48 `BeatLicense` rows priced at each tier's default.
- No audio or covers (user decision): every file key and `coverUrl` is empty. Phase 3 adds demo audio, and the §8 seed checkbox stays unticked until then.
- Re-runs only add missing rows (`update: {}`). The admin's role is always set back to ADMIN.
- Checks: first run printed 4 tiers / 12 beats / 48 licenses. psql showed the tier values as planned, 1 unverified ADMIN, 12 PUBLISHED beats (3 featured, none with files) and 0 price mismatches. A hand-edited price survived a second run with unchanged counts (then restored). `ADMIN_EMAIL=` gave the clear error and exit code 1. Lint, typecheck, test and build pass. `pnpm audit --audit-level=high` passes with the same 1 low + 1 moderate as before.

### 2026-11-07: `src/lib/db.ts` Prisma client singleton

- `src/lib/db.ts` exports `db`, one `PrismaClient` built with the `@prisma/adapter-pg` driver adapter (Prisma 7 PostgreSQL docs). In dev it's cached on `globalThis`, so hot reloads reuse one connection pool instead of opening a new one each time.
- The adapter is created inside the `??`, so a hot reload doesn't build an adapter that's never used (the docs example builds it outside).
- Left out on purpose (user approved the plan): `import "server-only"` (it throws outside Next.js, which would block the seed script and Vitest), and an import-time check for `DATABASE_URL` (`next build` loads page modules in CI, where there's no `.env`). `pg` pool settings stay at their defaults until Neon (Phase 5).
- `package.json`: `"postinstall": "prisma generate"`. The generated client is gitignored and Prisma 7's `migrate dev` doesn't generate it, so fresh clones, CI and Vercel would otherwise fail with "Cannot find module".
- The generated entry file is `src/generated/prisma/client.ts` as expected, so the import path didn't need changing.
- pnpm skips `postinstall` when the lockfile is already up to date, so on an existing checkout run `pnpm run postinstall` (or `pnpm prisma generate`) after changing the schema.
- Checks: a fresh clone with no `.env` and `DATABASE_URL` unset ran `pnpm install --frozen-lockfile` (postinstall generated the client), then lint, typecheck, test and build passed. The same four pass in the working copy. No page imports `db` yet, so the build doesn't bundle it yet. Typecheck covers it.
- For the seed task: `db.ts` uses the `@/` path alias and the generated client uses extensionless imports, so plain `node prisma/seed.ts` can't load it. The seed plan has to pick how to run TypeScript.

### 2026-11-07: PLAN.md §4 synced, Prisma client packages added

- PLAN.md §4 now matches `prisma/schema.prisma` (user decision): optional fields marked `?`, Better Auth user fields, UUID v4 ids, unique fields, and `emailSentAt`, `licensePdfKey` and the `LICENSE` file type kept as "later slice" notes so §5.2 still makes sense. Two key rules added: UUID ids, and no snake_case mapping.
- Added `@prisma/client` and `@prisma/adapter-pg` (user approved), both `^7.10.1`, the same range as `prisma`, so all three stay on one 7.x version. The lockfile resolves all three to exactly 7.10.1. npm's `latest` tag for Prisma is now 7.10.1 (8.x is only on the `dev` tag).
- Neither package has an install script, so `pnpm-workspace.yaml` is unchanged. `@prisma/adapter-pg` brings `pg` 8.23.1 and `@types/pg` as its own dependencies.
- Checks: lint, typecheck and test pass. `pnpm audit --audit-level=high` passes (same 1 low + 1 moderate in dev tools as before). The only peer warning is the known ESLint 10 one.

### 2026-11-07: Phase 1 schema and first migration

- `prisma/schema.prisma`: 9 models (User, Beat, LicenseTier, BeatLicense, Order, OrderItem, Download, Coupon, WebhookEvent) and 5 enums, from PLAN.md §4.
- `pnpm prisma migrate dev --name init` created `prisma/migrations/20261107101113_init/migration.sql` and `migration_lock.toml`, and applied them to the local Docker database. `\dt` shows all 9 tables.
- Prisma 7 checked against its docs: `migrate dev` no longer runs `prisma generate` or the seed. So no client was generated and no new dependency was needed for this step.
- Lint, typecheck and test pass.
- Decisions that go beyond or differ from §4 (all open to review):
  - Every id is `@default(uuid())`, a random UUID v4, so no id can be guessed. Exception: `WebhookEvent.id` is Stripe's event id.
  - `User` matches Better Auth's core user table (checked against its source): `name`, `email` unique, `emailVerified` boolean, `image?`, `createdAt`, `updatedAt`, plus our `role`. Session, Account and Verification tables come in Phase 7 with Better Auth's CLI.
  - Optional because the §5.2 flow fills them later: `Order.stripeSessionId` (the order is created before the Stripe session), `stripePaymentIntentId`, `downloadTokenHash`, `downloadTokenExpiresAt`, `paidAt`, and `email` (see "Decisions needed later").
  - Left out because they belong to later slices: `Order.emailSentAt` (email), `OrderItem.licensePdfKey` and the `LICENSE` file type (license PDF).
  - `BeatLicense.priceCents` is required: the beat's real price for that tier, copied from the tier default and editable. Checkout reads one column instead of "override or default".
  - `Beat.reservedByOrderId` is a real foreign key to `Order`, so it can't point at an order that doesn't exist.
  - File keys on `Beat` are optional, because files are uploaded after the beat row exists. `description` defaults to an empty string.
  - Unique: `Beat.slug`, `LicenseTier.code`, `Coupon.code`, `User.email`, plus the two `@@unique` pairs from §4.
  - No `@map` to snake_case: the raw reservation SQL in `.claude/rules/exclusives.md` uses `"Beat"`, `"reservedByOrderId"` and `"reservedUntil"` as written.
  - Coupons: "exactly one of `percentOff` / `amountOffCents`" is checked with Zod when a coupon is saved, not in the database.
- Note: timestamps are Prisma's default `timestamp(3)` without time zone. That's safe while the database session runs in UTC (local Docker: `UTC`). The raw reservation SQL uses `now()`, so check the Neon time zone when it's set up in Phase 5.

### 2026-11-06: Phase 0 closed

- The user set the GitHub CI issue aside. Actions runs are refused with "account is locked due to a billing issue" (Free plan, $0 usage, public repo, Actions enabled). No API can see or clear that lock; only GitHub Support can. The user has a support ticket draft. The workflow file is in place, and a fresh local clone passes every CI step.
- PLAN.md §8: the GitHub/CI item is ticked (develop pushed, workflow added). The accounts item (Stripe test mode, R2, Neon, Google OAuth) moved from Phase 0 to the start of Phase 5, where the first of them (Stripe) is needed.

### 2026-11-06: Phase 0 follow-ups (commit `7b2d260`)

- Phase 0 committed as `d9fec92` and pushed to `develop`. The Husky pre-commit hook ran lint-staged with nothing to fix.
- CI run 42213451076 never started: GitHub says the account is locked due to a billing issue. Not a code problem. A local simulation on a fresh clone (no `.env`; `pnpm install --frozen-lockfile`, lint, typecheck, test, build) passes.
- ESLint upgraded from 9 to **10.14.0** (user decision). npm marks ESLint 9 "no longer supported". `eslint-plugin-react`, `eslint-plugin-jsx-a11y` and `eslint-plugin-import` (bundled by `eslint-config-next` 16.4.5, already at their newest versions) declare support only up to ESLint 9, so pnpm prints a peer warning. Lint still works: a deliberately bad component triggered rules from every plugin with no crash. If a plugin ever crashes, roll back with `pnpm add -D eslint@^9`.
- PLAN.md synced: in §7, `DATABASE_URL` uses port 5433 and a note says `.env.example` is v1-only. In §8, the Phase 0 tools item is ticked (Node 24 LTS, pnpm, Docker), "Install ffmpeg" moved to Phase 3 and "Install the Stripe CLI" to Phase 5.
- winget: Node pinned to `24.*`, so `winget upgrade` won't move it to 26.

### 2026-11-06: Phase 0 scaffold and tooling (commit `d9fec92`)

- Next.js **16.4.5** + React 19.3 from create-next-app 16.4.5 (`--empty`: TypeScript, Tailwind 4, ESLint, App Router, `src/`). It was scaffolded in a temp folder and copied in, because create-next-app refuses a folder that already has files.
- Tailwind 4 runs through the `@tailwindcss/turbopack` loader in `next.config.ts`, so there is no PostCSS file.
- Dev tools: Prettier, Husky (pre-commit runs `lint-staged`), lint-staged, Vitest, Prisma **7.10.1**, dotenv. `@types/node` bumped to 24.
- shadcn 4.23 `init --defaults`: style `base-nova` on Base UI, neutral colors, lucide icons, Geist font in `layout.tsx`, plus a `Button` component. It adds the `cn` package (shadcn's own replacement for clsx + tailwind-merge; checked: published by shadcn, no dependencies) and `shadcn` as a runtime dependency, because `globals.css` imports `shadcn/tailwind.css`.
- `pnpm-workspace.yaml`: only `prisma` and `@prisma/engines` may run install scripts (they download the schema engine). pnpm 12 fails the install otherwise.
- Docker Postgres 18 on host port 5433. `prisma.config.ts` plus an empty `schema.prisma` (generator output `src/generated/prisma`, gitignored). `.env.example` (v1 only). Local `.env` copied from it (gitignored).
- CI: `.github/workflows/ci.yml` runs lint, typecheck, test and build on Node 24 for pushes to `develop` and PRs to `main`.
- `agentRules: false` in `next.config.ts`. Without it, `next dev` 16.4 writes an `AGENTS.md` on every start, even when scaffolded with `--no-agents-md`.
- Prettier skips `*.md` and `.claude/`, so it never rewrites the docs or the git guard hook.
- Scripts: `typecheck` = `next typegen && tsc --noEmit` (route types such as `LayoutProps` need typegen first). `test` = `vitest run --passWithNoTests` until the first test exists. `db:seed` comes with `seed.ts` in Phase 1.
- Checks: Postgres 18.6 healthy; `prisma validate` and a `SELECT 1` through `.env` pass; lint, typecheck, test, build and Prettier pass; `pnpm dev` serves `/` with 200; `pnpm audit --audit-level=high` passes. The audit still shows 1 moderate (minimatch) and 1 low (deepmerge, no fix yet), both inside dev tooling (shadcn CLI, ESLint plugins).

### 2026-11-06: Phase 0 tools installed

- Node **24.22.1** LTS via winget (`OpenJS.NodeJS.LTS`). It replaced Node 20.20.0, which reached end of life on 2026-04-30. winget's newest 24.x is 24.22.1. It's the latest Node 24 security release; 24.22.2 has no security fixes.
- pnpm **12.18.0** via `npm install -g pnpm@latest`. It runs as a native `pnpm.exe`.
- No restart needed: both are on the existing PATH.
- Docker Desktop is installed (Engine 29.6.2, Compose v5.3.1, WSL2), but the engine is not started yet.
- Stripe CLI and ffmpeg are deferred to the slices that need them (user decision).
- Caution: winget offers Node 26 as an upgrade for `OpenJS.NodeJS.LTS`, so `winget upgrade --all` would move Node off 24.

Phase 0 decisions (approved plan):

- Local Docker Postgres on host port **5433**. A native PostgreSQL 18 Windows service (`postgresql-x64-18`) already uses 5432 and stays untouched.
- `dotenv` added as a dev dependency: Prisma 7's `prisma.config.ts` needs it to read `.env`.
- `.env.example` holds v1 variables only. Resend and Upstash placeholders come with their slices.
- Node 24 LTS (not 26). Prisma pinned to `@7` (7.10.1), because npm's `latest` tag points to an 8.0 release candidate.

### 2026-11-06: Branch protection on `main`

- GitHub: `main` now requires a pull request before merging, with 0 required approvals. Admins can't bypass it, and force pushes and deleting the branch are blocked. This also stops direct pushes from your own terminal, which the Claude hook can't do.
- GitHub CLI is logged in as `whomngmnt` (token scopes: repo, read:org, gist).

### 2026-11-06: PLAN.md matches the new stack

- `PLAN.md`: Next.js 16 and Better Auth (Google sign-in only in v1) in the stack, auth flow, routes, env vars and roadmap. The four later slices (rate limiting, email, license PDF, E2E tests) are tagged where they appear and listed in a new "Later slices" roadmap section. §9 Security Checklist is unchanged.
- Decision: v1 sign-in is Google only. Email and magic-link sign-in come later with Resend.

### 2026-11-06: Progress-tracking rule

- `CLAUDE.md`: added the rule to update `PROGRESS.md` at the end of each task, so every session keeps this file current.

### 2026-11-06: Claude Code setup (commit `d87ce67`)

Done:

- `CLAUDE.md`: rules for every task (cents, server-side checks, auth guards, Zod, secrets), stack, commands, review workflow.
- `.claude/rules/`: detailed rules for Stripe checkout, exclusives, downloads and uploads. Each loads only when Claude works on matching files.
- `.claude/hooks/guard-git.mjs` and `.claude/settings.json`: a hook that blocks pushes to `main` and staging `.env` files. 40 test cases pass, and it blocks for real in a live session.
- `.gitignore`: ignores `.env*` except `.env.example`.

Decisions:

- Next.js 16 instead of 15, because 15 reached end of life on 2026-10-21.
- Better Auth instead of Auth.js, because Auth.js is in maintenance mode and v5 never left beta.
- Moved to later slices, out of v1: Resend email, license PDF, Playwright, Upstash rate limiting.
- Claude commits only after the user has reviewed the diff.

### 2026-11-06: Project plan (commit `4802f8e`)

- `PLAN.md`: full plan covering features, data model, flows, security checklist, roadmap and definition of done.

## Up next

- [ ] Decide whether to bump Better Auth from 1.7.22 (see Open questions).
- [ ] Push the Phase 9 item 5 commit when the user says so. Open `/licenses` once with Docker running.
- [ ] Swap the placeholder contact values in `.env` for real ones once the accounts exist (and set them on Vercel in Phase 10).
- [ ] Phase 9 items 1–4 (mobile and error pages, accessibility, SEO, performance), one at a time, plan first.
