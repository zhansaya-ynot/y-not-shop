import * as React from "react";
import { cn } from "@/lib/cn";
import type { Size } from "@/lib/schemas";

// Canonical small-to-large order. Whatever order the API hands us — we
// always render XS → S → M → L → XL so the picker is never out of sequence
// (operator was seeing 'XS XL S L M' on a recent product because variants
// were inserted in a non-deterministic order in the DB).
const SIZE_ORDER: Size[] = ["XS", "S", "M", "L", "XL"];

function sortSizes(sizes: Size[]): Size[] {
  return [...sizes].sort(
    (a, b) => SIZE_ORDER.indexOf(a) - SIZE_ORDER.indexOf(b),
  );
}

export interface SizeSelectorProps {
  sizes: Size[];
  value: Size | null;
  onChange: (size: Size) => void;
  stock: Partial<Record<Size, number>>;
  /** When true, sold-out sizes are still selectable (used for pre-order) */
  allowSoldOut?: boolean;
  className?: string;
}

export function SizeSelector({
  sizes,
  value,
  onChange,
  stock,
  allowSoldOut = false,
  className,
}: SizeSelectorProps) {
  const ordered = React.useMemo(() => sortSizes(sizes), [sizes]);
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {ordered.map((s) => {
        const inStock = (stock[s] ?? 0) > 0;
        const disabled = !inStock && !allowSoldOut;
        const selected = value === s;
        return (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            disabled={disabled}
            aria-label={`Size ${s}${selected ? ", selected" : ""}${
              !inStock ? ", out of stock" : ""
            }`}
            aria-pressed={selected}
            className={cn(
              "h-11 min-w-11 px-3 border text-[13px] font-medium",
              "transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground-primary",
              selected
                ? "border-foreground-primary bg-foreground-primary text-foreground-inverse"
                : "border-border-dark bg-surface-primary text-foreground-primary hover:border-foreground-primary",
              disabled && "opacity-30 line-through cursor-not-allowed hover:border-border-dark",
            )}
          >
            {s}
          </button>
        );
      })}
    </div>
  );
}
