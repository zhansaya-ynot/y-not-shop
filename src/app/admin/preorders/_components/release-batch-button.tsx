"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";

interface Props {
  batchId: string;
  batchName: string;
  paidOrderCount: number;
  /** Batch is already in SHIPPING state — button becomes 'Retry labels'. */
  alreadyShipping?: boolean;
}

interface ReleaseResult {
  shipmentId: string;
  status: string;
  message: string | null;
}

export function ReleaseBatchButton({ batchId, batchName, paidOrderCount, alreadyShipping }: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [results, setResults] = React.useState<ReleaseResult[] | null>(null);

  const closeable = !pending;

  function reset() {
    setError(null);
    setResults(null);
  }

  async function release() {
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

  const okCount = results?.filter((r) => r.status === "ok").length ?? 0;
  const failCount = results ? results.length - okCount : 0;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          reset();
          setOpen(true);
        }}
        className="px-3 py-1.5 bg-foreground-primary text-foreground-inverse text-[11px] font-semibold uppercase tracking-wider rounded"
      >
        {alreadyShipping ? "Retry labels" : "Release for shipping"}
      </button>

      <Modal
        open={open}
        onClose={() => closeable && setOpen(false)}
        title={alreadyShipping ? "Retry label generation" : "Release batch for shipping"}
      >
        {!results ? (
          <>
            <p className="text-[14px] text-foreground-primary mb-2">
              Release <strong>{batchName}</strong>?
            </p>
            <p className="text-[13px] text-foreground-secondary mb-6">
              This marks the batch as <em>Shipping</em> and creates carrier
              labels for{" "}
              <strong>
                {paidOrderCount} paid order{paidOrderCount === 1 ? "" : "s"}
              </strong>
              . Customers receive their tracking emails automatically. The
              action can&rsquo;t be undone.
            </p>

            {error && (
              <p className="text-[13px] text-error mb-4">{error}</p>
            )}

            {paidOrderCount === 0 && (
              <p className="text-[13px] text-accent-warm mb-4">
                No paid orders in this batch yet — release will mark the batch
                as Shipping but won&rsquo;t produce any labels.
              </p>
            )}

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="px-5 py-2 border border-border-dark text-[12px] font-semibold uppercase tracking-[0.2em] hover:bg-surface-secondary disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={release}
                disabled={pending}
                className="px-5 py-2 bg-foreground-primary text-foreground-inverse text-[12px] font-semibold uppercase tracking-[0.2em] hover:bg-foreground-secondary disabled:opacity-50"
              >
                {pending ? "Releasing…" : "Release"}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-[14px] text-foreground-primary mb-3">
              {failCount === 0
                ? `Released — ${okCount} / ${results.length} labels generated.`
                : `Released with ${failCount} failure${failCount === 1 ? "" : "s"}.`}
            </p>
            {failCount > 0 && (
              <ul className="text-[12px] text-foreground-secondary mb-4 max-h-40 overflow-y-auto space-y-1">
                {results
                  .filter((r) => r.status !== "ok")
                  .map((r) => (
                    <li key={r.shipmentId}>
                      <span className="font-mono">{r.shipmentId.slice(0, 8)}</span>
                      {": "}
                      <span className="text-error">{r.message ?? "failed"}</span>
                    </li>
                  ))}
              </ul>
            )}
            <p className="text-[12px] text-foreground-secondary mb-6">
              You can retry failed shipments individually from each
              order&rsquo;s detail page (Retry label).
            </p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-5 py-2 bg-foreground-primary text-foreground-inverse text-[12px] font-semibold uppercase tracking-[0.2em] hover:bg-foreground-secondary"
              >
                Done
              </button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
