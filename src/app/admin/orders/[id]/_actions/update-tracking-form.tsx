"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";

interface Shipment {
  id: string;
  trackingNumber: string | null;
  carrier: string;
  shippedAt: Date | string | null;
}

const STATUSES = [
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "EXCEPTION",
] as const;

/**
 * Manual tracking-status override. Drives `POST /update-tracking`, which
 * appends a ShipmentEvent and (if status === DELIVERED) flips
 * `Shipment.deliveredAt` plus runs the order-state-machine reconciliation.
 */
export function UpdateTrackingForm({ shipments }: { shipments: Shipment[] }) {
  const router = useRouter();
  const toast = useToast();
  const eligible = shipments.filter((s) => s.shippedAt && s.trackingNumber);
  const [shipmentId, setShipmentId] = React.useState(eligible[0]?.id ?? "");
  const [status, setStatus] = React.useState<typeof STATUSES[number]>("DELIVERED");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (eligible.length === 0) {
    return (
      <p className="text-xs text-neutral-500">
        No despatched shipments to update.
      </p>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const orderId = window.location.pathname.split("/")[3];
      const res = await fetch(`/api/admin/orders/${orderId}/update-tracking`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ shipmentId, status }),
      });
      if (!res.ok) {
        setError((await res.text().catch(() => "")) || `Failed (${res.status})`);
        return;
      }
      toast.show(`Tracking updated to ${status.replace(/_/g, " ").toLowerCase()}.`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
      <div className="min-w-[200px] flex-1">
        <Select
          label="Shipment"
          value={shipmentId}
          onChange={setShipmentId}
          options={eligible.map((s) => ({
            value: s.id,
            label: `${s.carrier} · ${s.trackingNumber}`,
          }))}
        />
      </div>
      <div className="min-w-[160px]">
        <Select
          label="Status"
          value={status}
          onChange={(v) => setStatus(v as typeof STATUSES[number])}
          options={STATUSES.map((s) => ({
            value: s,
            label: s.replace(/_/g, " "),
          }))}
        />
      </div>
      <button
        type="submit"
        disabled={busy}
        className="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] rounded bg-foreground-primary text-foreground-inverse disabled:opacity-50"
      >
        {busy ? "Saving…" : "Update"}
      </button>
      {error && <span className="basis-full text-xs text-red-600">{error}</span>}
    </form>
  );
}
