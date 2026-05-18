'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import type { CollectionPagesContent } from '@/lib/cms/collection-pages';

interface Props {
  initial: CollectionPagesContent;
}

const SECTIONS: Array<{ slug: keyof CollectionPagesContent; label: string; path: string }> = [
  { slug: 'new-collection', label: 'New Collection', path: '/new-collection' },
  { slug: 'timeless', label: 'Timeless', path: '/timeless' },
  { slug: 'new-arrivals', label: 'New Arrivals', path: '/new-arrivals' },
];

export function CollectionPagesForm({ initial }: Props): React.ReactElement {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [state, setState] = React.useState(initial);

  function update(
    slug: keyof CollectionPagesContent,
    field: 'title' | 'intro',
    value: string,
  ): void {
    setSaved(false);
    setState((prev) => ({ ...prev, [slug]: { ...prev[slug], [field]: value } }));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await fetch('/api/admin/content/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collectionPagesJson: state }),
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
    <form onSubmit={onSubmit} className="flex flex-col gap-8">
      {SECTIONS.map((section) => (
        <fieldset key={section.slug} className="flex flex-col gap-3 border border-neutral-200 rounded-lg p-4">
          <legend className="px-2 text-sm font-semibold">
            {section.label}{' '}
            <span className="font-mono text-xs text-neutral-500">{section.path}</span>
          </legend>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs uppercase tracking-wider text-neutral-600">Title</span>
            <input
              type="text"
              value={state[section.slug].title}
              onChange={(e) => update(section.slug, 'title', e.target.value)}
              maxLength={120}
              className="border border-neutral-300 rounded px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs uppercase tracking-wider text-neutral-600">Intro text</span>
            <textarea
              value={state[section.slug].intro}
              onChange={(e) => update(section.slug, 'intro', e.target.value)}
              rows={3}
              maxLength={600}
              className="border border-neutral-300 rounded px-3 py-2"
            />
          </label>
        </fieldset>
      ))}

      {error && <p className="text-sm text-red-700">{error}</p>}
      {saved && <p className="text-sm text-green-700">Saved.</p>}

      <div>
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
