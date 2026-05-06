'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Container } from '@/components/ui/container';
import { Section } from '@/components/ui/section';
import { CheckoutProgress } from '@/components/checkout/checkout-progress';
import { ClaimAccountForm } from '@/components/checkout/claim-account-form';
import { formatPrice } from '@/lib/format';
import { useCartStore } from '@/lib/stores/cart-store';
import { useCheckoutStore } from '@/lib/stores/checkout-store';

interface OrderView {
  id: string;
  orderNumber: string;
  status: string;
  totalCents: number;
  currency: 'GBP';
  carrier: string;
  items: Array<{ id: string; productName: string; size: string; colour: string; quantity: number; unitPriceCents: number }>;
  isGuestOrder: boolean;
  shipping: { firstName: string; lastName: string; line1: string; city: string; postcode: string; country: string; phone: string };
  createdAt: string;
}

export default function CheckoutSuccessPage() {
  const params = useParams();
  const orderId = (Array.isArray(params.id) ? params.id[0] : params.id) ?? '';
  const [order, setOrder] = React.useState<OrderView | null>(null);
  const [tries, setTries] = React.useState(0);
  const clearCart = useCartStore((s) => s.clear);
  const resetCheckout = useCheckoutStore((s) => s.reset);

  // Clearing the cart + checkout-store on success means the next bag drawer
  // open shows empty (matches reality — items just shipped) and re-opening
  // /checkout/shipping won't pre-fill stale address data from the last buy.
  // Server-side clear runs once; local store reset is fire-and-forget.
  React.useEffect(() => {
    clearCart();
    resetCheckout();
  }, [clearCart, resetCheckout]);

  React.useEffect(() => {
    let cancelled = false;
    async function poll() {
      const res = await fetch(`/api/orders/${orderId}`, { credentials: 'include' });
      if (!res.ok) return;
      const json = (await res.json()) as OrderView;
      if (cancelled) return;
      setOrder(json);
      if (json.status === 'PENDING_PAYMENT' && tries < 20) {
        setTimeout(() => setTries((t) => t + 1), 1500);
      }
    }
    poll();
    return () => { cancelled = true; };
  }, [orderId, tries]);

  if (!order) {
    return (
      <Section padding="md">
        <Container size="wide">
          <CheckoutProgress current={3} />
          <p className="mt-12 text-foreground-secondary">Loading…</p>
        </Container>
      </Section>
    );
  }

  const stillPending = order.status === 'PENDING_PAYMENT' && tries >= 20;
  const paid = order.status === 'NEW';
  const failed = order.status === 'PAYMENT_FAILED';

  return (
    <Section padding="md">
      <Container size="wide">
        <CheckoutProgress current={3} />

        <div className="mt-12 grid gap-12 md:grid-cols-[1fr_360px]">
          <div className="space-y-10">
            {/* Header — adapts copy to status */}
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-foreground-secondary mb-2">
                Order #{order.orderNumber}
              </p>
              <h1 className="text-3xl font-semibold tracking-tight mb-3">
                {paid && 'Thank you for your order'}
                {failed && 'Payment didn’t go through'}
                {!paid && !failed && !stillPending && 'Confirming your payment…'}
                {stillPending && 'Still confirming…'}
              </h1>
              <p className="text-[14px] text-foreground-secondary">
                {paid && 'We’ve emailed you a receipt and will follow up the moment your order ships.'}
                {failed && 'Your card was not charged. Please try again with a different payment method.'}
                {!paid && !failed && !stillPending &&
                  'Your card was charged a moment ago — we’re finalising the order in our system.'}
                {stillPending &&
                  'It’s taking a little longer than usual. Check the email confirmation we’ll send shortly.'}
              </p>
            </div>

            {/* Step 1 — Shipping (recap) */}
            <section>
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.25em] text-foreground-secondary mb-3">
                Step 1 · Shipping
              </h2>
              <p className="text-[14px] leading-relaxed">
                {order.shipping.firstName} {order.shipping.lastName}
                <br />
                {order.shipping.line1}
                <br />
                {order.shipping.city}, {order.shipping.postcode}
                <br />
                {order.shipping.country}
                <br />
                <span className="text-foreground-secondary">{order.shipping.phone}</span>
              </p>
            </section>

            {/* Step 2 — Payment status */}
            <section>
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.25em] text-foreground-secondary mb-3">
                Step 2 · Payment
              </h2>
              <p className="text-[14px]">
                {paid && (
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-block h-2 w-2 rounded-full bg-success" />
                    Paid · {formatPrice(order.totalCents, 'GBP')}
                  </span>
                )}
                {failed && (
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-block h-2 w-2 rounded-full bg-error" />
                    Payment failed
                  </span>
                )}
                {!paid && !failed && (
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-block h-2 w-2 rounded-full bg-accent-warm" />
                    Pending confirmation
                  </span>
                )}
              </p>
            </section>

            {/* Step 3 — What happens next */}
            <section>
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.25em] text-foreground-secondary mb-3">
                Step 3 · What’s next
              </h2>
              <ul className="space-y-2 text-[14px] text-foreground-secondary">
                <li>• Order confirmation email — already on the way.</li>
                <li>• Tracking link — emailed when your parcel ships ({order.carrier === 'royal-mail' ? 'Royal Mail' : 'DHL Express'}).</li>
                <li>• Delivery — typically 2–5 business days after dispatch.</li>
              </ul>
            </section>

            {order.isGuestOrder && paid && (
              <section className="border-t border-border-light pt-6">
                <ClaimAccountForm orderId={order.id} />
              </section>
            )}

            <div className="flex flex-wrap gap-4 border-t border-border-light pt-8">
              <Link
                href="/"
                className="inline-flex items-center justify-center bg-foreground-primary text-foreground-inverse px-8 py-3 text-[12px] font-semibold uppercase tracking-[0.2em] hover:bg-foreground-secondary transition-colors"
              >
                Continue shopping
              </Link>
              {paid && (
                <Link
                  href={`/account/orders/${order.id}`}
                  className="inline-flex items-center justify-center border border-border-dark px-8 py-3 text-[12px] font-semibold uppercase tracking-[0.2em] hover:bg-foreground-primary hover:text-foreground-inverse transition-colors"
                >
                  View order
                </Link>
              )}
              {failed && (
                <Link
                  href={`/checkout/resume/${order.id}`}
                  className="inline-flex items-center justify-center border border-border-dark px-8 py-3 text-[12px] font-semibold uppercase tracking-[0.2em] hover:bg-foreground-primary hover:text-foreground-inverse transition-colors"
                >
                  Try payment again
                </Link>
              )}
            </div>
          </div>

          {/* Right rail — order summary */}
          <aside className="border border-border-light p-6 bg-surface-primary h-fit">
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-foreground-secondary mb-4">
              Order summary
            </p>
            <ul className="divide-y divide-border-light mb-4">
              {order.items.map((it) => (
                <li key={it.id} className="flex justify-between gap-3 py-3 text-[13px]">
                  <div className="flex-1">
                    <p className="font-medium leading-tight">{it.productName}</p>
                    <p className="text-[12px] text-foreground-secondary mt-0.5">
                      {it.colour} · Size {it.size} · Qty {it.quantity}
                    </p>
                  </div>
                  <p className="whitespace-nowrap">
                    {formatPrice(it.unitPriceCents * it.quantity, 'GBP')}
                  </p>
                </li>
              ))}
            </ul>
            <div className="border-t border-border-light pt-3 flex justify-between font-semibold text-[14px]">
              <span>Total</span>
              <span>{formatPrice(order.totalCents, 'GBP')}</span>
            </div>
          </aside>
        </div>
      </Container>
    </Section>
  );
}
