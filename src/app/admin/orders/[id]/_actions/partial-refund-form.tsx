"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface OrderItem {
  id: string;
  productName: string;
  size: string;
  quantity: number;
  unitPriceCents: number;
}

/**
 * Per-item quantity selector that POSTs to /partial-refund. Submits only
 * items with qty > 0; refund amount is computed server-side so we don't have
 * to mirror the pricing logic here.
 */
export function PartialRefundForm({ items }: { items: OrderItem[] }) {
  const router = useRouter();
  const [qty, setQty] = React.useState<Record<string, number>>({});
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const payload = items
    .map((it) => ({
      orderItemId: it.id,
      quantity: Math.max(0, Math.min(it.quantity, qty[it.id] ?? 0)),
    }))
    .filter((i) => i.quantity > 0);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (payload.length === 0) {
      setError("Select at least one item to refund.");
      return;
    }
    setError(null);
    setConfirmOpen(true);
  }

  async function actuallyRefund() {
    setBusy(true);
    setError(null);
    try {
      const orderId = window.location.pathname.split("/")[3];
      const res = await fetch(`/api/admin/orders/${orderId}/partial-refund`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: payload }),
      });
      if (!res.ok) {
        setError((await res.text().catch(() => "")) || `Failed (${res.status})`);
        return;
      }
      setQty({});
      setConfirmOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <table className="w-full text-xs">
        <thead className="text-neutral-500 uppercase">
          <tr>
            <th className="text-left">Item</th>
            <th className="text-right">Ordered</th>
            <th className="text-right">Refund qty</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id} className="border-t border-neutral-100">
              <td className="py-1">
                {it.productName} <span className="text-neutral-500">({it.size})</span>
              </td>
              <td className="py-1 text-right">{it.quantity}</td>
              <td className="py-1 text-right">
                <input
                  type="number"
                  min={0}
                  max={it.quantity}
                  value={qty[it.id] ?? 0}
                  onChange={(e) =>
                    setQty((q) => ({ ...q, [it.id]: Number(e.target.value) }))
                  }
                  className="w-16 border border-neutral-300 rounded px-2 py-0.5 text-right"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="px-3 py-1.5 text-xs uppercase tracking-wider rounded bg-amber-600 text-white disabled:opacity-50"
        >
          {busy ? "Refunding…" : "Refund selected items"}
        </button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Refund selected items"
        description={
          <>
            Refund <strong>{payload.length}</strong> item
            {payload.length === 1 ? "" : "s"}? Stripe will return the funds to
            the customer&rsquo;s card; this action can&rsquo;t be undone.
          </>
        }
        confirmLabel="Refund"
        destructive
        pending={busy}
        onConfirm={actuallyRefund}
        onCancel={() => setConfirmOpen(false)}
      />
    </form>
  );
}
