'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

const SIZES = ['XS', 'S', 'M', 'L', 'XL'] as const;
type Size = (typeof SIZES)[number];

// Storefront cart records one-size purchases under this token (see
// ONE_SIZE_TOKEN in add-to-bag-section). The admin editor mirrors that
// choice so the stock column for one-size products lives on the same
// row the cart reads from.
const ONE_SIZE_STORAGE: Size = 'M';

interface SizeRow {
  size: Size;
  stock: number;
}

interface Props {
  productId: string;
  initial: Array<{ size: string; stock: number }>;
  /**
   * Mirror of Product.isOneSize. When true the editor collapses to a
   * single "Stock" input and writes the value to the M row internally,
   * zeroing the other four sizes so a later toggle off doesn't leak
   * stale numbers back onto the storefront.
   */
  isOneSize: boolean;
}

/**
 * Stock editor. For sized products it renders one input per canonical
 * size (XS→XL). For one-size products it collapses to a single field —
 * Jansaya's accessories don't have sizes so the size grid is just noise.
 *
 * Either path saves all five sizes on submit so the server-side upsert
 * stays symmetric (no implicit "missing = keep").
 */
export function StockEditor({ productId, initial, isOneSize }: Props): React.ReactElement {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  const initialMap = new Map(
    initial.map((r) => [r.size as Size, r.stock] as const),
  );
  const [rows, setRows] = React.useState<SizeRow[]>(
    SIZES.map((s) => ({ size: s, stock: initialMap.get(s) ?? 0 })),
  );

  function set(size: Size, value: number): void {
    setSaved(false);
    setRows((prev) => prev.map((r) => (r.size === size ? { ...r, stock: value } : r)));
  }

  function onSave(): void {
    setError(null);
    setSaved(false);
    // One-size mode: only the M row carries the real number, the others
    // get zeroed so they can't leak back into PDP if the operator
    // toggles isOneSize off later.
    const payload: SizeRow[] = isOneSize
      ? rows.map((r) => ({ size: r.size, stock: r.size === ONE_SIZE_STORAGE ? r.stock : 0 }))
      : rows;
    startTransition(async () => {
      const res = await fetch(`/api/admin/products/${productId}/sizes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sizes: payload }),
      });
      if (!res.ok) {
        setError(`Save failed (${res.status})`);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  const oneSizeRow = rows.find((r) => r.size === ONE_SIZE_STORAGE) ?? rows[0];

  return (
    <div className="bg-white border border-neutral-200 rounded-lg p-4">
      {isOneSize ? (
        <label className="flex flex-col gap-1 text-sm max-w-[200px]">
          <span className="text-xs uppercase tracking-wider text-neutral-600">
            Stock (one size)
          </span>
          <input
            type="number"
            min={0}
            value={oneSizeRow.stock}
            onChange={(e) =>
              set(ONE_SIZE_STORAGE, Math.max(0, Number.parseInt(e.target.value, 10) || 0))
            }
            className="border border-neutral-300 rounded px-3 py-2"
            data-testid="stock-one-size"
          />
          <span className="text-[11px] text-neutral-500">
            Single inventory count — the size picker is hidden on the storefront for this product.
          </span>
        </label>
      ) : (
        <div className="grid grid-cols-5 gap-3">
          {rows.map((r) => (
            <label key={r.size} className="flex flex-col gap-1 text-sm">
              <span className="text-xs uppercase tracking-wider text-neutral-600">
                {r.size}
              </span>
              <input
                type="number"
                min={0}
                value={r.stock}
                onChange={(e) =>
                  set(r.size, Math.max(0, Number.parseInt(e.target.value, 10) || 0))
                }
                className="border border-neutral-300 rounded px-3 py-2"
                data-testid={`stock-${r.size}`}
              />
            </label>
          ))}
        </div>
      )}
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={pending}
          className="px-4 py-2 bg-neutral-900 text-white text-xs uppercase tracking-wider rounded disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save stock'}
        </button>
        {saved && <span className="text-xs text-green-700">Saved.</span>}
        {error && <span className="text-xs text-red-700">{error}</span>}
      </div>
    </div>
  );
}
