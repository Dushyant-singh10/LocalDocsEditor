import type { onAuthenticatePayload } from "@hocuspocus/server";
import { verifyRealtimeToken } from "@local-first-docs/shared";
import type { SyncContext } from "../context.js";

// The short-lived, HS256-signed "realtime token" is minted by a Next.js API
// route after it verifies the caller's real (NextAuth) session and looks up
// their role — see packages/shared/src/realtime-token.ts for why we don't
// try to verify NextAuth's own (encrypted JWE) session token directly here.
export async function onAuthenticate(
  data: onAuthenticatePayload<SyncContext>,
): Promise<SyncContext> {
  const payload = await verifyRealtimeToken(data.token).catch(() => {
    throw new Error("Invalid or expired realtime token");
  });

  if (payload.documentId !== data.documentName) {
    throw new Error("Realtime token was not issued for this document");
  }

  // Advisory only — informs the client provider so it can render a read-only
  // UI. Actual write enforcement happens server-side in beforeSync, since a
  // client-side flag can always be bypassed by a motivated attacker.
  data.connectionConfig.readOnly = payload.role === "viewer";

  return { userId: payload.sub, role: payload.role };
}
