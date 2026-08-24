import { NextResponse } from "next/server";
import { createVersion, listVersions } from "@local-first-docs/db";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { errorResponse } from "@/lib/api-errors";
import { requestSnapshot } from "@/lib/sync-server-client";

export async function GET(_request: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { documentId } = await params;
  try {
    await requireRole(documentId, session.user.id, "viewer");
    const versions = await listVersions(db, documentId);
    return NextResponse.json({ versions });
  } catch (error) {
    return errorResponse(error);
  }
}

// Captures a named snapshot of the document's CURRENT live state (via the
// sync-server's in-memory Y.Doc, not the last debounced Postgres write) so
// version history is never stale relative to what collaborators see.
export async function POST(request: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { documentId } = await params;
  const body = await request.json().catch(() => ({}));
  const label = typeof body?.label === "string" && body.label.trim().length > 0 ? body.label.trim() : undefined;

  try {
    await requireRole(documentId, session.user.id, "editor");
    const snapshot = await requestSnapshot(documentId);
    const version = await createVersion(db, {
      documentId,
      createdBy: session.user.id,
      label,
      contentJson: snapshot.contentJson,
      stateSnapshot: Buffer.from(snapshot.stateSnapshot, "base64"),
    });
    return NextResponse.json({ version }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
