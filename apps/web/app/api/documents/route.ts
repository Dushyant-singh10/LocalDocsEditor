import { NextResponse } from "next/server";
import { createDocument, listDocumentsForUser } from "@local-first-docs/db";
import { createDocumentSchema } from "@local-first-docs/shared";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const documents = await listDocumentsForUser(db, session.user.id);
  return NextResponse.json({ documents });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = createDocumentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", details: parsed.error.flatten() }, { status: 400 });
  }

  const document = await createDocument(db, session.user.id, parsed.data.title);
  return NextResponse.json({ document }, { status: 201 });
}
