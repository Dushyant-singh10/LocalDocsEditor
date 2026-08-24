import { NextResponse } from "next/server";
import { updateDocument } from "@local-first-docs/db";
import { updateDocumentSchema } from "@local-first-docs/shared";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { errorResponse } from "@/lib/api-errors";

export async function GET(_request: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { documentId } = await params;
  try {
    const doc = await requireRole(documentId, session.user.id, "viewer");
    return NextResponse.json({ document: doc });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { documentId } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = updateDocumentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const minimumRole = parsed.data.isArchived !== undefined ? "owner" : "editor";
    await requireRole(documentId, session.user.id, minimumRole);
    const document = await updateDocument(db, documentId, parsed.data);
    return NextResponse.json({ document });
  } catch (error) {
    return errorResponse(error);
  }
}
