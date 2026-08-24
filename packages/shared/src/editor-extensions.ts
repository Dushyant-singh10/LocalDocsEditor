import StarterKit from "@tiptap/starter-kit";
import { TextAlign } from "@tiptap/extension-text-align";
import { TextStyleKit } from "@tiptap/extension-text-style";
import { Highlight } from "@tiptap/extension-highlight";

// The single source of truth for which node/mark types make up a document,
// shared between the client editor (apps/web/editor-client.tsx, which adds
// Collaboration + CollaborationCaret on top) and the server's ProseMirror
// schema (apps/sync-server/editor-schema.ts, used to capture/restore
// versions). These MUST stay in sync — if the server's schema doesn't know
// about a mark the client can produce, capturing or restoring a version
// silently drops that formatting instead of round-tripping it.
//
// Note: StarterKit already bundles Link and Underline (configurable via its
// own `link`/`underline` options) — importing those extensions separately
// produces a "duplicate extension" warning, so they're configured here
// instead of added again.
export function getEditorExtensions() {
  return [
    StarterKit.configure({ undoRedo: false, link: { openOnClick: false } }),
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    TextStyleKit.configure({ fontFamily: false, lineHeight: false, backgroundColor: false }),
    Highlight.configure({ multicolor: true }),
  ];
}
