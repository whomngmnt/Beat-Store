# Beat Store

Online store for type beats: watermarked previews, four license tiers, Stripe Checkout in test mode and signed, expiring downloads.

- `PLAN.md`: features, data model, flows and roadmap
- `PROGRESS.md`: current status and log

## Local setup

Needs Node 24, pnpm and Docker Desktop.

```
pnpm install
cp .env.example .env     # PowerShell: Copy-Item .env.example .env
docker compose up -d     # Postgres on localhost:5433
pnpm dev                 # http://localhost:3000
```

## Checks

```
pnpm lint && pnpm typecheck && pnpm test
```
