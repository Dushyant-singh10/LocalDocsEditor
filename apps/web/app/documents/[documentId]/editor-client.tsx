"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import { HocuspocusProvider, type WebSocketStatus } from "@hocuspocus/provider";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { Collaboration } from "@tiptap/extension-collaboration";
import { CollaborationCaret } from "@tiptap/extension-collaboration-caret";
import { toast } from "sonner";
import { getEditorExtensions, type Role } from "@local-first-docs/shared";
import { Input } from "@/components/ui/input";
import { ConnectionStatus, type ConnectionState } from "@/components/editor/connection-status";
import { CollaboratorAvatars } from "@/components/editor/collaborator-avatars";
import { EditorToolbar } from "@/components/editor/toolbar";
import { ShareDialog } from "@/components/documents/share-dialog";
import { VersionTimeline } from "@/components/versions/version-timeline";
import { useRouter } from "next/navigation";

const YJS_FIELD_NAME = "default";
const SYNC_SERVER_URL = process.env.NEXT_PUBLIC_SYNC_SERVER_URL ?? "ws://localhost:1234";

interface EditorUser {
  id: string;
  name: string;
  color: string;
}

export function EditorClient({
  documentId,
  initialTitle,
  role,
  user,
}: {
  documentId: string;
  initialTitle: string;
  role: Role;
  user: EditorUser;
}) {
  const router = useRouter();
  const editable = role !== "viewer";
  const isOwner = role === "owner";

  // documentId isn't referenced in the body, but it's a deliberate memo key:
  // navigating to a different document must produce a fresh Y.Doc.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ydoc = useMemo(() => new Y.Doc(), [documentId]);
  const [indexeddbSynced, setIndexeddbSynced] = useState(false);
  const [wsStatus, setWsStatus] = useState<WebSocketStatus>("connecting" as WebSocketStatus);
  const [remoteSynced, setRemoteSynced] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const titleSaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [provider, setProvider] = useState<HocuspocusProvider | null>(null);

  useEffect(() => {
    const persistence = new IndexeddbPersistence(documentId, ydoc);
    persistence.on("synced", () => setIndexeddbSynced(true));
    return () => {
      persistence.destroy();
    };
  }, [documentId, ydoc]);

  useEffect(() => {
    // Constructed inside an effect (not useMemo/useState-initializer) on
    // purpose: HocuspocusProvider's constructor can synchronously invoke
    // onStatus with the initial "connecting" state, and calling setState
    // during render (which useMemo runs as part of) trips React's "can't
    // update a component that hasn't mounted yet" error. Effects run after
    // mount, so it's safe here.
    const p = new HocuspocusProvider({
      url: SYNC_SERVER_URL,
      name: documentId,
      document: ydoc,
      token: async () => {
        const res = await fetch(`/api/documents/${documentId}/realtime-token`, { method: "POST" });
        if (!res.ok) throw new Error("Could not obtain realtime token");
        const { token } = await res.json();
        return token as string;
      },
      onStatus: ({ status }) => setWsStatus(status),
      onSynced: ({ state }) => setRemoteSynced(state),
      onAuthenticationFailed: ({ reason }) => {
        toast.error(`Realtime connection rejected: ${reason}`);
      },
    });

    // Test-only escape hatch for e2e/viewer-cannot-write.spec.ts: it needs a
    // way to attempt a raw Yjs write bypassing the editor UI entirely, to
    // prove the server rejects it (not just that the toolbar is hidden).
    // Never exposed unless explicitly opted into.
    if (process.env.NEXT_PUBLIC_E2E === "1") {
      (window as unknown as Record<string, unknown>).__hocuspocusProvider = p;
      (window as unknown as Record<string, unknown>).Y = Y;
    }

    // Deferred a tick so this isn't a direct synchronous setState call in
    // the effect body (same reasoning as constructing the provider itself
    // in an effect rather than useMemo — see the comment above).
    queueMicrotask(() => setProvider(p));

    return () => {
      p.destroy();
      setProvider(null);
    };
  }, [documentId, ydoc]);

  const editor = useEditor(
    {
      immediatelyRender: false,
      editable,
      extensions: [
        ...getEditorExtensions(),
        // Only needs the Y.Doc (available immediately), not the network
        // provider — local-first editing works before/without a connection.
        Collaboration.configure({ document: ydoc, field: YJS_FIELD_NAME }),
        // CollaborationCaret needs a live provider for cursor awareness, so
        // it's added only once one exists (a beat after mount).
        ...(provider ? [CollaborationCaret.configure({ provider, user: { name: user.name, color: user.color } })] : []),
      ],
    },
    [editable, provider],
  );

  const awareUsers = useEditorState({
    editor,
    selector: (ctx) => ctx.editor?.storage.collaborationCaret?.users ?? [],
  });

  function connectionState(): ConnectionState {
    if (!indexeddbSynced) return "connecting";
    if (wsStatus === "disconnected") return "disconnected";
    if (wsStatus === "connecting") return indexeddbSynced ? "offline-only" : "connecting";
    return remoteSynced ? "synced" : "syncing";
  }

  function onTitleChange(value: string) {
    setTitle(value);
    if (titleSaveTimeout.current) clearTimeout(titleSaveTimeout.current);
    titleSaveTimeout.current = setTimeout(async () => {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: value }),
      });
      if (!res.ok) toast.error("Could not save title");
    }, 500);
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <header className="border-b px-4 py-2 flex items-center gap-3">
        <button
          onClick={() => router.push("/dashboard")}
          className="text-sm text-muted-foreground hover:text-foreground shrink-0"
        >
          ← Docs
        </button>
        <Input
          value={title}
          disabled={!editable}
          onChange={(e) => onTitleChange(e.target.value)}
          className="min-w-0 flex-1 max-w-sm border-none shadow-none text-base font-medium focus-visible:ring-1"
        />
        <div className="flex items-center gap-3 shrink-0">
          <ConnectionStatus state={connectionState()} />
          <CollaboratorAvatars users={awareUsers ?? []} />
          <VersionTimeline documentId={documentId} role={role} />
          <ShareDialog documentId={documentId} isOwner={isOwner} />
        </div>
      </header>

      {editable && <EditorToolbar editor={editor} />}

      <div className="flex-1 min-h-0 overflow-y-auto">
        <EditorContent editor={editor} className="max-w-3xl mx-auto px-8 py-10" />
      </div>
    </div>
  );
}
