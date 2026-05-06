"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

interface Props {
  batchId: string;
  batchName: string;
  paidOrderCount: number;
}

interface ReleaseResult {
  shipmentId: string;
  status: string;
  message: string | null;
}

export function ReleaseBatchButton({ batchId, batchName, paidOrderCount }: Props) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [results, setResults] = React.useState<ReleaseResult[] | null>(null);

  async function release() {
    if (paidOrderCount === 0) {
      setError("No paid orders in this batch yet — nothing to ship.");
      return;
    }
    const ok = window.confirm(
      `Release "${batchName}" for shipping?\n\nThis marks the batch as Shipping and creates carrier labels for ${paidOrderCount} paid order${paidOrderCount === 1 ? "" : "s"}. Customers will receive tracking emails automatically.`,
    );
    if (!ok) return;
    setPending(true);
    setError(null);
    setResults(null);
    const res = await fetch(`/api/admin/preorders/${batchId}/release`, {
      method: "POST",
    });
    setPending(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Release failed");
      return;
    }
    const json = (await res.json()) as { results: ReleaseResult[] };
    setResults(json.results);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={release}
        disabled={pending}
        className="px-3 py-1.5 bg-foreground-primary text-foreground-inverse text-[11px] font-semibold uppercase tracking-wider rounded disabled:opacity-50"
      >
        {pending ? "Releasing…" : "Release for shipping"}
      </button>
      {error && <p className="text-[12px] text-error">{error}</p>}
      {results && (
        <p className="text-[12px] text-success">
          {results.filter((r) => r.status === "ok").length} / {results.length}{" "}
          shipments labelled
        </p>
      )}
    </div>
  );
}
