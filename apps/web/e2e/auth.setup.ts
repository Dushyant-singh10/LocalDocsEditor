import { test as setup } from "@playwright/test";

// Real GitHub OAuth can't be driven headlessly in CI. Two options to
// populate these storage states before running the specs below:
//
//   1. (quick, manual) `npx playwright codegen http://localhost:3000`, sign
//      in as two different GitHub test accounts, then
//      `await page.context().storageState({ path: "e2e/.auth/user-a.json" })`
//      (and user-b.json) from the codegen session.
//   2. (repeatable) add a NextAuth Credentials provider gated behind
//      `process.env.NODE_ENV === "test"` in lib/auth.ts, and have this setup
//      project drive that instead of GitHub.
//
// Neither is wired up yet — this file documents the shape Playwright expects
// (a `setup` project whose output feeds `storageState` on the real specs).
setup("authenticate as user A", async () => {
  setup.skip(true, "Populate e2e/.auth/user-a.json via one of the methods documented above.");
});

setup("authenticate as user B", async () => {
  setup.skip(true, "Populate e2e/.auth/user-b.json via one of the methods documented above.");
});
