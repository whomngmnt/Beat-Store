# Progress

Claude updates this file at the end of each task. Newest entries go first in the log.

## Current status

- **Stage:** Phase 1 in progress. Schema and first migration committed (`eaae85b`). `@prisma/client` and `@prisma/adapter-pg` added.
- **Branch:** all work on `develop`. `main` is protected on GitHub and only changes through a pull request.
- **Next step:** Phase 1: `src/lib/db.ts` (plan first), then `prisma/seed.ts`.

## Open questions

- Phase 3 needs hosted preview files before the R2 account exists (Phase 5). Serve demo previews from `public/` until then, or create R2 earlier?
- Known issue, set aside by the user: GitHub refuses every Actions run with "account is locked due to a billing issue", so CI shows red. Only GitHub Support can lift it. Don't investigate again unless the user asks.

## Decisions needed later

Recorded 2026-11-07. The user said not to change any code for these now.

- **Guest download link (Phase 5 or 6).** Only the SHA-256 hash of the guest token is stored, but the success page has to show the raw link. Decide when the token is created so the success page can show it.
- **Guest email (Phase 4 or 5).** Default: take it from Stripe Checkout after payment, which is why `Order.email` is optional. Asking for the email on the cart page before checkout is the alternative, only if the user changes the default.
- **Neon time zone (when Neon is set up, Phase 5).** Remind the user at that point. Timestamps are `timestamp(3)` without time zone, which is safe only while the database session runs in UTC (local Docker: `UTC`). The raw reservation SQL uses `now()`. Check Neon's time zone then and decide whether anything needs to change.

## Log

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

## Up next: Phase 1 (PLAN.md §8)

- [x] `schema.prisma` with the models from PLAN.md §4, then `pnpm prisma migrate dev`
- [ ] `src/lib/db.ts` Prisma client singleton (also add `prisma generate` to the workflow: Prisma 7 no longer runs it on `migrate dev`)
- [ ] `prisma/seed.ts`: 4 license tiers, admin user, ~12 demo beats; add the `db:seed` script
- Dependencies: `@prisma/client` and `@prisma/adapter-pg` added. Still needs `tsx` for `seed.ts` (ask first).
