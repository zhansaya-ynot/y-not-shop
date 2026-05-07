"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup } from "@/components/ui/radio-group";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";

interface ReturnItem {
  id: string;
  productName: string;
  size: string;
  quantity: number;
}

interface InspectionFormProps {
  returnId: string;
  items: ReturnItem[];
}

type Pending = "approve" | "reject" | null;

/**
 * Per-item Acceptable / Rejected toggle. Approve sends the accepted-id list
 * + inspection notes to /approve; Reject sends rejection reason + notes to
 * /reject. Disabled once the return is in a terminal status — the parent
 * page renders this only for inspectable returns.
 */
export function InspectionForm({ returnId, items }: InspectionFormProps) {
  const router = useRouter();
  const toast = useToast();
  const [accepted, setAccepted] = React.useState<Record<string, boolean>>(
    () => Object.fromEntries(items.map((i) => [i.id, true])),
  );
  const [notes, setNotes] = React.useState("");
  const [rejectionReason, setRejectionReason] = React.useState("");
  const [busy, setBusy] = React.useState<Pending>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [confirm, setConfirm] = React.useState<Pending>(null);

  const acceptedCount = items.filter((i) => accepted[i.id]).length;

  function tryApprove() {
    setError(null);
    if (acceptedCount === 0) {
      setError("Approve requires at least one accepted item.");
      return;
    }
    setConfirm("approve");
  }

  function tryReject() {
    setError(null);
    if (rejectionReason.trim().length < 3) {
      setError("Rejection reason is required.");
      return;
    }
    if (notes.trim().length < 3) {
      setError("Inspection notes are required when rejecting.");
      return;
    }
    setConfirm("reject");
  }

  async function approve() {
    const acceptedIds = items.filter((i) => accepted[i.id]).map((i) => i.id);
    setBusy("approve");
    setError(null);
    try {
      const res = await fetch(`/api/admin/returns/${returnId}/approve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          acceptedItemIds: acceptedIds,
          inspectionNotes: notes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        setError((await res.text().catch(() => "")) || `Failed (${res.status})`);
        return;
      }
      toast.show("Return approved — refund issued.");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function reject() {
    setBusy("reject");
    setError(null);
    try {
      const res = await fetch(`/api/admin/returns/${returnId}/reject`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          rejectionReason: rejectionReason.trim(),
          inspectionNotes: notes.trim(),
        }),
      });
      if (!res.ok) {
        setError((await res.text().catch(() => "")) || `Failed (${res.status})`);
        return;
      }
      toast.show("Return rejected — customer notified.");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <table className="w-full text-sm">
        <thead className="text-xs uppercase text-neutral-500">
          <tr>
            <th className="text-left">Item</th>
            <th className="text-right">Qty</th>
            <th className="text-left w-48 pl-6">Disposition</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id} className="border-t border-neutral-100 align-top">
              <td className="py-2">
                {it.productName}{" "}
                <span className="text-neutral-500">({it.size})</span>
              </td>
              <td className="py-2 text-right">{it.quantity}</td>
              <td className="py-2 pl-6">
                <RadioGroup
                  name={`disp-${it.id}`}
                  value={accepted[it.id] ? "accept" : "reject"}
                  onChange={(v) =>
                    setAccepted((a) => ({ ...a, [it.id]: v === "accept" }))
                  }
                  options={[
                    { value: "accept", label: "Accept" },
                    { value: "reject", label: "Reject" },
                  ]}
                  className="flex-row gap-4"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div>
        <label
          htmlFor="inspection-notes"
          className="block text-xs uppercase tracking-wider text-neutral-600 mb-1"
        >
          Inspection notes
        </label>
        <Textarea
          id="inspection-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Anything the customer should know — condition, missing tags, partial refund justification…"
        />
      </div>

      <div>
        <label
          htmlFor="rejection-reason"
          className="block text-xs uppercase tracking-wider text-neutral-600 mb-1"
        >
          Rejection reason{" "}
          <span className="text-neutral-400 normal-case">
            (required to reject the entire return)
          </span>
        </label>
        <Input
          id="rejection-reason"
          value={rejectionReason}
          onChange={(e) => setRejectionReason(e.target.value)}
          placeholder="Items damaged in transit / outside policy"
        />
      </div>

      <div className="flex flex-wrap gap-3 items-center pt-2">
        <Button
          size="md"
          variant="primary"
          disabled={busy !== null}
          onClick={tryApprove}
        >
          {busy === "approve" ? "Approving…" : "Approve & refund"}
        </Button>
        <Button
          size="md"
          variant="outline"
          disabled={busy !== null}
          onClick={tryReject}
        >
          {busy === "reject" ? "Rejecting…" : "Reject"}
        </Button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>

      <ConfirmDialog
        open={confirm === "approve"}
        onCancel={() => setConfirm(null)}
        onConfirm={approve}
        title="Approve return?"
        description={
          <>
            <p>
              Approve <strong>{acceptedCount}</strong> item(s) and refund the
              customer. This action cannot be undone.
            </p>
            <p className="mt-2 text-neutral-600">
              The order moves to RETURNED and a refund event is recorded against
              Stripe immediately.
            </p>
          </>
        }
        confirmLabel="Approve & refund"
      />
      <ConfirmDialog
        open={confirm === "reject"}
        onCancel={() => setConfirm(null)}
        onConfirm={reject}
        title="Reject return?"
        description={
          <>
            <p>
              Reject this return — no refund will be issued. The customer is
              emailed the rejection reason.
            </p>
          </>
        }
        confirmLabel="Reject"
        destructive
      />
    </div>
  );
}
