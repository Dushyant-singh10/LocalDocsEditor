import { test, expect } from "@playwright/test";

// Assumes: user A (owner) can edit the document at E2E_DOCUMENT_URL, and a
// version has already been saved via the History panel before this spec
// runs — E2E_VERSION_LABEL should match that version's label.
test.use({ storageState: "e2e/.auth/user-a.json" });

test("restoring a version preserves another tab's concurrent pending edit", async ({ browser }) => {
  const documentUrl = process.env.E2E_DOCUMENT_URL;
  const versionLabel = process.env.E2E_VERSION_LABEL;
  test.skip(!documentUrl || !versionLabel, "Set E2E_DOCUMENT_URL and E2E_VERSION_LABEL");

  const context = await browser.newContext({ storageState: "e2e/.auth/user-a.json" });
  const tabA = await context.newPage();
  const tabB = await context.newPage();

  await tabA.goto(documentUrl!);
  await tabB.goto(documentUrl!);
  await expect(tabA.locator(".ProseMirror")).toBeVisible();
  await expect(tabB.locator(".ProseMirror")).toBeVisible();

  // Tab B makes an edit right as the restore happens on Tab A.
  await tabB.locator(".ProseMirror").click();
  const concurrentText = `concurrent-edit-${Date.now()}`;
  await tabB.keyboard.type(concurrentText);

  await tabA.getByRole("button", { name: /history/i }).click();
  await tabA.getByText(versionLabel!).click();
  await tabA.getByRole("button", { name: /^restore$/i }).click();
  await tabA.getByRole("button", { name: /^restore$/i }).last().click(); // confirm dialog

  await expect(tabA.getByText(/version restored/i)).toBeVisible();

  // Give both tabs a moment to exchange updates, then confirm neither side
  // lost data: the restore applied, AND tab B's concurrent text survived.
  await tabA.waitForTimeout(2000);
  await expect(tabA.locator(".ProseMirror")).toContainText(concurrentText);
});
