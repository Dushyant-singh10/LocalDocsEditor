import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { prosemirrorJSONToYXmlFragment, yXmlFragmentToProseMirrorRootNode } from "@tiptap/y-tiptap";
import { editorSchema, YJS_FIELD_NAME } from "./editor-schema.js";
import { applyRestoreTransaction } from "./snapshot.js";

function docJson(text: string) {
  return { type: "doc", content: [{ type: "paragraph", content: text ? [{ type: "text", text }] : [] }] };
}

function textOf(doc: Y.Doc): string {
  return yXmlFragmentToProseMirrorRootNode(doc.getXmlFragment(YJS_FIELD_NAME), editorSchema).textContent;
}

function setParagraphText(doc: Y.Doc, text: string) {
  prosemirrorJSONToYXmlFragment(editorSchema, docJson(text), doc.getXmlFragment(YJS_FIELD_NAME));
}

describe("applyRestoreTransaction (restore-without-clobbering)", () => {
  it("preserves a concurrent collaborator's pending edit instead of clobbering it", () => {
    // "Server" doc, seeded with version-1 content.
    const serverDoc = new Y.Doc();
    setParagraphText(serverDoc, "Hello world");
    const version1Json = yXmlFragmentToProseMirrorRootNode(
      serverDoc.getXmlFragment(YJS_FIELD_NAME),
      editorSchema,
    ).toJSON();

    // A second collaborator's client syncs to the same state...
    const collaboratorDoc = new Y.Doc();
    Y.applyUpdate(collaboratorDoc, Y.encodeStateAsUpdate(serverDoc));

    // ...then someone edits further on the server (simulating time passing).
    setParagraphText(serverDoc, "Hello world, this got much longer");

    // Meanwhile the collaborator is offline/mid-keystroke and makes their own
    // edit, not yet synced back to the server.
    const collaboratorFragment = collaboratorDoc.getXmlFragment(YJS_FIELD_NAME);
    const paragraph = collaboratorFragment.get(0) as unknown as Y.XmlElement;
    collaboratorDoc.transact(() => {
      const firstText = paragraph.get(0) as unknown as Y.XmlText;
      firstText.insert(firstText.length, " (collaborator's pending edit)");
    });

    // Now an owner restores the server doc back to version 1 — this must NOT
    // be done via Y.applyUpdate(serverDoc, oldSnapshot); it must go through
    // applyRestoreTransaction so it's expressed as a real edit.
    applyRestoreTransaction(serverDoc, version1Json);
    expect(textOf(serverDoc)).toBe("Hello world");

    // The collaborator's pending update finally reaches the server (e.g. on
    // reconnect) and is applied like any other incoming Yjs update.
    Y.applyUpdate(serverDoc, Y.encodeStateAsUpdate(collaboratorDoc));

    // The collaborator's text must have survived the restore — this is the
    // hard "no data loss" requirement. It doesn't have to be pretty (it may
    // be positioned oddly relative to now-tombstoned content), it just must
    // not have been deleted.
    expect(textOf(serverDoc)).toContain("collaborator's pending edit");
  });

  it("re-applying an old encoded state instead (the anti-pattern) would duplicate content", () => {
    const doc = new Y.Doc();
    setParagraphText(doc, "Hello world");
    const oldState = Y.encodeStateAsUpdate(doc);

    setParagraphText(doc, "Hello world and more");

    // The anti-pattern documented in the plan: naively re-applying the old
    // full-state update onto the live doc.
    Y.applyUpdate(doc, oldState);

    // This does NOT revert to "Hello world" — it duplicates/interleaves
    // content instead, which is exactly why applyRestoreTransaction (a real
    // diffing edit) is used instead of this shortcut.
    expect(textOf(doc)).not.toBe("Hello world");
  });
});
