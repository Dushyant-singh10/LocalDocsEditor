import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "@auth/core/adapters";

// Raw binary column for Yjs update blobs (drizzle-orm has no bytea helper).
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

// --- Auth.js tables (shape required by @auth/drizzle-adapter's DrizzleAdapter) ---

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ],
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })],
);

// --- Application tables ---

export const documents = pgTable("document", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull().default("Untitled document"),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  isArchived: boolean("is_archived").notNull().default(false),
});

export const roleEnumValues = ["owner", "editor", "viewer"] as const;
export type RoleEnum = (typeof roleEnumValues)[number];

export const documentCollaborators = pgTable(
  "document_collaborator",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").$type<RoleEnum>().notNull(),
    invitedBy: text("invited_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("document_collaborator_document_user_unique").on(t.documentId, t.userId),
    index("document_collaborator_user_idx").on(t.userId),
    check("document_collaborator_role_check", sql`${t.role} in ('owner', 'editor', 'viewer')`),
  ],
);

// Pending invite for a collaborator who hasn't signed in yet. Materialized
// into document_collaborators on first Auth.js sign-in with a matching email.
export const documentInvites = pgTable(
  "document_invite",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role").$type<Extract<RoleEnum, "editor" | "viewer">>().notNull(),
    invitedBy: text("invited_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("document_invite_document_email_unique").on(t.documentId, t.email),
    index("document_invite_email_idx").on(t.email),
    check("document_invite_role_check", sql`${t.role} in ('editor', 'viewer')`),
  ],
);

// Compacted live CRDT state — what the Hocuspocus sync server loads/stores.
export const documentState = pgTable("document_state", {
  documentId: uuid("document_id")
    .primaryKey()
    .references(() => documents.id, { onDelete: "cascade" }),
  state: bytea("state").notNull(),
  stateVector: bytea("state_vector"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Named time-travel snapshots.
export const documentVersions = pgTable(
  "document_version",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    label: text("label"),
    contentJson: jsonb("content_json").notNull(),
    stateSnapshot: bytea("state_snapshot").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    restoredFromVersionId: uuid("restored_from_version_id"),
  },
  (t) => [index("document_version_document_idx").on(t.documentId, t.createdAt)],
);

export const aiSummaries = pgTable("ai_summary", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  versionId: uuid("version_id").references(() => documentVersions.id, { onDelete: "cascade" }),
  summary: text("summary").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// --- Relations (for query ergonomics, not required by the adapter) ---

export const documentsRelations = relations(documents, ({ many, one }) => ({
  collaborators: many(documentCollaborators),
  versions: many(documentVersions),
  owner: one(users, { fields: [documents.ownerId], references: [users.id] }),
}));

export const documentCollaboratorsRelations = relations(documentCollaborators, ({ one }) => ({
  document: one(documents, { fields: [documentCollaborators.documentId], references: [documents.id] }),
  user: one(users, { fields: [documentCollaborators.userId], references: [users.id] }),
}));

export const documentVersionsRelations = relations(documentVersions, ({ one }) => ({
  document: one(documents, { fields: [documentVersions.documentId], references: [documents.id] }),
  author: one(users, { fields: [documentVersions.createdBy], references: [users.id] }),
}));
