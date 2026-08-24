interface PMNode {
  type?: string;
  text?: string;
  content?: PMNode[];
}

// Flattens ProseMirror JSON to plain text for feeding to an LLM prompt — we
// don't need the full document structure, just readable content to diff.
export function prosemirrorJsonToText(node: unknown, depth = 0): string {
  if (!node || typeof node !== "object") return "";
  const n = node as PMNode;
  const lines: string[] = [];

  if (typeof n.text === "string") {
    lines.push(n.text);
  }

  for (const child of n.content ?? []) {
    lines.push(prosemirrorJsonToText(child, depth + 1));
  }

  const isBlock = n.type && n.type !== "text";
  const joined = lines.filter(Boolean).join(n.type === "paragraph" ? " " : "\n");
  return isBlock ? `${joined}\n` : joined;
}
