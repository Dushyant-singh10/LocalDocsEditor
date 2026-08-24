import { describe, expect, it } from "vitest";
import { prosemirrorJsonToText } from "./prosemirror-text";

describe("prosemirrorJsonToText", () => {
  it("flattens a simple paragraph to plain text", () => {
    const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Hello world" }] }] };
    expect(prosemirrorJsonToText(doc).trim()).toBe("Hello world");
  });

  it("joins multiple paragraphs on separate lines", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "First" }] },
        { type: "paragraph", content: [{ type: "text", text: "Second" }] },
      ],
    };
    const text = prosemirrorJsonToText(doc);
    expect(text).toContain("First");
    expect(text).toContain("Second");
    expect(text.indexOf("First")).toBeLessThan(text.indexOf("Second"));
  });

  it("returns an empty string for a document with no content", () => {
    expect(prosemirrorJsonToText({ type: "doc", content: [] }).trim()).toBe("");
  });

  it("handles null/undefined input without throwing", () => {
    expect(prosemirrorJsonToText(null)).toBe("");
    expect(prosemirrorJsonToText(undefined)).toBe("");
  });
});
