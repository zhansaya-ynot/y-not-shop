'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { SingleImageUpload } from '../../_components/single-image-upload';
import type { HomeEditorialContent } from '@/lib/cms/home-editorial';

interface Props {
  initial: HomeEditorialContent;
}

export function EditorialForm({ initial }: Props): React.ReactElement {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [title, setTitle] = React.useState(initial.title);
  const [body, setBody] = React.useState(initial.body);
  const [imageUrl, setImageUrl] = React.useState(initial.imageUrl);
  const [ctaLabel, setCtaLabel] = React.useState(initial.ctaLabel);
  const [ctaHref, setCtaHref] = React.useState(initial.ctaHref);

  function onSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await fetch('/api/admin/content/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          homeEditorialJson: { title, body, imageUrl, ctaLabel, ctaHref },
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

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs uppercase tracking-wider text-neutral-600">Title</span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={120}
          className="border border-neutral-300 rounded px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs uppercase tracking-wider text-neutral-600">Body</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          maxLength={600}
          className="border border-neutral-300 rounded px-3 py-2"
        />
      </label>

      <div className="flex flex-col gap-1 text-sm">
        <span className="text-xs uppercase tracking-wider text-neutral-600">Background image</span>
        <SingleImageUpload prefix="editorial" value={imageUrl} onChange={setImageUrl} />
        <label className="flex flex-col gap-1 mt-2">
          <span className="text-xs uppercase tracking-wider text-neutral-600">Image URL</span>
          <input
            type="text"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            required
            className="border border-neutral-300 rounded px-3 py-2 font-mono text-xs"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs uppercase tracking-wider text-neutral-600">CTA label</span>
        <input
          type="text"
          value={ctaLabel}
          onChange={(e) => setCtaLabel(e.target.value)}
          maxLength={60}
          className="border border-neutral-300 rounded px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs uppercase tracking-wider text-neutral-600">CTA href</span>
        <input
          type="text"
          value={ctaHref}
          onChange={(e) => setCtaHref(e.target.value)}
          maxLength={400}
          className="border border-neutral-300 rounded px-3 py-2 font-mono text-xs"
        />
      </label>

      {error && <p className="text-sm text-red-700">{error}</p>}
      {saved && <p className="text-sm text-green-700">Saved.</p>}

      <div className="flex gap-3 mt-2">
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 bg-neutral-900 text-white text-xs uppercase tracking-wider rounded disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
