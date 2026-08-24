import { test, expect } from "@playwright/test";

// Assumes: user B (from e2e/.auth/user-b.json) has been granted the
// "viewer" role on the document at E2E_DOCUMENT_URL, and the app is running
// with NEXT_PUBLIC_E2E=1 (which exposes the window.__hocuspocusProvider test
// hook in editor-client.tsx — never set this in a real deployment). This is
// the strongest version of the check — it drives the page's own websocket
// connection directly and confirms the server closes it, rather than just
// asserting the UI looks read-only (which would only prove the client hid
// the toolbar, not that writes are actually rejected server-side).
test.use({ storageState: "e2e/.auth/user-b.json" });

test("a viewer's connection is closed if it attempts to push a document update", async ({ page }) => {
  const documentUrl = process.env.E2E_DOCUMENT_URL;
  test.skip(!documentUrl, "Set E2E_DOCUMENT_URL to a document where this session is a Viewer");

  await page.goto(documentUrl!);

  // The toolbar/editable state should already reflect Viewer role client-side.
  await expect(page.locator(".ProseMirror[contenteditable='false']")).toBeVisible();

  // Attempt to bypass the UI and push a raw Yjs update directly through the
  // page's own Hocuspocus provider — this simulates a malicious client using
  // devtools rather than the rendered editor.
  const wasDisconnected = await page.evaluate(() => {
    return new Promise<boolean>((resolve) => {
      const provider = (
        window as unknown as {
          __hocuspocusProvider?: { document: unknown; on: (event: string, cb: () => void) => void };
        }
      ).__hocuspocusProvider;
      if (!provider) {
        resolve(false);
        return;
      }
      provider.on("close", () => resolve(true));
      // @ts-expect-error - test-only escape hatch, see editor-client.tsx
      const Y = window.Y;
      // A well-formed update from a throwaway doc, so this exercises the
      // *role* rejection in beforeSync, not just malformed-buffer handling.
      const scratch = new Y.Doc();
      scratch.getMap("test").set("x", 1);
      Y.applyUpdate(provider.document, Y.encodeStateAsUpdate(scratch));
      setTimeout(() => resolve(false), 5000);
    });
  });

  expect(wasDisconnected).toBe(true);
});
