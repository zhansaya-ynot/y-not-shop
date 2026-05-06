"use client";

import * as React from "react";
import { Modal } from "./modal";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Style the confirm button as destructive (red). */
  destructive?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Brand confirm dialog. Drop-in replacement for `window.confirm()` —
 * matches the rest of admin instead of using the platform-native popup.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  pending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={() => !pending && onCancel()} title={title}>
      {description && (
        <div className="text-[14px] text-foreground-secondary mb-6">
          {description}
        </div>
      )}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="px-5 py-2 border border-border-dark text-[12px] font-semibold uppercase tracking-[0.2em] hover:bg-surface-secondary disabled:opacity-50"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending}
          className={
            destructive
              ? "px-5 py-2 bg-error text-foreground-inverse text-[12px] font-semibold uppercase tracking-[0.2em] hover:opacity-90 disabled:opacity-50"
              : "px-5 py-2 bg-foreground-primary text-foreground-inverse text-[12px] font-semibold uppercase tracking-[0.2em] hover:bg-foreground-secondary disabled:opacity-50"
          }
        >
          {pending ? "Working…" : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
