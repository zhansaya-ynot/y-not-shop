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
 * Three-step progress indicator. Vertical stack on mobile (<md) so
 * 'CONFIRMATION' never overflows narrow viewports; horizontal row on
 * tablet+ as the desktop layout was originally designed.
 */
export function CheckoutProgress({ current }: CheckoutProgressProps) {
  return (
    <ol className="flex flex-col md:flex-row md:items-center gap-3 md:gap-6">
      {STEPS.map((s, i) => {
        const active = current === s.num;
        const done = s.num < current;
        return (
          <React.Fragment key={s.num}>
            <li className="flex items-center gap-3 shrink-0">
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-semibold",
                  active && "bg-foreground-primary text-foreground-inverse",
                  done && "bg-foreground-primary text-foreground-inverse",
                  !active && !done && "border border-border-dark text-foreground-secondary",
                )}
              >
                {done ? "✓" : s.num}
              </span>
              <span
                className={cn(
                  "text-[12px] uppercase tracking-[0.2em]",
                  active ? "text-foreground-primary" : "text-foreground-secondary",
                )}
              >
                {s.label}
              </span>
            </li>
            {i < STEPS.length - 1 && (
              <span
                aria-hidden
                // Vertical bar on mobile (sits in the icon column),
                // horizontal rule on tablet+ — visually mirrors the
                // stepper axis at each breakpoint.
                className="bg-border-dark ml-3 h-4 w-px md:ml-0 md:h-px md:w-12"
              />
            )}
          </React.Fragment>
        );
      })}
    </ol>
  );
}
