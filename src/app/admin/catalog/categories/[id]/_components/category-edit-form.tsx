'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

export interface ParentOption {
  id: string;
  name: string;
  depth: number;
}

interface Props {
  categoryId: string;
  initial: {
    name: string;
    slug: string;
    description: string;
    parentId: string | null;
    bannerImage: string | null;
  };
  parentOptions: ParentOption[];
  /**
   * Categories that would form a cycle if chosen as the new parent (self +
   * descendants). The form pre-warns the admin so they don't have to wait
   * for the 422 round-trip.
   */
  illegalParentIds: string[];
}

export function CategoryEditForm({
  categoryId,
  initial,
  parentOptions,
  illegalParentIds,
}: Props): React.ReactElement {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [name, setName] = React.useState(initial.name);
  const [slug, setSlug] = React.useState(initial.slug);
  const [description, setDescription] = React.useState(initial.description);
  const [parentId, setParentId] = React.useState<string>(initial.parentId ?? '');
  const [bannerImage, setBannerImage] = React.useState<string>(initial.bannerImage ?? '');
  const illegalSet = React.useMemo(() => new Set(illegalParentIds), [illegalParentIds]);
  const cycleWarning = parentId !== '' && illegalSet.has(parentId);

  function onSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    setError(null);
    if (!name) {
      setError('Name is required.');
      return;
    }
    if (cycleWarning) {
      setError('Cannot move under itself or one of its descendants.');
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
          parentId: parentId || null,
          bannerImage: bannerImage.trim() || null,
        }),
      });
      if (res.status === 422) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error ?? 'Server rejected the change as a cycle.');
        return;
      }
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
        <span className="text-xs uppercase tracking-wider text-neutral-600">Parent</span>
        <select
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
          className="border border-neutral-300 rounded px-3 py-2 bg-white"
        >
          <option value="">— None (root) —</option>
          {parentOptions.map((opt) => {
            const isIllegal = illegalSet.has(opt.id);
            return (
              <option key={opt.id} value={opt.id} disabled={isIllegal}>
                {'  '.repeat(opt.depth)}
                {opt.depth > 0 ? '↳ ' : ''}
                {opt.name}
                {isIllegal ? ' (cycle)' : ''}
              </option>
            );
          })}
        </select>
        {cycleWarning && (
          <span className="text-xs text-red-700 mt-1">
            Choosing this parent would create a cycle.
          </span>
        )}
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
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs uppercase tracking-wider text-neutral-600">Banner image URL</span>
        <input
          type="text"
          value={bannerImage}
          onChange={(e) => setBannerImage(e.target.value)}
          placeholder="/cms/categories/jackets.jpg"
          className="border border-neutral-300 rounded px-3 py-2"
        />
        <span className="text-[11px] text-neutral-500 mt-1">
          Shown on the homepage Shop-by-Category grid. Upload elsewhere (Hero / Lookbook media manager) and paste the URL here.
        </span>
        {bannerImage.trim() && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={bannerImage}
            alt="Banner preview"
            className="mt-2 max-h-32 w-auto rounded border border-neutral-200"
          />
        )}
      </label>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <div className="flex gap-3 mt-2">
        <button
          type="submit"
          disabled={pending || cycleWarning}
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
