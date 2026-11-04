"use client";

import { useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import ImageExtension from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { createLowlight, common } from "lowlight";
import { MediaPickerModal } from "@/components/admin/MediaPickerModal";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Youtube from "@tiptap/extension-youtube";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Undo,
  Redo,
  Heading2,
  Heading3,
  ImagePlus,
  Code2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link as LinkIcon,
  Video,
  Table as TableIcon,
} from "lucide-react";

const lowlight = createLowlight(common);

/**
 * Cleans HTML pasted from Word / Google Docs / websites so only semantic
 * structure survives (headings, lists, paragraphs, bold, links, images, tables).
 */
function cleanPastedHtml(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<meta[^>]*>/gi, "")
    .replace(/<o:p>[\s\S]*?<\/o:p>/gi, "")
    .replace(/<\/?span[^>]*>/gi, "")
    .replace(/<\/?font[^>]*>/gi, "")
    .replace(/ (style|class|lang|dir|id)="[^"]*"/gi, "");
}

interface BlogRichTextEditorProps {
  value: string; // HTML
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number; // px
}

export function BlogRichTextEditor({
  value,
  onChange,
  placeholder = "Write your post content here…",
  minHeight = 400,
}: BlogRichTextEditorProps) {
  const [showPicker, setShowPicker] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        link: false,
        codeBlock: false,
      }),
      CodeBlockLowlight.configure({ lowlight, languageClassPrefix: "language-" }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Link.configure({
        openOnClick: true,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      ImageExtension.configure({
        HTMLAttributes: { class: "editor-image" },
      }),
      Youtube.configure({
        width: 640,
        height: 360,
        HTMLAttributes: { class: "editor-video rounded-lg mx-auto" },
      }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder }),
    ],
    content: value || "",
    editorProps: { transformPastedHTML: cleanPastedHtml },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  function handleSetLink() {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", previousUrl ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  function handleInsertVideo() {
    if (!editor) return;
    const url = window.prompt("YouTube video URL");
    if (url) editor.commands.setYoutubeVideo({ src: url });
  }

  function handleInsertTable() {
    if (!editor) return;
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }

  if (!editor) return <div className="h-96 animate-pulse bg-surface rounded-lg" />;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      {/* Toolbar — sticky: stays visible under the admin top bar while you scroll the post */}
      <div className="sticky top-[var(--topbar-h,88px)] z-20 -mx-1 -mt-1 bg-card px-1 pb-1 pt-1">
      <div className="mb-2 flex flex-wrap items-center gap-1 rounded-lg border border-border bg-surface p-2">
        <ToolButton
          icon={Heading2}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive("heading", { level: 2 })}
          title="Heading 2"
        />
        <ToolButton
          icon={Heading3}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive("heading", { level: 3 })}
          title="Heading 3"
        />
        <Separator />
        <ToolButton
          icon={Bold}
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          title="Bold"
        />
        <ToolButton
          icon={Italic}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          title="Italic"
        />
        <ToolButton
          icon={UnderlineIcon}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive("underline")}
          title="Underline"
        />
        <ToolButton
          icon={Strikethrough}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive("strike")}
          title="Strikethrough"
        />
        <ToolButton
          icon={Code2}
          onClick={() => editor.chain().focus().toggleCode().run()}
          active={editor.isActive("code")}
          title="Inline Code"
        />
        <Separator />
        <ToolButton
          icon={AlignLeft}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          active={editor.isActive({ textAlign: "left" })}
          title="Align Left"
        />
        <ToolButton
          icon={AlignCenter}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          active={editor.isActive({ textAlign: "center" })}
          title="Align Center"
        />
        <ToolButton
          icon={AlignRight}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          active={editor.isActive({ textAlign: "right" })}
          title="Align Right"
        />
        <Separator />
        <ToolButton
          icon={List}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")}
          title="Bullet List"
        />
        <ToolButton
          icon={ListOrdered}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive("orderedList")}
          title="Ordered List"
        />
        <ToolButton
          icon={Quote}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive("blockquote")}
          title="Blockquote"
        />
        <Separator />
        <ToolButton
          icon={LinkIcon}
          onClick={handleSetLink}
          active={editor.isActive("link")}
          title="Insert Link"
        />
        <ToolButton
          icon={ImagePlus}
          onClick={() => setShowPicker(true)}
          title="Insert Image"
        />
        <ToolButton icon={Video} onClick={handleInsertVideo} title="Embed Video" />
        <ToolButton icon={TableIcon} onClick={handleInsertTable} title="Insert Table" />
        <ToolButton
          icon={Code2}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          active={editor.isActive("codeBlock")}
          title="Code Block"
        />
        <Separator />
        <ToolButton
          icon={Undo}
          onClick={() => editor.chain().focus().undo().run()}
          title="Undo"
        />
        <ToolButton
          icon={Redo}
          onClick={() => editor.chain().focus().redo().run()}
          title="Redo"
        />
      </div>

      {/* Contextual table toolbar — only shown while the cursor is inside a table */}
      {editor.isActive("table") && (
        <div className="mb-2 flex flex-wrap items-center gap-1.5 rounded-lg border border-crimson/30 bg-crimson-light p-2">
          <span className="mr-1 text-xs font-semibold text-crimson">Table:</span>
          <TableActionButton onClick={() => editor.chain().focus().addColumnBefore().run()}>
            + Col Left
          </TableActionButton>
          <TableActionButton onClick={() => editor.chain().focus().addColumnAfter().run()}>
            + Col Right
          </TableActionButton>
          <TableActionButton onClick={() => editor.chain().focus().deleteColumn().run()} danger>
            Delete Col
          </TableActionButton>
          <Separator />
          <TableActionButton onClick={() => editor.chain().focus().addRowBefore().run()}>
            + Row Above
          </TableActionButton>
          <TableActionButton onClick={() => editor.chain().focus().addRowAfter().run()}>
            + Row Below
          </TableActionButton>
          <TableActionButton onClick={() => editor.chain().focus().deleteRow().run()} danger>
            Delete Row
          </TableActionButton>
          <Separator />
          <TableActionButton onClick={() => editor.chain().focus().mergeCells().run()}>
            Merge Cells
          </TableActionButton>
          <TableActionButton onClick={() => editor.chain().focus().splitCell().run()}>
            Split Cell
          </TableActionButton>
          <Separator />
          <TableActionButton onClick={() => editor.chain().focus().deleteTable().run()} danger>
            Delete Table
          </TableActionButton>
        </div>
      )}

      </div>

      {/* Editor */}
      <div
        className="max-w-none rounded-lg border border-border bg-background p-4 text-foreground focus-within:border-crimson [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-border [&_th]:bg-surface [&_th]:px-2 [&_th]:py-1"
        style={{ minHeight: `${minHeight}px` }}
      >
        <EditorContent editor={editor} />
      </div>

      <MediaPickerModal
        open={showPicker}
        onClose={() => setShowPicker(false)}
        onSelect={(url) => {
          editor.chain().focus().setImage({ src: url }).run();
          setShowPicker(false);
        }}
      />
    </div>
  );
}

function ToolButton({
  icon: Icon,
  onClick,
  active,
  disabled,
  title,
}: {
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex h-8 w-8 items-center justify-center rounded-lg border transition ${
        active
          ? "border-crimson bg-crimson-light text-crimson"
          : "border-border text-muted hover:border-crimson hover:text-crimson"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function Separator() {
  return <div className="h-6 w-px bg-border" />;
}

function TableActionButton({
  onClick,
  danger,
  children,
}: {
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-2 py-1 text-xs font-medium transition ${
        danger
          ? "border-crimson/40 text-crimson hover:bg-crimson hover:text-white"
          : "border-border bg-card text-foreground hover:border-crimson hover:text-crimson"
      }`}
    >
      {children}
    </button>
  );
}
