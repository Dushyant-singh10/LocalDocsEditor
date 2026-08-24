import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { materializePendingInvites, accounts, sessions, users, verificationTokens } from "@local-first-docs/db";
import { db } from "./db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [GitHub],
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      if (user.id && user.email) {
        await materializePendingInvites(db, user.id, user.email);
      }
    },
  },
});
