import { z } from "zod";
import { ROLES } from "./types.js";

// Applied to Next.js API route bodies before anything touches the database.
// Kept deliberately strict (max lengths, enum-only roles) so a malformed or
// oversized REST payload is rejected before it can reach the ORM layer.

export const createDocumentSchema = z.object({
  title: z.string().trim().min(1).max(300).default("Untitled document"),
});

export const updateDocumentSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  isArchived: z.boolean().optional(),
});

export const invitableRole = z.enum(["editor", "viewer"]);

export const inviteCollaboratorSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  role: invitableRole,
});

export const updateCollaboratorRoleSchema = z.object({
  role: invitableRole,
});

export const createVersionSchema = z.object({
  label: z.string().trim().min(1).max(200).optional(),
  contentJson: z.record(z.string(), z.unknown()),
});

export const restoreVersionSchema = z.object({
  versionId: z.string().uuid(),
});

export const summarizeDiffSchema = z.object({
  documentId: z.string().uuid(),
  versionId: z.string().uuid(),
});

// Hard ceiling on a single incoming Yjs binary update from a client, applied
// in the sync server BEFORE Y.applyUpdate is ever called. A legitimate
// keystroke-level edit is a few hundred bytes at most; only the server's own
// compacted full-state loads should ever be large, and those never arrive as
// untrusted client messages.
export const MAX_CLIENT_UPDATE_BYTES = 1 * 1024 * 1024; // 1 MB

// Hard ceiling on total compacted document state before it's persisted.
// Crossing this doesn't reject the write outright (that would destroy user
// data) but is logged/flagged as a signal that GC/compaction is needed.
export const MAX_DOCUMENT_STATE_BYTES = 20 * 1024 * 1024; // 20 MB

// WebSocket transport-level frame cap (ws `maxPayload`). Anything above this
// is dropped by the socket layer before a single byte reaches Yjs decoding.
export const MAX_WS_FRAME_BYTES = 5 * 1024 * 1024; // 5 MB

export { ROLES };
