'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { Container } from '@/components/ui/container';
import { Section } from '@/components/ui/section';
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

  if (!order) return <Section padding="md"><Container>Loading…</Container></Section>;

  const stillPending = order.status === 'PENDING_PAYMENT' && tries >= 20;

  return (
    <Section padding="md">
      <Container size="wide">
        <h1 className="text-3xl font-bold mb-2">Order {order.orderNumber}</h1>
        <p className="mb-8">
          {order.status === 'NEW' && 'Payment received! We\'ll email you when it ships.'}
          {order.status === 'PAYMENT_FAILED' && 'Payment didn\'t go through. Please try again.'}
          {order.status === 'PENDING_PAYMENT' && !stillPending && 'Confirming your payment…'}
          {stillPending && 'We\'re still confirming your payment — check your email.'}
        </p>
        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <h2 className="text-xl font-semibold mb-4">Items</h2>
            <ul className="space-y-2">
              {order.items.map((it) => (
                <li key={it.id} className="flex justify-between">
                  <span>{it.productName} — {it.colour} / {it.size} × {it.quantity}</span>
                  <span>{formatPrice(it.unitPriceCents * it.quantity, 'GBP')}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 pt-4 border-t flex justify-between font-semibold">
              <span>Total</span>
              <span>{formatPrice(order.totalCents, 'GBP')}</span>
            </div>
          </div>
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-2">Shipping to</h2>
              <p>{order.shipping.firstName} {order.shipping.lastName}</p>
              <p>{order.shipping.line1}</p>
              <p>{order.shipping.city} {order.shipping.postcode}</p>
              <p>{order.shipping.country}</p>
            </div>
            {order.isGuestOrder && order.status === 'NEW' && (
              <ClaimAccountForm orderId={order.id} />
            )}
          </div>
        </div>
      </Container>
    </Section>
  );
}
