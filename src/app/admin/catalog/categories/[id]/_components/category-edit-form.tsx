'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { SingleImageUpload } from '@/app/admin/content/_components/single-image-upload';

interface Props {
  categoryId: string;
  initial: {
    name: string;
    slug: string;
    description: string;
    bannerImage: string | null;
  };
}

/**
 * Edit form for a single category. The Parent / hierarchy concept is
 * intentionally NOT exposed here — YNOT's catalog is flat (Jackets,
 * Coats, Bombers etc all sit under root). The Category model still
 * carries the parentId column for forward-compat, but the form keeps
 * it pinned to null so the operator never has to think about it.
 */
export function CategoryEditForm({ categoryId, initial }: Props): React.ReactElement {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [name, setName] = React.useState(initial.name);
  const [slug, setSlug] = React.useState(initial.slug);
  const [description, setDescription] = React.useState(initial.description);
  const [bannerImage, setBannerImage] = React.useState<string>(initial.bannerImage ?? '');

  function onSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    setError(null);
    if (!name) {
      setError('Name is required.');
      return;
    }
    startTransition(async () => {
      const res = await fetch(`/api/admin/categories/${categoryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          slug,
          description,
          bannerImage: bannerImage.trim() || null,
        }),
      });
      if (!res.ok) {
        setError(`Save failed (${res.status})`);
        return;
      }
      router.refresh();
    });
  }

  function onArchive(): void {
    if (!window.confirm('Archive this category? It will be hidden from the storefront.')) return;
    startTransition(async () => {
      const res = await fetch(`/api/admin/categories/${categoryId}`, { method: 'DELETE' });
      if (!res.ok) {
        setError(`Archive failed (${res.status})`);
        return;
      }
      router.push('/admin/catalog/categories');
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
        <span className="text-xs uppercase tracking-wider text-neutral-600">Slug</span>
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
      <div className="flex flex-col gap-2 text-sm">
        <span className="text-xs uppercase tracking-wider text-neutral-600">Banner image</span>
        <SingleImageUpload
          prefix="categories"
          value={bannerImage}
          onChange={setBannerImage}
        />
        <span className="text-[11px] text-neutral-500">
          Shown on the homepage Shop-by-Category grid. Drag in a JPG/PNG or
          click to upload — file is stored under <code>/media/categories/</code>.
        </span>
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <div className="flex gap-3 mt-2">
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 bg-neutral-900 text-white text-xs uppercase tracking-wider rounded disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onArchive}
          disabled={pending}
          className="px-4 py-2 border border-red-300 text-red-700 text-xs uppercase tracking-wider rounded disabled:opacity-50"
        >
          Archive
        </button>
      </div>
    </form>
  );
}
