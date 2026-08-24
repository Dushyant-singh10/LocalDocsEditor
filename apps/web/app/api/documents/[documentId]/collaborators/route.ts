import { NextResponse } from "next/server";
import { inviteCollaborator, listCollaborators, listPendingInvites } from "@local-first-docs/db";
import { inviteCollaboratorSchema } from "@local-first-docs/shared";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { errorResponse } from "@/lib/api-errors";
import { sendInviteEmail } from "@/lib/email";

export async function GET(_request: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { documentId } = await params;
  try {
    await requireRole(documentId, session.user.id, "viewer");
    const [collaborators, pendingInvites] = await Promise.all([
      listCollaborators(db, documentId),
      listPendingInvites(db, documentId),
    ]);
    return NextResponse.json({ collaborators, pendingInvites });
  } catch (error) {
    return errorResponse(error);
  }
}

// Google-Docs-style "Share" flow: only Owners can grant access. Invites an
// existing user directly, or records a pending invite (by email) that gets
// materialized the moment that person first signs in — see
// materializePendingInvites in lib/auth.ts's signIn event.
export async function POST(request: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { documentId } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = inviteCollaboratorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const doc = await requireRole(documentId, session.user.id, "owner");
    const result = await inviteCollaborator(db, {
      documentId,
      email: parsed.data.email,
      role: parsed.data.role,
      invitedBy: session.user.id,
    });

    const documentUrl = new URL(`/documents/${documentId}`, request.url).toString();
    await sendInviteEmail({
      to: parsed.data.email,
      documentTitle: doc.title,
      inviterName: session.user.name ?? session.user.email ?? "Someone",
      role: parsed.data.role,
      documentUrl,
    });

    return NextResponse.json({ result }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
