import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getTestDb, hasTestDb, resetTestDb } from "../test-utils.js";
import { users } from "../schema.js";
import {
  createDocument,
  getCollaboratorRole,
  getDocumentWithRole,
  inviteCollaborator,
  listCollaborators,
  listDocumentsForUser,
  listPendingInvites,
  materializePendingInvites,
  removeCollaborator,
  updateCollaboratorRole,
  updateDocument,
} from "./documents.js";

// Skipped entirely (not failed) when TEST_DATABASE_URL isn't set — see
// README for how to point it at a disposable test database.
describe.skipIf(!hasTestDb)("documents queries", () => {
  let db: ReturnType<typeof getTestDb>;

  async function createUser(email: string, name = email) {
    const id = randomUUID();
    await db.insert(users).values({ id, email, name });
    return id;
  }

  beforeAll(() => {
    db = getTestDb();
  });

  beforeEach(async () => {
    await resetTestDb(db);
  });

  afterAll(async () => {
    await resetTestDb(db);
  });

  describe("createDocument", () => {
    it("creates the document and makes the creator its owner", async () => {
      const userId = await createUser("owner@example.com");

      const doc = await createDocument(db, userId, "My First Doc");

      expect(doc.title).toBe("My First Doc");
      expect(doc.ownerId).toBe(userId);

      const role = await getCollaboratorRole(db, doc.id, userId);
      expect(role).toBe("owner");
    });
  });

  describe("listDocumentsForUser / getDocumentWithRole", () => {
    it("only returns documents the user actually collaborates on", async () => {
      const alice = await createUser("alice@example.com");
      const bob = await createUser("bob@example.com");
      const doc = await createDocument(db, alice, "Alice's doc");

      const aliceDocs = await listDocumentsForUser(db, alice);
      const bobDocs = await listDocumentsForUser(db, bob);

      expect(aliceDocs).toHaveLength(1);
      expect(aliceDocs[0].id).toBe(doc.id);
      expect(bobDocs).toHaveLength(0);
    });

    it("returns null for a document the caller has no access to", async () => {
      const alice = await createUser("alice2@example.com");
      const bob = await createUser("bob2@example.com");
      const doc = await createDocument(db, alice, "Private doc");

      expect(await getDocumentWithRole(db, doc.id, alice)).not.toBeNull();
      expect(await getDocumentWithRole(db, doc.id, bob)).toBeNull();
    });
  });

  describe("updateDocument", () => {
    it("updates the title and archive flag", async () => {
      const userId = await createUser("owner2@example.com");
      const doc = await createDocument(db, userId, "Untitled");

      const updated = await updateDocument(db, doc.id, { title: "Renamed", isArchived: true });

      expect(updated?.title).toBe("Renamed");
      expect(updated?.isArchived).toBe(true);
    });
  });

  describe("inviteCollaborator", () => {
    it("attaches an existing user directly as a collaborator", async () => {
      const owner = await createUser("owner3@example.com");
      const existing = await createUser("existing@example.com");
      const doc = await createDocument(db, owner, "Shared doc");

      const result = await inviteCollaborator(db, {
        documentId: doc.id,
        email: "existing@example.com",
        role: "editor",
        invitedBy: owner,
      });

      expect(result.kind).toBe("collaborator");
      expect(await getCollaboratorRole(db, doc.id, existing)).toBe("editor");
    });

    it("creates a pending invite when no user with that email exists yet", async () => {
      const owner = await createUser("owner4@example.com");
      const doc = await createDocument(db, owner, "Shared doc 2");

      const result = await inviteCollaborator(db, {
        documentId: doc.id,
        email: "not-signed-up-yet@example.com",
        role: "viewer",
        invitedBy: owner,
      });

      expect(result.kind).toBe("invite");
      const pending = await listPendingInvites(db, doc.id);
      expect(pending).toHaveLength(1);
      expect(pending[0].email).toBe("not-signed-up-yet@example.com");
      expect(pending[0].role).toBe("viewer");
    });
  });

  describe("updateCollaboratorRole / removeCollaborator", () => {
    it("changes a collaborator's role, then removes them", async () => {
      const owner = await createUser("owner5@example.com");
      const member = await createUser("member@example.com");
      const doc = await createDocument(db, owner, "Doc");
      await inviteCollaborator(db, {
        documentId: doc.id,
        email: "member@example.com",
        role: "viewer",
        invitedBy: owner,
      });

      await updateCollaboratorRole(db, doc.id, member, "editor");
      expect(await getCollaboratorRole(db, doc.id, member)).toBe("editor");

      await removeCollaborator(db, doc.id, member);
      expect(await getCollaboratorRole(db, doc.id, member)).toBeNull();
    });
  });

  describe("listCollaborators", () => {
    it("returns every collaborator with their name/email/role", async () => {
      const owner = await createUser("owner6@example.com", "Owner Name");
      const doc = await createDocument(db, owner, "Doc");

      const collaborators = await listCollaborators(db, doc.id);

      expect(collaborators).toHaveLength(1);
      expect(collaborators[0]).toMatchObject({ userId: owner, role: "owner", name: "Owner Name" });
    });
  });

  describe("materializePendingInvites", () => {
    it("converts a pending invite into a real collaborator on matching sign-in", async () => {
      const owner = await createUser("owner7@example.com");
      const doc = await createDocument(db, owner, "Doc");
      await inviteCollaborator(db, {
        documentId: doc.id,
        email: "newcomer@example.com",
        role: "editor",
        invitedBy: owner,
      });

      const newcomerId = await createUser("newcomer@example.com");
      await materializePendingInvites(db, newcomerId, "newcomer@example.com");

      expect(await getCollaboratorRole(db, doc.id, newcomerId)).toBe("editor");
      expect(await listPendingInvites(db, doc.id)).toHaveLength(0);
    });

    it("does nothing when there are no pending invites for that email", async () => {
      const userId = await createUser("nobody-invited@example.com");
      await expect(materializePendingInvites(db, userId, "nobody-invited@example.com")).resolves.not.toThrow();
    });
  });
});
