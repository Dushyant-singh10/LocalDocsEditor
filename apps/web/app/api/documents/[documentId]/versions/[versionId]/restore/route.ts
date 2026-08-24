import { NextResponse } from "next/server";
import { createVersion, getVersion } from "@local-first-docs/db";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { errorResponse } from "@/lib/api-errors";
import { requestRestore } from "@/lib/sync-server-client";

// See plan's "restore-without-clobbering" algorithm: this never overwrites
// the live document directly. It asks the sync-server to apply the target
// version's content as a minimal-diff Yjs transaction against the live,
// in-memory document (via @tiptap/y-tiptap's prosemirrorJSONToYXmlFragment),
// so concurrent collaborators' edits merge through the normal CRDT path
// instead of being clobbered. The restore itself is then recorded as a new,
// visible version — restoring never deletes history either.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ documentId: string; versionId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { documentId, versionId } = await params;

  try {
    await requireRole(documentId, session.user.id, "editor");

    const target = await getVersion(db, versionId);
    if (!target || target.documentId !== documentId) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const restored = await requestRestore(documentId, {
      contentJson: target.contentJson,
      userId: session.user.id,
      versionId: target.id,
    });

    const newVersion = await createVersion(db, {
      documentId,
      createdBy: session.user.id,
      label: `Restored from "${target.label ?? "untitled version"}"`,
      contentJson: restored.contentJson,
      stateSnapshot: Buffer.from(restored.stateSnapshot, "base64"),
      restoredFromVersionId: target.id,
    });

    return NextResponse.json({ version: newVersion });
  } catch (error) {
    return errorResponse(error);
  }
}
