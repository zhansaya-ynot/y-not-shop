import * as React from "react";
import { Display } from "@/components/ui/typography";
import { formatPrice } from "@/lib/format";

export interface ProductInfoPanelProps {
  name: string;
  price: number;
  /**
   * When true, renders the "Pre-order — ships in 3 weeks" eyebrow above
   * the product name (Phase 5 task 97 / spec §9; shortened from 4-6 to
   * 3 weeks per Жансая 2026-05-19).
   */
  preOrder?: boolean;
  children?: React.ReactNode;
}

export function ProductInfoPanel({
  name,
  price,
  preOrder,
  children,
}: ProductInfoPanelProps) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        {preOrder && (
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent-warm mb-2">
            Pre-order — ships in 3 weeks
          </p>
        )}
        <Display level="md" as="h1">
          {name}
        </Display>
        <p className="mt-3 text-[18px] text-foreground-primary">
          {formatPrice(price, "GBP")}
        </p>
      </div>
      {children}
    </div>
  );
}
