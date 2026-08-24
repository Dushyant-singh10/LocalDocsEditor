import type { beforeSyncPayload } from "@hocuspocus/server";
import type { SyncContext } from "../context.js";

// y-protocols/sync message sub-types: 0 = SyncStep1 (read-only — the peer is
// just asking "what do you have"), 1 = SyncStep2, 2 = Update. Both 1 and 2
// call Y.applyUpdate under the hood (see y-protocols/sync.js: readSyncStep2
// IS readUpdate), so a Viewer must be blocked from both, not just type 2 —
// blocking only type 2 would still let a malicious client sneak a write in
// via a crafted SyncStep2 reply.
const WRITE_MESSAGE_TYPES = new Set([1, 2]);

export async function onBeforeSync(data: beforeSyncPayload<SyncContext>): Promise<void> {
  if (data.context.role === "viewer" && WRITE_MESSAGE_TYPES.has(data.type)) {
    throw new Error("Viewers cannot push document updates");
  }
}
