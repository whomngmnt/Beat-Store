# Progress

Claude updates this file at the end of each task. Newest entries go first in the log.

## Current status

- **Stage:** setup done, Phase 0 not started. No app code yet.
- **Branch:** all work on `develop`. `main` is untouched.
- **Next step:** answer the open questions below, then start Phase 0 (PLAN.md §8).

## Open questions

- Magic-link sign-in needs email, which is now a later slice. Is v1 sign-in Google only?
- PLAN.md still lists Next.js 15, Auth.js and the cut features. Update it to match CLAUDE.md?
- Turn on GitHub branch protection for `main`? The hook only stops Claude's own commands.

## Log

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

## Up next: Phase 0 (PLAN.md §8)

- [ ] Tools: Node 20+ (20.20.0 already installed), pnpm, Docker Desktop, Stripe CLI, ffmpeg
- [ ] Scaffold Next.js 16 (TypeScript, Tailwind, App Router, ESLint, `src/`)
- [ ] Prettier, shadcn/ui, Husky + lint-staged
- [ ] `docker-compose.yml` with Postgres, Prisma, `.env.example`
- [ ] Accounts: Stripe (test mode), Cloudflare R2, Neon
- [ ] Basic CI workflow (lint, typecheck, test, build)
