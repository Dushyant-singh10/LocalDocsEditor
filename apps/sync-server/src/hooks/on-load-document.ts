import { eq } from "drizzle-orm";
import type { onLoadDocumentPayload } from "@hocuspocus/server";
import { documentState } from "@local-first-docs/db";
import { db } from "../db.js";
import type { SyncContext } from "../context.js";

// Returning a Uint8Array here makes Hocuspocus apply it as the document's
// initial state via Y.applyUpdate — see Hocuspocus.ts's onLoadDocument
// handling. Returning undefined leaves a brand-new, empty Y.Doc in place,
// which is correct for a document that has never been synced before.
export async function onLoadDocument(
  data: onLoadDocumentPayload<SyncContext>,
): Promise<Uint8Array | undefined> {
  const [row] = await db
    .select({ state: documentState.state })
    .from(documentState)
    .where(eq(documentState.documentId, data.documentName))
    .limit(1);

  return row?.state;
}
