'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

export interface RelatedOption {
  id: string;
  name: string;
  slug: string;
  /** First product image, or null when the product has none. */
  image: string | null;
  /** Only PUBLISHED products render in the storefront "Complete the look"
   *  section — drafts are flagged so the operator knows they won't appear. */
  published: boolean;
}

interface Props {
  productId: string;
  /** Every other product the operator can pick from. */
  options: RelatedOption[];
  /** Currently linked product ids, in display order. */
  selectedIds: string[];
}

const MAX = 5;

/**
 * Picks up to five "Complete the look" products. Selection order is the
 * display order on the storefront — first checked shows first. A search
 * box keeps the list usable as the catalogue grows.
 */
export function RelatedProductsPicker({
  productId,
  options,
  selectedIds,
}: Props): React.ReactElement {
  const router = useRouter();
  const [selected, setSelected] = React.useState<string[]>(selectedIds);
  const [query, setQuery] = React.useState('');
  const [pending, startTransition] = React.useTransition();
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.name.toLowerCase().includes(q) || o.slug.includes(q),
    );
  }, [options, query]);

  function toggle(id: string): void {
    setSaved(false);
    setError(null);
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX) {
        setError(`You can pick at most ${MAX} products.`);
        return prev;
      }
      return [...prev, id];
    });
  }

  function onSave(): void {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await fetch(`/api/admin/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ relatedProductIds: selected }),
      });
      if (!res.ok) {
        setError(`Save failed (${res.status})`);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  const nameById = React.useMemo(
    () => new Map(options.map((o) => [o.id, o.name] as const)),
    [options],
  );
  const publishedById = React.useMemo(
    () => new Map(options.map((o) => [o.id, o.published] as const)),
    [options],
  );
  // Selected products that won't show on the storefront because they aren't
  // published yet — the #1 reason "I picked 5 but only N appear".
  const draftSelectedCount = selected.filter(
    (id) => publishedById.get(id) === false,
  ).length;

  return (
    <div className="bg-white border border-neutral-200 rounded-lg p-4">
      {selected.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {selected.map((id, i) => (
            <span
              key={id}
              className="inline-flex items-center gap-1 rounded bg-neutral-100 px-2 py-1 text-xs"
            >
              <span className="text-neutral-400">{i + 1}.</span>
              {nameById.get(id) ?? id}
              {publishedById.get(id) === false && (
                <span className="rounded bg-yellow-100 px-1 text-[10px] font-semibold uppercase text-yellow-800">
                  Draft
                </span>
              )}
              <button
                type="button"
                onClick={() => toggle(id)}
                aria-label="Remove"
                className="ml-1 text-neutral-500 hover:text-red-700"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search products…"
        className="mb-3 w-full border border-neutral-300 rounded px-3 py-1.5 text-sm"
      />

      <div className="max-h-64 overflow-y-auto border border-neutral-100 rounded">
        {filtered.length === 0 ? (
          <p className="p-3 text-xs text-neutral-500">No products match.</p>
        ) : (
          <ul className="list-none m-0 p-0">
            {filtered.map((o) => {
              const checked = selected.includes(o.id);
              return (
                <li key={o.id} className="border-b border-neutral-100 last:border-0">
                  <label className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-neutral-50">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(o.id)}
                      data-testid={`related-${o.id}`}
                    />
                    {o.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={o.image}
                        alt=""
                        className="h-12 w-10 flex-shrink-0 rounded object-cover bg-neutral-100"
                      />
                    ) : (
                      <span className="h-12 w-10 flex-shrink-0 rounded bg-neutral-100" />
                    )}
                    <span className="flex-1">
                      {o.name}
                      {!o.published && (
                        <span className="ml-2 rounded bg-yellow-100 px-1 text-[10px] font-semibold uppercase text-yellow-800">
                          Draft
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-neutral-400 font-mono">/{o.slug}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {draftSelectedCount > 0 && (
        <p className="mt-3 rounded border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
          {draftSelectedCount} selected{' '}
          {draftSelectedCount === 1 ? 'product is' : 'products are'} still a draft
          and won&apos;t appear on the storefront until published. Only published
          products show in &quot;Complete the look&quot;.
        </p>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={pending}
          className="px-4 py-2 bg-neutral-900 text-white text-xs uppercase tracking-wider rounded disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save related products'}
        </button>
        <span className="text-xs text-neutral-500">{selected.length}/{MAX} selected</span>
        {saved && <span className="text-xs text-green-700">Saved.</span>}
        {error && <span className="text-xs text-red-700">{error}</span>}
      </div>
    </div>
  );
}
