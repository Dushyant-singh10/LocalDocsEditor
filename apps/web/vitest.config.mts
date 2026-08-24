import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // e2e/*.spec.ts are Playwright specs (run via `test:e2e`), not Vitest —
    // Vitest's default include glob would otherwise also match "*.spec.ts"
    // and try to execute them, crashing on Playwright-only APIs like test.use().
    exclude: ["**/node_modules/**", "e2e/**"],
  },
});
