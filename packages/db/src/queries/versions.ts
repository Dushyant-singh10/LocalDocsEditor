import { desc, eq } from "drizzle-orm";
import type { Database } from "../client.js";
import { documentVersions, users } from "../schema.js";

export async function listVersions(db: Database, documentId: string) {
  return db
    .select({
      id: documentVersions.id,
      documentId: documentVersions.documentId,
      label: documentVersions.label,
      createdBy: documentVersions.createdBy,
      createdByName: users.name,
      createdAt: documentVersions.createdAt,
      restoredFromVersionId: documentVersions.restoredFromVersionId,
    })
    .from(documentVersions)
    .innerJoin(users, eq(users.id, documentVersions.createdBy))
    .where(eq(documentVersions.documentId, documentId))
    .orderBy(desc(documentVersions.createdAt));
}

export async function getVersion(db: Database, versionId: string) {
  const [row] = await db
    .select()
    .from(documentVersions)
    .where(eq(documentVersions.id, versionId))
    .limit(1);
  return row ?? null;
}

export async function createVersion(
  db: Database,
  params: {
    documentId: string;
    createdBy: string;
    label?: string;
    contentJson: unknown;
    stateSnapshot: Buffer;
    restoredFromVersionId?: string;
  },
) {
  const [row] = await db
    .insert(documentVersions)
    .values({
      documentId: params.documentId,
      createdBy: params.createdBy,
      label: params.label ?? null,
      contentJson: params.contentJson,
      stateSnapshot: params.stateSnapshot,
      restoredFromVersionId: params.restoredFromVersionId ?? null,
    })
    .returning();
  return row;
}
