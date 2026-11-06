# Progress

Claude updates this file at the end of each task. Newest entries go first in the log.

## Current status

- **Stage:** setup done, Phase 0 not started. No app code yet.
- **Branch:** all work on `develop`. `main` is protected on GitHub and only changes through a pull request.
- **Next step:** start Phase 0 (PLAN.md §8).

## Open questions

- None right now.

## Log

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

## Up next: Phase 0 (PLAN.md §8)

- [ ] Tools: Node 20+ (20.20.0 already installed), pnpm, Docker Desktop, Stripe CLI, ffmpeg
- [ ] Scaffold Next.js 16 (TypeScript, Tailwind, App Router, ESLint, `src/`)
- [ ] Prettier, shadcn/ui, Husky + lint-staged
- [ ] `docker-compose.yml` with Postgres, Prisma, `.env.example`
- [ ] Accounts: Stripe (test mode), Cloudflare R2, Neon, plus a Google OAuth client
- [ ] Basic CI workflow (lint, typecheck, test, build)
