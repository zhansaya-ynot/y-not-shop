'use client';

import * as React from 'react';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Container } from '@/components/ui/container';
import { Section } from '@/components/ui/section';
import { CheckoutProgress } from '@/components/checkout/checkout-progress';
import { StripePaymentElement } from '@/components/checkout/stripe-payment-element';
import { formatPrice } from '@/lib/format';

interface ResumeItem {
  id: string;
  name: string;
  image: string;
  colour: string;
  size: string;
  quantity: number;
  unitPriceCents: number;
}

interface ResumeData {
  orderId: string;
  orderNumber: string;
  clientSecret: string;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  currency: string;
  items: ResumeItem[];
}

/**
 * Resume an unfinished payment for an existing order. Reuses the original
 * Stripe PaymentIntent rather than starting from cart, so customers who
 * abandoned the first checkout (or had a card declined) can pay without
 * re-entering shipping details.
 */
export default function CheckoutResumePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = React.useState<ResumeData | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await fetch(`/api/checkout/resume/${params.id}`, {
        credentials: 'include',
      });
      if (cancelled) return;
      if (r.status === 403) { router.push('/sign-in?next=/account/orders'); return; }
      if (r.status === 404) { setError('Order not found.'); return; }
      if (r.status === 409) {
        const j = await r.json().catch(() => ({}));
        if (j.error === 'NOT_PAYABLE') {
          router.replace(`/account/orders/${params.id}`);
          return;
        }
        setError('This order can no longer be paid online.');
        return;
      }
      if (!r.ok) { setError('Could not resume payment.'); return; }
      const json = (await r.json()) as ResumeData;
      setData(json);
    })();
    return () => { cancelled = true; };
  }, [params.id, router]);

  return (
    <Section padding="md">
      <Container size="wide">
        <CheckoutProgress current={2} />
        <div className="mt-12 grid gap-12 md:grid-cols-[1fr_360px]">
          <div>
            {error && (
              <div className="space-y-4">
                <p className="text-red-600">{error}</p>
                <Link
                  href="/account/orders"
                  className="inline-flex items-center justify-center border border-border-dark px-8 py-3 text-[12px] font-semibold uppercase tracking-[0.2em] hover:bg-foreground-primary hover:text-foreground-inverse transition-colors"
                >
                  Back to orders
                </Link>
              </div>
            )}
            {!error && !data && <p>Loading payment…</p>}
            {data && (
              <StripePaymentElement
                clientSecret={data.clientSecret}
                orderId={data.orderId}
                totalLabel={formatPrice(data.totalCents, data.currency as 'GBP')}
              />
            )}
          </div>
          {data && (
            <aside className="border border-border-light p-6 bg-surface-primary h-fit">
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-foreground-secondary mb-4">
                Order #{data.orderNumber}
              </p>
              <ul className="divide-y divide-border-light mb-4">
                {data.items.map((item) => (
                  <li key={item.id} className="flex gap-4 py-3">
                    <div className="relative h-20 w-16 flex-shrink-0 bg-surface-secondary">
                      <Image
                        src={item.image}
                        alt={item.name}
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    </div>
                    <div className="flex-1 text-[13px]">
                      <p className="font-medium leading-tight">{item.name}</p>
                      <p className="text-[12px] text-foreground-secondary mt-0.5">
                        {item.colour} · Size {item.size} · Qty {item.quantity}
                      </p>
                      <p className="mt-1">
                        {formatPrice(item.unitPriceCents * item.quantity, data.currency as 'GBP')}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="border-t border-border-light pt-3 space-y-1 text-[13px]">
                <div className="flex justify-between text-foreground-secondary">
                  <span>Subtotal</span>
                  <span>{formatPrice(data.subtotalCents, data.currency as 'GBP')}</span>
                </div>
                <div className="flex justify-between text-foreground-secondary">
                  <span>Shipping</span>
                  <span>
                    {data.shippingCents === 0
                      ? 'Free'
                      : formatPrice(data.shippingCents, data.currency as 'GBP')}
                  </span>
                </div>
                <div className="flex justify-between font-semibold pt-2">
                  <span>Total</span>
                  <span>{formatPrice(data.totalCents, data.currency as 'GBP')}</span>
                </div>
              </div>
            </aside>
          )}
        </div>
      </Container>
    </Section>
  );
}
