"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { useRef, useCallback } from "react";

type ArticleEditorProps = {
  content: string;
  onChange: (html: string) => void;
};

/**
 * TipTap editor dengan toolbar custom yang konsisten dengan palet
 * cream/forest/gold. Mendukung bold, italic, heading, list, quote,
 * link, dan gambar (unggah lewat /api/upload/media).
 */
export function ArticleEditor({ content, onChange }: ArticleEditorProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-gold-deep underline",
          rel: "noopener noreferrer",
          target: "_blank",
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: "rounded-md border border-wood/15 max-w-full h-auto",
        },
      }),
    ],
    content,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "prose-editor min-h-[280px] rounded-b-md border border-t-0 border-wood/30 bg-cream px-4 py-3 text-sm leading-relaxed text-forest focus:outline-none",
        "aria-label": "Isi artikel",
      },
    },
    onUpdate: ({ editor: e }) => {
      onChange(e.getHTML());
    },
  });

  const setLink = useCallback(() => {
    if (!editor) return;
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Masukkan URL tautan", previous ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  const addImage = useCallback(
    async (file: File | null) => {
      if (!file || !editor) return;

      if (file.size > 5 * 1024 * 1024) {
        window.alert("Ukuran gambar maksimal 5MB.");
        return;
      }
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        window.alert("Format gambar harus JPG, PNG, atau WebP.");
        return;
      }

      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/upload/media", { method: "POST", body: fd });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((data as { error?: string }).error ?? "Gagal mengunggah");
        editor.chain().focus().setImage({ src: (data as { url: string }).url }).run();
      } catch (e) {
        window.alert(e instanceof Error ? e.message : "Gagal mengunggah gambar");
      } finally {
        if (fileRef.current) fileRef.current.value = "";
      }
    },
    [editor],
  );

  if (!editor) {
    return (
      <div className="min-h-[320px] animate-pulse rounded-md border border-wood/20 bg-parchment/40" />
    );
  }

  return (
    <div className="rounded-md">
      <EditorToolbar
        editor={editor}
        onLink={setLink}
        onPickImage={() => fileRef.current?.click()}
      />
      <EditorContent editor={editor} />
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(e) => addImage(e.target.files?.[0] ?? null)}
      />
      <style>{`
        .prose-editor p { margin: 0.5rem 0; }
        .prose-editor h2 { font-family: var(--font-display); font-size: 1.35rem; font-weight: 600; margin: 1rem 0 0.5rem; }
        .prose-editor h3 { font-family: var(--font-display); font-size: 1.15rem; font-weight: 600; margin: 0.85rem 0 0.4rem; }
        .prose-editor ul { list-style: disc; padding-left: 1.4rem; margin: 0.5rem 0; }
        .prose-editor ol { list-style: decimal; padding-left: 1.4rem; margin: 0.5rem 0; }
        .prose-editor blockquote { border-left: 3px solid var(--color-gold); padding-left: 0.85rem; color: var(--color-muted); margin: 0.75rem 0; font-style: italic; }
        .prose-editor img { margin: 0.75rem 0; }
        .prose-editor a { color: var(--color-gold-deep); text-decoration: underline; }
        .prose-editor p.is-editor-empty:first-child::before { color: var(--color-muted); content: attr(data-placeholder); float: left; height: 0; pointer-events: none; }
      `}</style>
    </div>
  );
}

function EditorToolbar({
  editor,
  onLink,
  onPickImage,
}: {
  editor: Editor;
  onLink: () => void;
  onPickImage: () => void;
}) {
  const btn = (active: boolean) =>
    `rounded px-2.5 py-1.5 text-xs font-semibold transition-colors ${
      active
        ? "bg-forest text-cream"
        : "text-muted hover:bg-wood/10 hover:text-forest"
    }`;

  return (
    <div
      className="flex flex-wrap items-center gap-1 rounded-t-md border border-wood/30 bg-parchment/60 px-2 py-1.5"
      role="toolbar"
      aria-label="Format artikel"
    >
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={btn(editor.isActive("bold"))}
        aria-pressed={editor.isActive("bold")}
        aria-label="Tebal"
      >
        B
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={`${btn(editor.isActive("italic"))} italic`}
        aria-pressed={editor.isActive("italic")}
        aria-label="Miring"
      >
        I
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleStrike().run()}
        className={`${btn(editor.isActive("strike"))} line-through`}
        aria-pressed={editor.isActive("strike")}
        aria-label="Coret"
      >
        S
      </button>

      <span className="mx-1 h-5 w-px bg-wood/20" aria-hidden="true" />

      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={btn(editor.isActive("heading", { level: 2 }))}
        aria-pressed={editor.isActive("heading", { level: 2 })}
        aria-label="Judul tingkat 2"
      >
        H2
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={btn(editor.isActive("heading", { level: 3 }))}
        aria-pressed={editor.isActive("heading", { level: 3 })}
        aria-label="Judul tingkat 3"
      >
        H3
      </button>

      <span className="mx-1 h-5 w-px bg-wood/20" aria-hidden="true" />

      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={btn(editor.isActive("bulletList"))}
        aria-pressed={editor.isActive("bulletList")}
        aria-label="Daftar butir"
      >
        • Daftar
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={btn(editor.isActive("orderedList"))}
        aria-pressed={editor.isActive("orderedList")}
        aria-label="Daftar bernomor"
      >
        1. Daftar
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={btn(editor.isActive("blockquote"))}
        aria-pressed={editor.isActive("blockquote")}
        aria-label="Kutipan"
      >
        Kutipan
      </button>

      <span className="mx-1 h-5 w-px bg-wood/20" aria-hidden="true" />

      <button
        type="button"
        onClick={onLink}
        className={btn(editor.isActive("link"))}
        aria-pressed={editor.isActive("link")}
        aria-label="Tautan"
      >
        Tautan
      </button>
      <button
        type="button"
        onClick={onPickImage}
        className={btn(false)}
        aria-label="Sisipkan gambar"
      >
        Gambar
      </button>

      <span className="mx-1 h-5 w-px bg-wood/20" aria-hidden="true" />

      <button
        type="button"
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        className={`${btn(false)} disabled:opacity-40`}
        aria-label="Urungkan"
      >
        ↩
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        className={`${btn(false)} disabled:opacity-40`}
        aria-label="Ulangi"
      >
        ↪
      </button>
    </div>
  );
}
