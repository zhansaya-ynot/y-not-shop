import * as React from "react";
import { Display } from "@/components/ui/typography";
import { formatPrice } from "@/lib/format";
import { PREORDER_SHIPS_IN } from "@/lib/preorder";

export interface ProductInfoPanelProps {
  name: string;
  price: number;
  /**
   * When true, renders the pre-order eyebrow above the product name
   * (Phase 5 task 97 / spec §9). The lead time itself lives in
   * `PREORDER_LEAD_WEEKS` — Google reads this page to check the feed's
   * `availability_date`, so the two must agree.
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
            {`Pre-order — ${PREORDER_SHIPS_IN}`}
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
