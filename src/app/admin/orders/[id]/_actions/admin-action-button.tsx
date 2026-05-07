"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";

export interface AdminActionButtonProps {
  /** POST endpoint relative to the site root. */
  endpoint: string;
  /** Optional JSON body. */
  body?: unknown;
  /** Visible label. */
  children: React.ReactNode;
  /** When true, prompt(window.confirm) before sending. */
  confirmText?: string;
  /** Tailwind classes for the button (variant). */
  className?: string;
  /** Disable the button altogether (e.g. invalid state). */
  disabled?: boolean;
  /** Toast text on success. Defaults to "Done." */
  successToast?: string;
}

/**
 * Generic admin action POST button. Pattern:
 *   1. Optional `window.confirm`.
 *   2. `fetch(endpoint, { method: 'POST', ... })`.
 *   3. On success: `router.refresh()` so the server component re-runs and
 *      pulls the new state.
 *   4. On failure: surface the response body as a banner.
 *
 * Used by every order-detail action except manual-label (which needs a file
 * upload form).
 */
export function AdminActionButton({
  endpoint,
  body,
  children,
  confirmText,
  className,
  disabled,
  successToast = "Done.",
}: AdminActionButtonProps) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onClick() {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: body ? { "content-type": "application/json" } : {},
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        setError(text || `Request failed (${res.status})`);
        return;
      }
      toast.show(successToast);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        disabled={disabled || busy}
        onClick={onClick}
        className={
          className ??
          "px-3 py-1.5 text-xs uppercase tracking-wider rounded border border-neutral-300 bg-white hover:bg-neutral-100 disabled:opacity-50"
        }
      >
        {busy ? "Working…" : children}
      </button>
      {error && (
        <span className="text-xs text-red-600 max-w-sm">{error}</span>
      )}
    </span>
  );
}
