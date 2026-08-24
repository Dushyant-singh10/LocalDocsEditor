import { NextResponse } from "next/server";
import { signRealtimeToken } from "@local-first-docs/shared";
import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import { errorResponse } from "@/lib/api-errors";

// Mints a short-lived (60s), signed token the client hands to the Hocuspocus
// provider. Kept deliberately separate from the NextAuth session token,
// which in v5 is an encrypted JWE and not something the standalone
// sync-server process can verify without duplicating NextAuth's internals.
export async function POST(_request: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { documentId } = await params;
  try {
    const doc = await requireRole(documentId, session.user.id, "viewer");
    const token = await signRealtimeToken({ userId: session.user.id, documentId, role: doc.role });
    return NextResponse.json({ token });
  } catch (error) {
    return errorResponse(error);
  }
}
