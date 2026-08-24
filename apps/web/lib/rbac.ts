import { getDocumentWithRole } from "@local-first-docs/db";
import { roleAtLeast, type Role } from "@local-first-docs/shared";
import { db } from "./db";

export class ForbiddenError extends Error {}
export class NotFoundError extends Error {}

// Every mutating/reading API route for a document calls this before doing
// anything else. It re-derives the caller's role from document_collaborators
// on every request rather than trusting anything client-supplied — this is
// the "strict ORM scoping" line of defense described in the plan.
export async function requireRole(documentId: string, userId: string, minimum: Role) {
  const doc = await getDocumentWithRole(db, documentId, userId);
  if (!doc) {
    throw new NotFoundError("Document not found or you do not have access to it");
  }
  if (!roleAtLeast(doc.role, minimum)) {
    throw new ForbiddenError(`Requires ${minimum} role, caller has ${doc.role}`);
  }
  return doc;
}
