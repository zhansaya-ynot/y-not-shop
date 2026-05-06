"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

/**
 * Two-step cancel: reason input → confirm → POST /cancel.
 *
 * The endpoint refuses cancel from non-cancellable statuses (SHIPPED,
 * DELIVERED, RETURNED, CANCELLED) — we surface those errors inline rather
 * than disabling the button so the operator sees the policy text.
 */
export interface CancelOrderFormProps {
  /**
   * When set, the form renders read-only — input + button disabled, the
   * reason text is shown as a tooltip on hover so the operator knows why
   * cancel is unavailable for the current order status.
   */
  disabledReason?: string | null;
}

export function CancelOrderForm({ disabledReason }: CancelOrderFormProps = {}) {
  const router = useRouter();
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const disabled = busy || Boolean(disabledReason);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (disabledReason) return;
    if (reason.trim().length < 3) {
      setError("Reason is required.");
      return;
    }
    setError(null);
    setConfirmOpen(true);
  }

  async function actuallyCancel() {
    setBusy(true);
    setError(null);
    try {
      const orderId = window.location.pathname.split("/")[3];
      const res = await fetch(`/api/admin/orders/${orderId}/cancel`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      if (!res.ok) {
        setError((await res.text().catch(() => "")) || `Failed (${res.status})`);
        return;
      }
      setConfirmOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      <label className="text-xs">
        Reason
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={disabled}
          className="mt-1 w-full border border-neutral-300 rounded px-2 py-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          placeholder="customer request / fraud / out of stock"
        />
      </label>
      <button
        type="submit"
        disabled={disabled}
        title={disabledReason ?? undefined}
        className="self-start px-3 py-1.5 text-xs uppercase tracking-wider rounded bg-red-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {busy ? "Cancelling…" : "Cancel order"}
      </button>
      {disabledReason && (
        <span className="text-[11px] text-neutral-500">{disabledReason}</span>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}

      <ConfirmDialog
        open={confirmOpen}
        title="Cancel this order?"
        description={
          <>
            <p className="mb-3">
              The order will be marked <strong>Cancelled</strong>. We will:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Issue a full refund to the customer&rsquo;s card via Stripe.</li>
              <li>Restock items that haven&rsquo;t been despatched yet.</li>
              <li>Email the customer with the cancellation + refund summary.</li>
            </ul>
            <p className="mt-3 text-foreground-tertiary">
              Reason recorded: <em>{reason.trim() || "—"}</em>
            </p>
          </>
        }
        confirmLabel="Cancel order"
        cancelLabel="Keep order"
        destructive
        pending={busy}
        onConfirm={actuallyCancel}
        onCancel={() => setConfirmOpen(false)}
      />
    </form>
  );
}
