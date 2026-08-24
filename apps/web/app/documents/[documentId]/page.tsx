import { notFound, redirect } from "next/navigation";
import { getDocumentWithRole } from "@local-first-docs/db";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { EditorClient } from "./editor-client";

export default async function DocumentPage({ params }: { params: Promise<{ documentId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }

  const { documentId } = await params;
  const doc = await getDocumentWithRole(db, documentId, session.user.id);
  if (!doc) {
    notFound();
  }

  return (
    <main className="flex-1 flex flex-col min-h-0">
      <EditorClient
        documentId={documentId}
        initialTitle={doc.title}
        role={doc.role}
        user={{
          id: session.user.id,
          name: session.user.name ?? session.user.email ?? "Anonymous",
          color: colorForUser(session.user.id),
        }}
      />
    </main>
  );
}

function colorForUser(userId: string): string {
  const palette = ["#f97316", "#3b82f6", "#22c55e", "#a855f7", "#ec4899", "#14b8a6", "#eab308"];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
}
