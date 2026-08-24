"use client";

import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import {
  Bold,
  Italic,
  Strikethrough,
  UnderlineIcon,
  Code,
  List,
  ListOrdered,
  Quote,
  Heading1,
  Heading2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Baseline,
  Highlighter,
  Link2,
  Link2Off,
  Undo2,
  Redo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const TEXT_COLORS = ["#0f172a", "#dc2626", "#ea580c", "#16a34a", "#2563eb", "#7c3aed", "#db2777"];
const HIGHLIGHT_COLORS = ["#fef08a", "#bbf7d0", "#bfdbfe", "#fbcfe8", "#fed7aa"];

export function EditorToolbar({ editor }: { editor: Editor | null }) {
  const state = useEditorState({
    editor,
    selector: (ctx) => {
      const e = ctx.editor;
      if (!e) return null;
      return {
        bold: e.isActive("bold"),
        italic: e.isActive("italic"),
        strike: e.isActive("strike"),
        underline: e.isActive("underline"),
        code: e.isActive("code"),
        h1: e.isActive("heading", { level: 1 }),
        h2: e.isActive("heading", { level: 2 }),
        bulletList: e.isActive("bulletList"),
        orderedList: e.isActive("orderedList"),
        blockquote: e.isActive("blockquote"),
        link: e.isActive("link"),
        align: e.isActive({ textAlign: "center" })
          ? "center"
          : e.isActive({ textAlign: "right" })
            ? "right"
            : e.isActive({ textAlign: "justify" })
              ? "justify"
              : "left",
        canUndo: e.can().undo(),
        canRedo: e.can().redo(),
      };
    },
  });

  if (!editor || !state) return null;

  const marks: Array<{ key: string; icon: typeof Bold; active: boolean; onClick: () => void }> = [
    { key: "bold", icon: Bold, active: state.bold, onClick: () => editor.chain().focus().toggleBold().run() },
    { key: "italic", icon: Italic, active: state.italic, onClick: () => editor.chain().focus().toggleItalic().run() },
    {
      key: "underline",
      icon: UnderlineIcon,
      active: state.underline,
      onClick: () => editor.chain().focus().toggleUnderline().run(),
    },
    { key: "strike", icon: Strikethrough, active: state.strike, onClick: () => editor.chain().focus().toggleStrike().run() },
    { key: "code", icon: Code, active: state.code, onClick: () => editor.chain().focus().toggleCode().run() },
  ];

  const blocks: Array<{ key: string; icon: typeof Bold; active: boolean; onClick: () => void }> = [
    { key: "h1", icon: Heading1, active: state.h1, onClick: () => editor.chain().focus().toggleHeading({ level: 1 }).run() },
    { key: "h2", icon: Heading2, active: state.h2, onClick: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { key: "bulletList", icon: List, active: state.bulletList, onClick: () => editor.chain().focus().toggleBulletList().run() },
    { key: "orderedList", icon: ListOrdered, active: state.orderedList, onClick: () => editor.chain().focus().toggleOrderedList().run() },
    { key: "blockquote", icon: Quote, active: state.blockquote, onClick: () => editor.chain().focus().toggleBlockquote().run() },
  ];

  const alignments: Array<{ key: string; icon: typeof AlignLeft; value: "left" | "center" | "right" | "justify" }> = [
    { key: "left", icon: AlignLeft, value: "left" },
    { key: "center", icon: AlignCenter, value: "center" },
    { key: "right", icon: AlignRight, value: "right" },
    { key: "justify", icon: AlignJustify, value: "justify" },
  ];

  function setLink() {
    const previousUrl = editor?.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL", previousUrl ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor?.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor?.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  return (
    <div className="border-b px-4 py-1.5 flex items-center gap-0.5 overflow-x-auto">
      {marks.map(({ key, icon: Icon, active, onClick }) => (
        <Button key={key} variant="ghost" size="icon" className={cn("size-8", active && "bg-accent text-accent-foreground")} onClick={onClick}>
          <Icon className="size-4" />
        </Button>
      ))}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8">
            <Baseline className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="flex gap-1 p-2 w-auto">
          {TEXT_COLORS.map((color) => (
            <button
              key={color}
              className="size-6 rounded-full border"
              style={{ backgroundColor: color }}
              onClick={() => editor.chain().focus().setColor(color).run()}
              aria-label={`Text color ${color}`}
            />
          ))}
          <button
            className="size-6 rounded-full border flex items-center justify-center text-[10px]"
            onClick={() => editor.chain().focus().unsetColor().run()}
            aria-label="Remove text color"
          >
            ✕
          </button>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className={cn("size-8", editor.isActive("highlight") && "bg-accent text-accent-foreground")}>
            <Highlighter className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="flex gap-1 p-2 w-auto">
          {HIGHLIGHT_COLORS.map((color) => (
            <button
              key={color}
              className="size-6 rounded-full border"
              style={{ backgroundColor: color }}
              onClick={() => editor.chain().focus().toggleHighlight({ color }).run()}
              aria-label={`Highlight ${color}`}
            />
          ))}
          <button
            className="size-6 rounded-full border flex items-center justify-center text-[10px]"
            onClick={() => editor.chain().focus().unsetHighlight().run()}
            aria-label="Remove highlight"
          >
            ✕
          </button>
        </DropdownMenuContent>
      </DropdownMenu>

      <Separator orientation="vertical" className="mx-1 h-5" />

      {blocks.map(({ key, icon: Icon, active, onClick }) => (
        <Button key={key} variant="ghost" size="icon" className={cn("size-8", active && "bg-accent text-accent-foreground")} onClick={onClick}>
          <Icon className="size-4" />
        </Button>
      ))}

      <Separator orientation="vertical" className="mx-1 h-5" />

      {alignments.map(({ key, icon: Icon, value }) => (
        <Button
          key={key}
          variant="ghost"
          size="icon"
          className={cn("size-8", state.align === value && "bg-accent text-accent-foreground")}
          onClick={() => editor.chain().focus().setTextAlign(value).run()}
        >
          <Icon className="size-4" />
        </Button>
      ))}

      <Separator orientation="vertical" className="mx-1 h-5" />

      <Button variant="ghost" size="icon" className={cn("size-8", state.link && "bg-accent text-accent-foreground")} onClick={setLink}>
        <Link2 className="size-4" />
      </Button>
      {state.link && (
        <Button variant="ghost" size="icon" className="size-8" onClick={() => editor.chain().focus().unsetLink().run()}>
          <Link2Off className="size-4" />
        </Button>
      )}

      <Separator orientation="vertical" className="mx-1 h-5" />
      <Button variant="ghost" size="icon" className="size-8" disabled={!state.canUndo} onClick={() => editor.commands.undo()}>
        <Undo2 className="size-4" />
      </Button>
      <Button variant="ghost" size="icon" className="size-8" disabled={!state.canRedo} onClick={() => editor.commands.redo()}>
        <Redo2 className="size-4" />
      </Button>
    </div>
  );
}
