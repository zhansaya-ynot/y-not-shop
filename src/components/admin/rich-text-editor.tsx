'use client';

import * as React from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import { marked } from 'marked';

/**
 * Pasted text often contains markdown markers (operator copies copy
 * doc, AI generated content, etc). Detect heading / list / bold
 * patterns and convert via `marked` so the editor sees structured
 * HTML rather than literal `#` characters.
 */
function looksLikeMarkdown(text: string): boolean {
  if (/(^|\n)\s*#{1,3}\s\S/.test(text)) return true;
  if (/\*\*[^*\n]+\*\*/.test(text)) return true;
  if (/(^|\n)\s*[-*]\s+\S/.test(text)) return true;
  return false;
}

interface Props {
  /** Stored as HTML — TipTap's `getHTML()` output. */
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}

/**
 * Visual rich-text editor for admin CMS pages. Outputs sanitisable HTML
 * (StarterKit's whitelist of nodes) — render on the storefront via
 * `dangerouslySetInnerHTML` inside a `prose` container.
 *
 * Design choice: HTML over markdown so the on-screen rendering in the
 * admin matches the storefront 1:1. Pasted formatting (from Word, Google
 * Docs, web pages) survives because StarterKit handles HTML input.
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Write here…',
  minHeight = 280,
}: Props): React.ReactElement {
  // Editor isn't in scope inside the editorProps closure (chicken/egg
  // with useEditor), so we capture it in a ref and dereference at
  // paste time. The ref is populated by the time any paste fires.
  const editorRef = React.useRef<Editor | null>(null);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        // Drop heading levels 4-6 — typography in the brand only uses h2/h3.
        heading: { levels: [2, 3] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { class: 'underline underline-offset-2' },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || '',
    editorProps: {
      attributes: {
        class:
          'prose prose-sm max-w-none focus:outline-none px-4 py-3 min-h-[var(--rte-min)]',
        style: `--rte-min:${minHeight}px`,
      },
      // Intercept pastes. If the clipboard carries plain text that
      // looks like markdown (operator pasted from a copy doc), run it
      // through `marked` and insert the resulting HTML so the editor
      // sees real headings/lists/bold rather than literal `#` chars.
      // HTML pastes (Word, Google Docs, web pages) skip this branch
      // and use TipTap's default HTML parser.
      handlePaste(_view, event): boolean {
        const ed = editorRef.current;
        if (!ed) return false;
        const cd = event.clipboardData;
        if (!cd) return false;
        const html = cd.getData('text/html');
        const text = cd.getData('text/plain');
        if (html) return false;
        if (!text || !looksLikeMarkdown(text)) return false;
        event.preventDefault();
        try {
          const converted = marked.parse(text, { async: false }) as string;
          ed.commands.insertContent(converted);
        } catch {
          ed.commands.insertContent(text);
        }
        return true;
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  // Keep the editor in sync if the parent resets `value` after a save —
  // without this, switching pages in the admin leaves stale HTML in view.
  React.useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() === value) return;
    editor.commands.setContent(value || '', { emitUpdate: false });
  }, [editor, value]);

  // Keep the ref pointing at the live editor instance for the paste
  // handler defined inside editorProps (which can't close over `editor`
  // directly because useEditor returns it).
  React.useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  if (!editor) {
    return (
      <div className="rounded border border-neutral-300 bg-neutral-50 p-4 text-sm text-neutral-500">
        Loading editor…
      </div>
    );
  }

  return (
    <div className="rounded border border-neutral-300 bg-white">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }): React.ReactElement {
  const [, force] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => {
    const update = () => force();
    editor.on('selectionUpdate', update);
    editor.on('transaction', update);
    return () => {
      editor.off('selectionUpdate', update);
      editor.off('transaction', update);
    };
  }, [editor]);

  function setLink(): void {
    const previous = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Link URL (leave empty to remove)', previous ?? 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-neutral-200 bg-neutral-50 px-2 py-1.5">
      <Btn label="B" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} className="font-bold" />
      <Btn label="I" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} className="italic" />
      <Btn label="U" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} className="underline" />
      <Sep />
      <Btn label="H2" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />
      <Btn label="H3" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} />
      <Btn label="¶" active={editor.isActive('paragraph')} onClick={() => editor.chain().focus().setParagraph().run()} />
      <Sep />
      <Btn label="• List" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} />
      <Btn label="1. List" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
      <Btn label="❝" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} />
      <Sep />
      <Btn label="Link" active={editor.isActive('link')} onClick={setLink} />
      <Sep />
      <Btn label="Clear" onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()} />
    </div>
  );
}

function Btn({
  label,
  active,
  onClick,
  className = '',
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  className?: string;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-2 py-1 text-xs uppercase tracking-wider transition-colors ${
        active
          ? 'bg-neutral-900 text-white'
          : 'text-neutral-700 hover:bg-neutral-200'
      } ${className}`}
    >
      {label}
    </button>
  );
}

function Sep(): React.ReactElement {
  return <span className="mx-1 h-5 w-px bg-neutral-300" aria-hidden />;
}
