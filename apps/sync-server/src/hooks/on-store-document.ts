import { encodeStateAsUpdate, encodeStateVector } from "yjs";
import type { onStoreDocumentPayload } from "@hocuspocus/server";
import { documentState, documents } from "@local-first-docs/db";
import { eq } from "drizzle-orm";
import { db } from "../db.js";
import type { SyncContext } from "../context.js";
import { warnIfDocumentStateTooLarge } from "../validation/payload-guards.js";

export async function onStoreDocument(
  data: onStoreDocumentPayload<SyncContext>,
): Promise<void> {
  const state = Buffer.from(encodeStateAsUpdate(data.document));
  const stateVector = Buffer.from(encodeStateVector(data.document));

  warnIfDocumentStateTooLarge(data.documentName, state.byteLength);

  await db
    .insert(documentState)
    .values({ documentId: data.documentName, state, stateVector })
    .onConflictDoUpdate({
      target: documentState.documentId,
      set: { state, stateVector, updatedAt: new Date() },
    });

  await db
    .update(documents)
    .set({ updatedAt: new Date() })
    .where(eq(documents.id, data.documentName));
}
