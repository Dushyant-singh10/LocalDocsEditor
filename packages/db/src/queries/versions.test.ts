import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getTestDb, hasTestDb, resetTestDb } from "../test-utils.js";
import { users } from "../schema.js";
import { createDocument } from "./documents.js";
import { createVersion, getVersion, listVersions } from "./versions.js";

describe.skipIf(!hasTestDb)("versions queries", () => {
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

  describe("createVersion / getVersion", () => {
    it("stores and retrieves a version with its content and snapshot bytes", async () => {
      const userId = await createUser("author@example.com");
      const doc = await createDocument(db, userId, "Doc");

      const version = await createVersion(db, {
        documentId: doc.id,
        createdBy: userId,
        label: "First save",
        contentJson: { type: "doc", content: [] },
        stateSnapshot: Buffer.from([1, 2, 3]),
      });

      const fetched = await getVersion(db, version.id);
      expect(fetched?.label).toBe("First save");
      expect(fetched?.documentId).toBe(doc.id);
      expect(Buffer.from(fetched!.stateSnapshot as Buffer)).toEqual(Buffer.from([1, 2, 3]));
    });

    it("returns null for a version id that doesn't exist", async () => {
      expect(await getVersion(db, "00000000-0000-0000-0000-000000000000")).toBeNull();
    });
  });

  describe("listVersions", () => {
    it("returns versions newest-first with the author's name joined in", async () => {
      const userId = await createUser("author2@example.com", "Author Name");
      const doc = await createDocument(db, userId, "Doc");

      const v1 = await createVersion(db, {
        documentId: doc.id,
        createdBy: userId,
        label: "v1",
        contentJson: {},
        stateSnapshot: Buffer.from([]),
      });
      const v2 = await createVersion(db, {
        documentId: doc.id,
        createdBy: userId,
        label: "v2",
        contentJson: {},
        stateSnapshot: Buffer.from([]),
        restoredFromVersionId: v1.id,
      });

      const versions = await listVersions(db, doc.id);

      expect(versions.map((v) => v.id)).toEqual([v2.id, v1.id]);
      expect(versions[0].createdByName).toBe("Author Name");
      expect(versions[0].restoredFromVersionId).toBe(v1.id);
    });
  });
});
