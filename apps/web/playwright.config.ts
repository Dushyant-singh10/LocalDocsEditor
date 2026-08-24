import { defineConfig, devices } from "@playwright/test";

// These specs exercise the local-first sync engine end-to-end and need the
// full stack running: `pnpm dev` (web) + `pnpm dev:sync` (sync-server) + a
// real Postgres reachable via DATABASE_URL, plus a signed-in test session
// (see e2e/README.md). They are not run by the CI workflow, which only
// builds the app — wire them into CI once a disposable test DB/OAuth setup
// exists.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
