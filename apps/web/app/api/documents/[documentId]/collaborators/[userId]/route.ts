import { NextResponse } from "next/server";
import { getDocumentWithRole, removeCollaborator, updateCollaboratorRole } from "@local-first-docs/db";
import { updateCollaboratorRoleSchema } from "@local-first-docs/shared";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { errorResponse } from "@/lib/api-errors";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ documentId: string; userId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { documentId, userId } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = updateCollaboratorRoleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await requireRole(documentId, session.user.id, "owner");
    const target = await getDocumentWithRole(db, documentId, userId);
    if (target?.role === "owner") {
      return NextResponse.json({ error: "cannot_change_owner_role" }, { status: 400 });
    }
    const collaborator = await updateCollaboratorRole(db, documentId, userId, parsed.data.role);
    return NextResponse.json({ collaborator });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ documentId: string; userId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { documentId, userId } = await params;
  try {
    await requireRole(documentId, session.user.id, "owner");
    const target = await getDocumentWithRole(db, documentId, userId);
    if (target?.role === "owner") {
      return NextResponse.json({ error: "cannot_remove_owner" }, { status: 400 });
    }
    await removeCollaborator(db, documentId, userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
