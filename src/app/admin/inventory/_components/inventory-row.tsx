"use client";

import * as React from "react";
import { useToast } from "@/components/ui/toast";

export interface InventoryRowData {
  variantId: string;
  productId: string;
  productName: string;
  productSlug: string;
  size: string;
  stock: number;
  isLow: boolean;
}

interface InventoryRowProps {
  row: InventoryRowData;
}

/**
 * Single inventory grid row with inline-editable stock cell. On blur:
 *   1. Optimistically set the local stock value.
 *   2. PATCH /api/admin/inventory/:variantId.
 *   3. On success: toast confirmation; on failure: rollback + show error.
 *
 * The input is keyed by the canonical stock value so React keeps it
 * controlled even when a stale value comes back from the server.
 */
export function InventoryRow({ row }: InventoryRowProps) {
  const toast = useToast();
  const [stock, setStock] = React.useState(row.stock);
  const [draft, setDraft] = React.useState(String(row.stock));
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // If the server-rendered stock changes (e.g. router.refresh() after
  // another tab edited it), reset the field.
  React.useEffect(() => {
    setStock(row.stock);
    setDraft(String(row.stock));
  }, [row.stock]);

  const isLow = stock <= 5;

  async function commit() {
    const parsed = Number.parseInt(draft, 10);
    if (!Number.isFinite(parsed) || parsed < 0 || String(parsed) !== draft.trim()) {
      setError("Stock must be a non-negative integer");
      setDraft(String(stock));
      return;
    }
    if (parsed === stock) {
      setError(null);
      return;
    }
    const previous = stock;
    setStock(parsed); // optimistic
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/inventory/${encodeURIComponent(row.variantId)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ stock: parsed }),
        },
      );
      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        setStock(previous); // rollback
        setDraft(String(previous));
        setError(text || `Save failed (${res.status})`);
        return;
      }
      const data = (await res.json()) as { stock: number };
      setStock(data.stock);
      setDraft(String(data.stock));
      toast.show(`Stock saved · ${row.productName} ${row.size} → ${data.stock}`);
    } catch (e) {
      setStock(previous);
      setDraft(String(previous));
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr className="border-t border-neutral-100 hover:bg-neutral-50">
      <td className="px-3 py-2">
        <a
          href={`/admin/catalog/products/${row.productId}`}
          className="underline"
        >
          {row.productName}
        </a>
      </td>
      <td className="px-3 py-2 text-xs text-neutral-600">{row.size}</td>
      <td className="px-3 py-2 w-32">
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            step={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur();
              } else if (e.key === "Escape") {
                setDraft(String(stock));
                e.currentTarget.blur();
              }
            }}
            disabled={busy}
            className="border border-neutral-300 rounded px-2 py-1 bg-white w-20 text-right disabled:opacity-50"
          />
          {busy && (
            <span className="text-xs text-neutral-500" aria-live="polite">…</span>
          )}
        </div>
        {error && <div className="mt-1 text-xs text-red-600">{error}</div>}
      </td>
      <td className="px-3 py-2">
        {isLow && (
          <span className="inline-block px-2 py-0.5 text-xs rounded border bg-amber-100 text-amber-800 border-amber-200">
            LOW
          </span>
        )}
      </td>
    </tr>
  );
}
