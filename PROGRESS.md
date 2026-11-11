# Progress

Claude updates this file at the end of each task. Newest entries go first in the log.

## Current status

- **Stage:** Phase 5 (Stripe checkout) code is committed (`aa610f2`) and pushed to `origin/develop`. 7 of the 10 PLAN.md §8 Phase 5 boxes are ticked. The other 3 are the user's (accounts, Stripe CLI install and `stripe login`, a run with `stripe listen`). Nothing has been paid through real Stripe yet: `.env` has no Stripe test key.
- **Branch:** all work on `develop`. `main` is protected on GitHub and only changes through a pull request.
- **Next step:** the user makes a Stripe test account, puts the keys in `.env`, installs the Stripe CLI and runs the manual checkout checklist in the 2026-11-11 log entry. The R2, Neon and Google OAuth accounts are also still to make (check Neon's time zone then). After that, Phase 6: delivery (the guest download link decision comes first).

## Open questions

- **Phase 5 was built without the plan-first step.** The user asked to "implement every task from phase 5 and just tell how you did it", so there was no plan to OK. After reading the summary, which listed the timing change and the new fields below, the user asked to commit and push. So both are in `aa610f2`, and either can still change if the user says so.
- **Timing change from PLAN.md (committed).** Stripe refuses a session that expires less than 30 minutes after it creates it, so "now + 30 min" counted on our server can fail. The session now lasts 31 minutes and the exclusive hold 35, so the hold can't run out while the buyer can still pay. PLAN.md §5.2 and §5.4, `exclusives.md` and `stripe-checkout.md` were changed to match.
- **New schema fields (committed).** `Order.reviewNote` (a payment that doesn't match the order) and `OrderItem.refundNeeded` / `refundedAt` (the lost-exclusive refund the cron job retries). PLAN.md §5.2 needs both, but §4 didn't have them. Migration `20261111065236_phase5_review_and_refund`.
- **Cancel blocks your own exclusive.** If a buyer cancels on Stripe's page, their exclusive stays held until the session expires (up to 31 min), so they can't check it out again until then. A possible fix: put the order id in the cancel URL and have the cancel page expire the Stripe session. Not built: the decision is the user's.
- **An expired hold looks reserved until it's freed.** The cart blocks the exclusive of any RESERVED beat, even when `reservedUntil` has passed, until the `checkout.session.expired` webhook or the cron job frees it. The reservation SQL's "take over an expired hold" branch is then only a safety net.
- **Vercel Cron limits (Phase 10).** The plan runs the cron routes every 5 minutes. Check Vercel's current plan limits when deploying: the Hobby plan has allowed only daily cron jobs. No `vercel.json` yet: deploying is Phase 10.
- Known issue, set aside by the user: GitHub refuses every Actions run with "account is locked due to a billing issue", so CI shows red. Only GitHub Support can lift it. Don't investigate again unless the user asks.

## Decisions needed later

Recorded 2026-11-07. The user said not to change any code for these now.

- **Guest download link (Phase 6, still open).** Phase 5 shows each item's files on the success page but no download buttons yet. Only the SHA-256 hash of the guest token is stored, but the success page has to show the raw link. Decide when the token is created so the success page can show it.
- **Guest email (Phase 5): done with the default.** Fulfilment saves the email the buyer typed in Stripe Checkout (`customer_details.email`) on the order.
- **Admin sign-in (Phase 7).** The seed creates the admin `User` from `ADMIN_EMAIL` with `emailVerified: false` and no Google account linked. When Better Auth arrives, check that signing in with Google under that email links to this existing user instead of failing or creating a second one.
- **Neon time zone (when Neon is set up, Phase 5).** Reminder: Neon is in this phase's account list. Timestamps are `timestamp(3)` without time zone, which is safe only while the database session runs in UTC (local Docker: `UTC`). The raw reservation SQL uses `now()`. Check Neon's time zone then and decide whether anything needs to change.

## Log

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

- [ ] Browser check of Phase 3:
  - Play from a card, and the bar appears.
  - The music keeps playing across pages.
  - Next and previous follow the grid. Seek and volume work.
  - The waveform draws, follows the bar, and a click on it seeks or starts the beat.
  - `plays` goes up once after 10 s of listening.

Phase 4: Cart (PLAN.md §8), plan first:

- [ ] Zustand `cart` store persisted to localStorage; one tier per beat
- [ ] `CartDrawer` plus `/cart` page; `lib/pricing.ts` (totals, bundle, coupon) with unit tests
