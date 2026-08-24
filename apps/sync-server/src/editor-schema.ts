import { getSchema } from "@tiptap/core";
import { getEditorExtensions } from "@local-first-docs/shared";

// Built from the same extension list apps/web's editor-client.tsx uses
// (packages/shared/src/editor-extensions.ts) — this schema is only used to
// parse/render ProseMirror JSON on the server (snapshot capture + restore),
// never to author content directly, but it must recognize every mark/node
// the client can produce or formatting silently drops on restore.
export const editorSchema = getSchema(getEditorExtensions());

export const YJS_FIELD_NAME = "default";
