'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Container } from '@/components/ui/container';
import { Section } from '@/components/ui/section';
import { CheckoutProgress } from '@/components/checkout/checkout-progress';
import { StripePaymentElement } from '@/components/checkout/stripe-payment-element';
import { formatPrice } from '@/lib/format';

interface ResumeData {
  orderId: string;
  clientSecret: string;
  totalCents: number;
  currency: string;
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
          // Already paid, cancelled, or shipped — bounce to the detail page.
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
        <div className="mt-12 max-w-xl">
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
      </Container>
    </Section>
  );
}
