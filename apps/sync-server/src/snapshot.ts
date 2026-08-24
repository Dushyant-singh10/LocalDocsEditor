import type { Hocuspocus } from "@hocuspocus/server";
import type { Doc } from "yjs";
import { encodeStateAsUpdate } from "yjs";
import { prosemirrorJSONToYXmlFragment, yXmlFragmentToProseMirrorRootNode } from "@tiptap/y-tiptap";
import { editorSchema, YJS_FIELD_NAME } from "./editor-schema.js";
import type { SyncContext } from "./context.js";

export interface SnapshotResult {
  contentJson: Record<string, unknown>;
  stateSnapshot: Buffer;
}

// Restore-without-clobbering, extracted as a pure function of (document,
// targetContentJson) so it can be exercised directly in unit tests against a
// plain in-memory Y.Doc, without needing a live Hocuspocus/Postgres stack —
// see snapshot.test.ts for the concurrent-edit-survives-a-restore scenario.
// See restoreVersion below for why this is safe against concurrent edits.
export function applyRestoreTransaction(
  document: Doc,
  targetContentJson: Record<string, unknown>,
  origin?: unknown,
): void {
  const fragment = document.getXmlFragment(YJS_FIELD_NAME);
  document.transact(() => {
    prosemirrorJSONToYXmlFragment(editorSchema, targetContentJson, fragment);
  }, origin);
}

// Opens a server-internal (non-websocket) connection to the live document
// held by this process, so we always read the true in-memory state rather
// than the last debounced write to Postgres.
export async function captureSnapshot(
  hocuspocus: Hocuspocus<SyncContext>,
  documentId: string,
): Promise<SnapshotResult> {
  const connection = await hocuspocus.openDirectConnection(documentId, {
    userId: "system",
    role: "owner",
  });

  try {
    const document = connection.document;
    if (!document) throw new Error("Direct connection has no document");

    const fragment = document.getXmlFragment(YJS_FIELD_NAME);
    const contentJson = yXmlFragmentToProseMirrorRootNode(fragment, editorSchema).toJSON();
    const stateSnapshot = Buffer.from(encodeStateAsUpdate(document));

    return { contentJson, stateSnapshot };
  } finally {
    await connection.disconnect({ unloadImmediately: false });
  }
}

// Restore-without-clobbering: applies the target version's content as a real
// Yjs transaction against the LIVE document via a minimal-diff tree update
// (prosemirrorJSONToYXmlFragment -> y-tiptap's updateYFragment), instead of
// naively re-applying an old encoded state (which would just re-add old
// content alongside everything since, not revert it — see plan notes).
// Concurrent collaborator edits outside the diffed region are untouched;
// edits inside it are preserved by Yjs's CRDT origin-anchoring even if their
// anchor position ends up tombstoned.
export async function restoreVersion(
  hocuspocus: Hocuspocus<SyncContext>,
  documentId: string,
  targetContentJson: Record<string, unknown>,
  restoredBy: { userId: string; versionId: string },
): Promise<SnapshotResult> {
  const connection = await hocuspocus.openDirectConnection(documentId, {
    userId: "system",
    role: "owner",
  });

  try {
    const document = connection.document;
    if (!document) throw new Error("Direct connection has no document");

    // The origin tag here is what makes the resulting update recognizable
    // (e.g. for future UI attribution like "Alice restored version X").
    applyRestoreTransaction(document, targetContentJson, { type: "restore", ...restoredBy });

    const stateSnapshot = Buffer.from(encodeStateAsUpdate(document));
    return { contentJson: targetContentJson, stateSnapshot };
  } finally {
    await connection.disconnect({ unloadImmediately: false });
  }
}
