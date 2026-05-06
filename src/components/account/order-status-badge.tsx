import * as React from "react";
import { cn } from "@/lib/cn";
import type { OrderStatus } from "@/lib/schemas";

const palette: Record<OrderStatus, string> = {
  pending_payment: "bg-accent-warm/20 text-accent-warm",
  payment_failed: "bg-error/15 text-error",
  new: "bg-surface-secondary text-foreground-on-cream",
  processing: "bg-accent-warm/20 text-accent-warm",
  partially_shipped: "bg-foreground-secondary/15 text-foreground-secondary",
  shipped: "bg-foreground-primary text-foreground-inverse",
  partially_delivered: "bg-success/15 text-success",
  delivered: "bg-success/15 text-success",
  returned: "bg-error/15 text-error",
  cancelled: "bg-foreground-tertiary/20 text-foreground-tertiary",
};

const labels: Record<OrderStatus, string> = {
  pending_payment: "Pending payment",
  payment_failed: "Payment failed",
  new: "New",
  processing: "Processing",
  partially_shipped: "Partially shipped",
  shipped: "In transit",
  partially_delivered: "Partially delivered",
  delivered: "Delivered",
  returned: "Returned",
  cancelled: "Cancelled",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const tone = palette[status] ?? palette.new;
  const label = labels[status] ?? status;
  return (
    <span
      className={cn(
        "inline-flex items-center px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em]",
        tone,
      )}
    >
      {label}
    </span>
  );
}
