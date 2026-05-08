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
  /** Set the moment the carrier returned a label PDF — we use it to gate
   *  the form so unlabelled (still in retry) shipments aren't selectable. */
  labelGeneratedAt: Date | string | null;
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
  // A shipment becomes update-able as soon as the carrier returned a label
  // — at that point the operator either marks it IN_TRANSIT (sets
  // shippedAt + sends tracking email) or jumps later statuses if the
  // physical handoff is already done. Previously the filter required
  // shippedAt, which trapped fresh shipments in 'no despatched shipments
  // to update' limbo.
  const eligible = shipments.filter((s) => s.labelGeneratedAt && s.trackingNumber);
  const [shipmentId, setShipmentId] = React.useState(eligible[0]?.id ?? "");
  // Default status depends on whether the shipment is already on its way.
  // A newly-labelled shipment likely needs IN_TRANSIT first; an already
  // shipped one is more often being marked DELIVERED.
  const initialStatus: typeof STATUSES[number] =
    eligible[0] && !eligible[0].shippedAt ? "IN_TRANSIT" : "DELIVERED";
  const [status, setStatus] = React.useState<typeof STATUSES[number]>(initialStatus);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (eligible.length === 0) {
    return (
      <p className="text-xs text-neutral-500">
        No labelled shipments to update yet.
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
