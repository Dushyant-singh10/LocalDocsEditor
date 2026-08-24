import { and, desc, eq } from "drizzle-orm";
import type { Database } from "../client.js";
import {
  documentCollaborators,
  documentInvites,
  documents,
  users,
  type RoleEnum,
} from "../schema.js";

// Every query here takes an explicit userId and joins through
// document_collaborators — this is the "strict ORM scoping" line of
// defense: a user can never read or touch a document they aren't a
// collaborator on, regardless of what documentId they pass in.

export async function listDocumentsForUser(db: Database, userId: string) {
  const rows = await db
    .select({
      id: documents.id,
      title: documents.title,
      ownerId: documents.ownerId,
      createdAt: documents.createdAt,
      updatedAt: documents.updatedAt,
      isArchived: documents.isArchived,
      role: documentCollaborators.role,
    })
    .from(documentCollaborators)
    .innerJoin(documents, eq(documents.id, documentCollaborators.documentId))
    .where(eq(documentCollaborators.userId, userId))
    .orderBy(desc(documents.updatedAt));

  return rows;
}

export async function getDocumentWithRole(db: Database, documentId: string, userId: string) {
  const [row] = await db
    .select({
      id: documents.id,
      title: documents.title,
      ownerId: documents.ownerId,
      createdAt: documents.createdAt,
      updatedAt: documents.updatedAt,
      isArchived: documents.isArchived,
      role: documentCollaborators.role,
    })
    .from(documentCollaborators)
    .innerJoin(documents, eq(documents.id, documentCollaborators.documentId))
    .where(and(eq(documentCollaborators.documentId, documentId), eq(documentCollaborators.userId, userId)))
    .limit(1);

  return row ?? null;
}

export async function createDocument(db: Database, userId: string, title: string) {
  return db.transaction(async (tx) => {
    const [doc] = await tx.insert(documents).values({ ownerId: userId, title }).returning();
    await tx.insert(documentCollaborators).values({
      documentId: doc.id,
      userId,
      role: "owner",
    });
    return doc;
  });
}

export async function updateDocument(
  db: Database,
  documentId: string,
  patch: { title?: string; isArchived?: boolean },
) {
  const [doc] = await db
    .update(documents)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(documents.id, documentId))
    .returning();
  return doc ?? null;
}

export async function touchDocumentUpdatedAt(db: Database, documentId: string) {
  await db.update(documents).set({ updatedAt: new Date() }).where(eq(documents.id, documentId));
}

export async function listCollaborators(db: Database, documentId: string) {
  return db
    .select({
      id: documentCollaborators.id,
      userId: documentCollaborators.userId,
      role: documentCollaborators.role,
      name: users.name,
      email: users.email,
      image: users.image,
    })
    .from(documentCollaborators)
    .innerJoin(users, eq(users.id, documentCollaborators.userId))
    .where(eq(documentCollaborators.documentId, documentId));
}

export async function listPendingInvites(db: Database, documentId: string) {
  return db
    .select({ id: documentInvites.id, email: documentInvites.email, role: documentInvites.role })
    .from(documentInvites)
    .where(eq(documentInvites.documentId, documentId));
}

export async function getCollaboratorRole(
  db: Database,
  documentId: string,
  userId: string,
): Promise<RoleEnum | null> {
  const [row] = await db
    .select({ role: documentCollaborators.role })
    .from(documentCollaborators)
    .where(and(eq(documentCollaborators.documentId, documentId), eq(documentCollaborators.userId, userId)))
    .limit(1);
  return row?.role ?? null;
}

// Invites either an existing user directly (document_collaborators row) or,
// if no account with that email exists yet, records a pending invite that
// gets materialized on that user's first sign-in (see materializePendingInvites).
export async function inviteCollaborator(
  db: Database,
  params: { documentId: string; email: string; role: Extract<RoleEnum, "editor" | "viewer">; invitedBy: string },
) {
  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, params.email))
    .limit(1);

  if (existingUser) {
    const [row] = await db
      .insert(documentCollaborators)
      .values({
        documentId: params.documentId,
        userId: existingUser.id,
        role: params.role,
        invitedBy: params.invitedBy,
      })
      .onConflictDoUpdate({
        target: [documentCollaborators.documentId, documentCollaborators.userId],
        set: { role: params.role },
      })
      .returning();
    return { kind: "collaborator" as const, row };
  }

  const [row] = await db
    .insert(documentInvites)
    .values({
      documentId: params.documentId,
      email: params.email,
      role: params.role,
      invitedBy: params.invitedBy,
    })
    .onConflictDoUpdate({
      target: [documentInvites.documentId, documentInvites.email],
      set: { role: params.role },
    })
    .returning();
  return { kind: "invite" as const, row };
}

export async function updateCollaboratorRole(
  db: Database,
  documentId: string,
  userId: string,
  role: Extract<RoleEnum, "editor" | "viewer">,
) {
  const [row] = await db
    .update(documentCollaborators)
    .set({ role })
    .where(and(eq(documentCollaborators.documentId, documentId), eq(documentCollaborators.userId, userId)))
    .returning();
  return row ?? null;
}

export async function removeCollaborator(db: Database, documentId: string, userId: string) {
  await db
    .delete(documentCollaborators)
    .where(and(eq(documentCollaborators.documentId, documentId), eq(documentCollaborators.userId, userId)));
}

// Called from the Auth.js signIn callback for every sign-in: turns any
// pending email-based invites for this user's verified email into real
// document_collaborators rows.
export async function materializePendingInvites(db: Database, userId: string, email: string) {
  await db.transaction(async (tx) => {
    const pending = await tx
      .select()
      .from(documentInvites)
      .where(eq(documentInvites.email, email));

    for (const invite of pending) {
      await tx
        .insert(documentCollaborators)
        .values({
          documentId: invite.documentId,
          userId,
          role: invite.role,
          invitedBy: invite.invitedBy,
        })
        .onConflictDoNothing();
    }

    if (pending.length > 0) {
      await tx.delete(documentInvites).where(eq(documentInvites.email, email));
    }
  });
}
