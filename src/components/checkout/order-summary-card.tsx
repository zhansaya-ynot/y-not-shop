'use client';

import * as React from 'react';
import Image from 'next/image';
import { useCartStore } from '@/lib/stores/cart-store';
import { formatPrice } from '@/lib/format';

export function OrderSummaryCard() {
  // Read the snapshot directly. The `?? []` fallback can't live inside a
  // zustand selector — every render returns a fresh empty-array reference,
  // which zustand sees as a state change and triggers a re-render, which
  // returns another fresh array, ad infinitum (React #185).
  const snapshot = useCartStore((s) => s.snapshot);
  const items = snapshot?.items ?? [];
  const subtotalCents = snapshot?.subtotalCents ?? 0;

  return (
    <aside className="border border-border-light p-6 bg-surface-primary">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.25em] text-foreground-secondary mb-4">
        Order summary
      </h3>
      <ul className="divide-y divide-border-light">
        {items.map((item) => (
          <li key={item.id} className="flex gap-4 py-4">
            <div className="relative h-20 w-16 flex-shrink-0 bg-surface-secondary">
              <Image src={item.productImage} alt={item.productName} fill sizes="64px" className="object-cover" />
            </div>
            <div className="flex flex-1 flex-col justify-between">
              <p className="text-[13px] font-medium">{item.productName}</p>
              <p className="text-[12px] text-foreground-secondary">
                Size {item.size} · Qty {item.quantity}
              </p>
              <p className="text-[13px]">{formatPrice(item.unitPriceCents * item.quantity, 'GBP')}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-4 space-y-2 border-t border-border-light pt-4 text-[13px]">
        <div className="flex justify-between">
          <span className="text-foreground-secondary">Subtotal</span>
          <span>{formatPrice(subtotalCents, 'GBP')}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-foreground-secondary">Shipping</span>
          <span>Calculated at checkout</span>
        </div>
        <div className="flex justify-between border-t border-border-light pt-2 font-semibold">
          <span>Total</span>
          <span>{formatPrice(subtotalCents, 'GBP')}</span>
        </div>
      </div>
    </aside>
  );
}
