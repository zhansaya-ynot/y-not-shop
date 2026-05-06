'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Container } from '@/components/ui/container';
import { Section } from '@/components/ui/section';
import { CheckoutProgress } from '@/components/checkout/checkout-progress';
import { OrderSummaryCard } from '@/components/checkout/order-summary-card';
import { StripePaymentElement } from '@/components/checkout/stripe-payment-element';
import { useCheckoutStore } from '@/lib/stores/checkout-store';
import { useCartStore } from '@/lib/stores/cart-store';
import { formatPrice } from '@/lib/format';
import { CreateOrderResponse } from '@/lib/schemas/checkout';

export default function CheckoutPaymentPage() {
  const router = useRouter();
  const cart = useCartStore((s) => s.snapshot);
  const address = useCheckoutStore((s) => s.shippingAddress);
  const methodId = useCheckoutStore((s) => s.selectedMethodId);
  const quote = useCheckoutStore((s) => s.quote);
  const [order, setOrder] = React.useState<{ orderId: string; clientSecret: string } | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Guard against returning to this page after the order was already paid:
  // the cart is now empty, the previous clientSecret refers to a `succeeded`
  // PaymentIntent, and re-mounting <Elements> in that state used to throw
  // React #185. Bounce away early so we never reach the second effect.
  const cartEmpty = !cart || cart.items.length === 0;
  const checkoutMissing = !address || !methodId || !quote;
  React.useEffect(() => {
    if (cartEmpty) { router.push('/'); return; }
    if (checkoutMissing) { router.push('/checkout/shipping'); return; }
  }, [cartEmpty, checkoutMissing, router]);

  React.useEffect(() => {
    if (cartEmpty || checkoutMissing || !address || !methodId || order) return;
    (async () => {
      const res = await fetch('/api/checkout/create', {
        method: 'POST', credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ address, methodId }),
      });
      if (res.status === 409) {
        const j = await res.json();
        if (j.error === 'STOCK_CONFLICT') { router.push('/cart?error=stock'); return; }
        setError(j.message ?? 'Checkout error'); return;
      }
      if (!res.ok) { setError('Checkout error'); return; }
      const json = CreateOrderResponse.parse(await res.json());
      setOrder(json);
    })();
  }, [cartEmpty, checkoutMissing, address, methodId, order, router]);

  const selected = quote?.methods.find((m) => m.methodId === methodId);
  const totalCents = (cart?.subtotalCents ?? 0) - (cart?.discountCents ?? 0) + (selected?.totalCents ?? 0);
  const totalLabel = formatPrice(totalCents, 'GBP');

  return (
    <Section padding="md">
      <Container size="wide">
        <CheckoutProgress current={2} />
        <div className="mt-12 grid gap-12 md:grid-cols-[1fr_360px]">
          <div>
            {error && <p className="text-red-600 mb-4">{error}</p>}
            {order && <StripePaymentElement
              clientSecret={order.clientSecret}
              orderId={order.orderId}
              totalLabel={totalLabel}
            />}
            {!order && !error && <p>Preparing payment…</p>}
          </div>
          <OrderSummaryCard />
        </div>
      </Container>
    </Section>
  );
}
