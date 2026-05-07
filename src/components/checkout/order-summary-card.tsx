'use client';

import * as React from 'react';
import Image from 'next/image';
import { useCartStore } from '@/lib/stores/cart-store';
import { useCheckoutStore } from '@/lib/stores/checkout-store';
import { formatPrice } from '@/lib/format';

export function OrderSummaryCard() {
  // Read the snapshot directly. The `?? []` fallback can't live inside a
  // zustand selector — every render returns a fresh empty-array reference,
  // which zustand sees as a state change and triggers a re-render, which
  // returns another fresh array, ad infinitum (React #185).
  const snapshot = useCartStore((s) => s.snapshot);
  const items = snapshot?.items ?? [];
  const subtotalCents = snapshot?.subtotalCents ?? 0;
  const discountCents = snapshot?.discountCents ?? 0;
  const promoCode = snapshot?.promo?.code ?? null;
  const applyPromo = useCartStore((s) => s.applyPromo);
  const removePromo = useCartStore((s) => s.removePromo);

  // Pick up the shipping cost from the checkout store so /payment shows the
  // actual line and the total reconciles with the Pay button. On /shipping
  // (no method selected yet) we still render the 'Calculated at checkout'
  // placeholder so the sidebar mirrors what the page can actually commit to.
  const quote = useCheckoutStore((s) => s.quote);
  const selectedMethodId = useCheckoutStore((s) => s.selectedMethodId);
  const selectedMethod = quote?.methods.find((m) => m.methodId === selectedMethodId) ?? null;
  const shippingCents = selectedMethod?.totalCents ?? null;

  const [code, setCode] = React.useState('');
  const [promoError, setPromoError] = React.useState<string | null>(null);
  const [promoPending, setPromoPending] = React.useState(false);

  async function handleApplyPromo(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setPromoError(null);
    setPromoPending(true);
    const r = await applyPromo(code.trim());
    setPromoPending(false);
    if (r.ok) {
      setCode('');
    } else {
      setPromoError(r.message ?? 'Invalid promo code.');
    }
  }

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
      <div className="mt-4 border-t border-border-light pt-4 space-y-3">
        {promoCode ? (
          <div className="flex items-center justify-between gap-3 border border-border-light px-3 py-2 text-[12px]">
            <span className="uppercase tracking-[0.15em]">{promoCode}</span>
            <button
              type="button"
              onClick={() => removePromo()}
              className="text-[11px] uppercase tracking-[0.2em] text-foreground-secondary hover:text-foreground-primary"
            >
              Remove
            </button>
          </div>
        ) : (
          <form onSubmit={handleApplyPromo} className="flex gap-2">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Promo code"
              className="flex-1 border border-border-light px-3 py-2 text-[13px] uppercase tracking-[0.1em] focus:outline-none focus:border-foreground-primary"
            />
            <button
              type="submit"
              disabled={!code.trim() || promoPending}
              className="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] bg-foreground-primary text-foreground-inverse disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {promoPending ? '…' : 'Apply'}
            </button>
          </form>
        )}
        {promoError && (
          <p className="text-[12px] text-error">{promoError}</p>
        )}
      </div>
      <div className="mt-4 space-y-2 border-t border-border-light pt-4 text-[13px]">
        <div className="flex justify-between">
          <span className="text-foreground-secondary">Subtotal</span>
          <span>{formatPrice(subtotalCents, 'GBP')}</span>
        </div>
        {discountCents > 0 && (
          <div className="flex justify-between">
            <span className="text-foreground-secondary">Discount</span>
            <span className="text-success">−{formatPrice(discountCents, 'GBP')}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-foreground-secondary">Shipping</span>
          <span>
            {shippingCents === null
              ? 'Calculated at checkout'
              : shippingCents === 0
                ? 'Free'
                : formatPrice(shippingCents, 'GBP')}
          </span>
        </div>
        <div className="flex justify-between border-t border-border-light pt-2 font-semibold">
          <span>Total</span>
          <span>{formatPrice(subtotalCents - discountCents + (shippingCents ?? 0), 'GBP')}</span>
        </div>
      </div>
    </aside>
  );
}
