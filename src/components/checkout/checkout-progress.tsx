import * as React from "react";
import { cn } from "@/lib/cn";

const STEPS = [
  { num: 1, label: "Shipping" },
  { num: 2, label: "Payment" },
  { num: 3, label: "Confirmation" },
] as const;

export interface CheckoutProgressProps {
  current: 1 | 2 | 3;
}

/**
 * Three-step progress indicator. On mobile the row was overflowing the
 * viewport because the labels spelled out (CONFIRMATION) plus the long
 * separators didn't fit at 390px. Drop the connector width on phones,
 * shrink the gap, scale the label slightly, and make the whole row
 * horizontally scrollable as a final safety net so the layout never
 * breaks the surrounding container even if the brand renames a step.
 */
export function CheckoutProgress({ current }: CheckoutProgressProps) {
  return (
    <ol className="flex items-center gap-2 md:gap-6 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {STEPS.map((s, i) => {
        const active = current === s.num;
        const done = s.num < current;
        return (
          <React.Fragment key={s.num}>
            <li className="flex items-center gap-2 md:gap-3 shrink-0">
              <span
                className={cn(
                  "flex h-6 w-6 md:h-7 md:w-7 items-center justify-center rounded-full text-[11px] md:text-[12px] font-semibold",
                  active && "bg-foreground-primary text-foreground-inverse",
                  done && "bg-foreground-primary text-foreground-inverse",
                  !active && !done && "border border-border-dark text-foreground-secondary",
                )}
              >
                {done ? "✓" : s.num}
              </span>
              <span
                className={cn(
                  "text-[10px] md:text-[12px] uppercase tracking-[0.15em] md:tracking-[0.2em]",
                  active ? "text-foreground-primary" : "text-foreground-secondary",
                )}
              >
                {s.label}
              </span>
            </li>
            {i < STEPS.length - 1 && (
              <span aria-hidden className="h-px w-3 md:w-12 shrink-0 bg-border-dark" />
            )}
          </React.Fragment>
        );
      })}
    </ol>
  );
}
