'use client';

import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useRouter } from 'next/navigation';
import { SingleImageUpload } from '@/app/admin/content/_components/single-image-upload';

interface Props {
  id: string;
  initial: {
    slug: string;
    title: string;
    bodyMarkdown: string;
    metaTitle: string;
    metaDescription: string;
    heroImage: string | null;
  };
}

/**
 * 50/50 split editor: textarea on the left, react-markdown preview on the
 * right re-rendering on every keystroke. The slug + meta fields share the
 * same PATCH payload so a single Save button handles everything.
 */
export function MarkdownEditor({ id, initial }: Props): React.ReactElement {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [title, setTitle] = React.useState(initial.title);
  const [slug, setSlug] = React.useState(initial.slug);
  const [body, setBody] = React.useState(initial.bodyMarkdown);
  const [metaTitle, setMetaTitle] = React.useState(initial.metaTitle);
  const [metaDescription, setMetaDescription] = React.useState(initial.metaDescription);
  const [heroImage, setHeroImage] = React.useState<string>(initial.heroImage ?? '');

  function onSave(): void {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await fetch(`/api/admin/content/pages/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          slug,
          bodyMarkdown: body,
          metaTitle,
          metaDescription,
          heroImage: heroImage.trim() || null,
        }),
      });
      if (!res.ok) {
        setError(`Save failed (${res.status})`);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  function onDelete(): void {
    if (!confirm('Delete this page?')) return;
    startTransition(async () => {
      const res = await fetch(`/api/admin/content/pages/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        setError(`Delete failed (${res.status})`);
        return;
      }
      router.push('/admin/content/pages');
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs uppercase tracking-wider text-neutral-600">Title</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            className="border border-neutral-300 rounded px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs uppercase tracking-wider text-neutral-600">Slug</span>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            maxLength={200}
            className="border border-neutral-300 rounded px-3 py-2 font-mono"
          />
        </label>
      </div>

      <div className="flex flex-col gap-2 text-sm">
        <span className="text-xs uppercase tracking-wider text-neutral-600">
          Hero image (wide banner above the title)
        </span>
        <SingleImageUpload prefix="pages" value={heroImage} onChange={setHeroImage} />
        <span className="text-[11px] text-neutral-500">
          Shown at the top of /<code>{slug}</code>. Use a landscape image —
          recommended ~1920×800 px JPG. Empty = page renders without a hero.
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-h-[480px]">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs uppercase tracking-wider text-neutral-600">
            Body (Markdown)
          </span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="border border-neutral-300 rounded px-3 py-2 font-mono text-sm flex-1 min-h-[480px]"
            data-testid="markdown-textarea"
          />
        </label>
        <div className="flex flex-col gap-1 text-sm">
          <span className="text-xs uppercase tracking-wider text-neutral-600">Preview</span>
          <div
            className="prose prose-sm max-w-none border border-neutral-200 rounded px-4 py-3 bg-white overflow-auto min-h-[480px]"
            data-testid="markdown-preview"
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs uppercase tracking-wider text-neutral-600">
            Meta title
          </span>
          <input
            type="text"
            value={metaTitle}
            onChange={(e) => setMetaTitle(e.target.value)}
            maxLength={200}
            className="border border-neutral-300 rounded px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs uppercase tracking-wider text-neutral-600">
            Meta description
          </span>
          <input
            type="text"
            value={metaDescription}
            onChange={(e) => setMetaDescription(e.target.value)}
            maxLength={500}
            className="border border-neutral-300 rounded px-3 py-2"
          />
        </label>
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}
      {saved && <p className="text-sm text-green-700">Saved.</p>}
      <div className="flex gap-3 mt-2">
        <button
          type="button"
          onClick={onSave}
          disabled={pending}
          className="px-4 py-2 bg-neutral-900 text-white text-xs uppercase tracking-wider rounded disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={pending}
          className="ml-auto px-4 py-2 border border-red-300 text-red-700 text-xs uppercase tracking-wider rounded hover:bg-red-50 disabled:opacity-50"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
