'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

/**
 * Minimal create form: the rich editing (banner image, archive) happens on
 * the detail page after creation, so this collects only the bare minimum
 * needed to spawn a row (name, optional slug, description) and then
 * redirects to /admin/catalog/categories/[id] for the rest.
 *
 * Parent / hierarchy is intentionally omitted — YNOT's catalog is flat
 * and exposing it here just confused the operator.
 */
export function CategoryCreateForm(): React.ReactElement {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [name, setName] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [description, setDescription] = React.useState('');

  function onSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    setError(null);
    if (!name) {
      setError('Name is required.');
      return;
    }
    startTransition(async () => {
      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          slug: slug || undefined,
          description,
        }),
      });
      if (!res.ok) {
        setError(`Create failed (${res.status})`);
        return;
      }
      const cat = await res.json();
      router.push(`/admin/catalog/categories/${cat.id}`);
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs uppercase tracking-wider text-neutral-600">Name</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={100}
          className="border border-neutral-300 rounded px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs uppercase tracking-wider text-neutral-600">
          Slug (auto from name if blank)
        </span>
        <input
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          maxLength={100}
          className="border border-neutral-300 rounded px-3 py-2 font-mono"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs uppercase tracking-wider text-neutral-600">Description</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="border border-neutral-300 rounded px-3 py-2"
        />
      </label>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <div className="flex gap-3 mt-2">
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 bg-neutral-900 text-white text-xs uppercase tracking-wider rounded disabled:opacity-50"
        >
          {pending ? 'Creating…' : 'Create category'}
        </button>
      </div>
    </form>
  );
}
