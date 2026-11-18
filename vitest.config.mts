// Vitest settings. Vite reads the `@/` import alias from tsconfig.json, so
// tests can load app code that imports `@/lib/...` (built into Vite 8, no
// plugin needed).
//
// Two groups of tests:
// - unit (`pnpm test`): no database, no network. CI runs these.
// - integration (`pnpm test:integration`): against the local Docker
//   Postgres from .env, which must be migrated and seeded. Stripe is never
//   called: each test fakes the Stripe calls it needs.
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    projects: [
      {
        extends: true,
        test: { name: "unit", include: ["tests/unit/**/*.test.ts"] },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          setupFiles: ["tests/integration/setup.ts"],
          // One file at a time, so the tests don't compete for the
          // database's connections.
          fileParallelism: false,
        },
      },
    ],
  },
});
