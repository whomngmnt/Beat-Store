// Vitest settings. Vite reads the `@/` import alias from tsconfig.json, so
// tests can load app code that imports `@/lib/...` (built into Vite 8, no
// plugin needed).
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
});
