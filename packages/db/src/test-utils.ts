import { sql } from "drizzle-orm";
import { createDb } from "./client.js";

// Integration tests run against a REAL Postgres database (a separate one
// from your dev DB — see README for how to create TEST_DATABASE_URL), never
// a mock. Drizzle's query builder produces real SQL; the only way to
// actually verify it is correct is to run it against a real database.
//
// TEST_DATABASE_URL is intentionally optional: without it, every describe
// block using `describe.skipIf(!hasTestDb)` below is skipped cleanly rather
// than crashing `pnpm -r test` for anyone (or CI) who hasn't set up a local
// test database.
export const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);

export function getTestDb() {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) {
    throw new Error("TEST_DATABASE_URL is not set — guard call sites with `describe.skipIf(!hasTestDb)`.");
  }
  return createDb(connectionString);
}

// Truncates every application + auth table so each test starts from a clean
// slate. CASCADE handles FK dependency order; RESTART IDENTITY resets any
// serial sequences (not used here, but harmless to include).
export async function resetTestDb(db: ReturnType<typeof getTestDb>) {
  await db.execute(sql`
    TRUNCATE TABLE
      "ai_summary",
      "document_version",
      "document_state",
      "document_invite",
      "document_collaborator",
      "document",
      "session",
      "account",
      "verificationToken",
      "user"
    RESTART IDENTITY CASCADE
  `);
}
