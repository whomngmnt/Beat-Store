# Beat Store

Online store for type beats: a catalog with watermarked previews, 4 license tiers (Basic / Premium / Trackout / Exclusive), Stripe Checkout in **test mode**, signed expiring downloads, and an admin panel.

`PLAN.md` holds the features, data model, flows, folder layout (§6) and roadmap (§8). Read the relevant section before a task. Where PLAN.md still names Next.js 15, Auth.js or a later-slice tool, the Stack section below wins.

## How we work

- The user reviews every diff and must be able to explain all of it in an interview. Keep that possible.
- For any change that touches more than one file, plan first: list the files and the approach, then wait for an OK.
- Use the simplest approach that works. No extra abstractions, layers, wrappers or config "for later".
- After each task, explain what you changed and why, in plain words.
- At the end of each task, update `PROGRESS.md`: status, open questions, a log entry and next steps.
- If a change would contradict PLAN.md, say so and ask.
- When a roadmap item is done, tick its checkbox in PLAN.md §8.

## Git

- Don't commit until the user has reviewed the diff and said so.
- Commit and push only on `develop` (`git push origin develop`). Never commit to, merge into or push `main`.
- Never commit `.env` files, real keys or a real email address.
- `.claude/hooks/guard-git.mjs` blocks pushes to `main` and staging `.env` files. Don't work around it. If it fires, stop and tell the user.

## Stack

Next.js 16 (latest 16.x, App Router, `src/` dir) + TypeScript · pnpm · Tailwind + shadcn/ui · Zustand · wavesurfer.js · PostgreSQL (Docker locally, Neon hosted) · Prisma · Better Auth (Google sign-in) · Cloudflare R2 (S3 API) · Stripe Checkout + webhooks · Zod · Vitest · ffmpeg · Vercel · GitHub Actions.

**Later slices, not in v1:** Resend + React Email (receipt email, magic-link sign-in), @react-pdf/renderer (license PDF), Playwright (E2E tests), Upstash (rate limiting). Don't install or build these until the user starts that slice. PLAN.md §1 "Out of scope" and §8 "Later ideas" are out of v1 too.

Ask before adding any other dependency or swapping one of these. Check current docs for APIs instead of relying on memory. For example, Next.js 16 renamed `middleware.ts` to `proxy.ts`.

## Commands

These are set up in Phase 0. If a script is missing, add it under exactly this name.

```
docker compose up -d                 # local Postgres
pnpm prisma migrate dev              # apply migrations
pnpm db:seed                         # license tiers, admin user, ~12 demo beats
pnpm dev
pnpm lint && pnpm typecheck && pnpm test
pnpm audit --audit-level=high
stripe listen --events checkout.session.completed,checkout.session.expired,charge.refunded --forward-to localhost:3000/api/webhooks/stripe
```

Run lint, typecheck and the relevant tests before calling a task done.

## Rules for every task

- **Money is integer cents.** No floats for prices or totals anywhere.
- **The server decides.** Re-read prices from the DB and recompute totals on the server. Never trust a price, total, status or ID sent by the client or put in a URL.
- **Check auth on the server.** Every protected page, route handler and server action calls `requireUser()` / `requireAdmin()` from `src/lib/auth-guards.ts` first. `proxy.ts` only redirects. It is not a security boundary (CVE-2025-29927).
- **Validate all input with Zod.** Beat descriptions are plain text. Never use `dangerouslySetInnerHTML`.
- **Secrets live only in env vars.** `.env` is gitignored. `.env.example` holds placeholders only. Add one for every new env var.

## Detailed rules

These load automatically when Claude reads or edits a matching file. Before starting work in one of these areas, read the file, even if no matching file exists yet:

- `.claude/rules/stripe-checkout.md`: checkout, webhook, fulfilment, success page, refunds
- `.claude/rules/exclusives.md`: exclusive reservations and race conditions
- `.claude/rules/downloads.md`: private files, signed URLs, guest tokens, download limits
- `.claude/rules/uploads.md`: admin uploads, file checks, previews
