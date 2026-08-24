import { test, expect } from "@playwright/test";

// Assumes: user A (owner) has already created a document at the URL passed
// via E2E_DOCUMENT_URL, and e2e/.auth/user-a.json is a valid storage state.
// See e2e/README.md and auth.setup.ts.
test.use({ storageState: "e2e/.auth/user-a.json" });

test("editing works fully offline and reconciles once the network returns", async ({ page, context }) => {
  const documentUrl = process.env.E2E_DOCUMENT_URL;
  test.skip(!documentUrl, "Set E2E_DOCUMENT_URL to a document this session can edit");

  await page.goto(documentUrl!);
  await expect(page.locator(".ProseMirror")).toBeVisible();

  // Go offline — zero network requests should block editing.
  await context.setOffline(true);
  await page.locator(".ProseMirror").click();
  await page.keyboard.type("Written entirely offline.");
  await expect(page.locator(".ProseMirror")).toContainText("Written entirely offline.");

  // Reconnect: the sync engine should push the offline edit without a reload.
  await context.setOffline(false);
  await expect(page.getByText(/all changes saved/i)).toBeVisible({ timeout: 15_000 });

  // A second tab loading the same document (after coming back online) must
  // see the offline edit — proof it actually reached the server, not just
  // that the local IndexedDB copy looks right.
  const secondPage = await page.context().newPage();
  await secondPage.goto(documentUrl!);
  await expect(secondPage.locator(".ProseMirror")).toContainText("Written entirely offline.");
});
