'use client';

import * as React from 'react';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { getStripe } from '@/lib/stripe-client';

interface Props {
  clientSecret: string;
  orderId: string;
  totalLabel: string;
}

export function StripePaymentElement(props: Props) {
  const stripePromise = React.useMemo(() => getStripe(), []);
  return (
    <Elements stripe={stripePromise} options={{ clientSecret: props.clientSecret, appearance: { theme: 'stripe' } }}>
      <PayForm orderId={props.orderId} totalLabel={props.totalLabel} />
    </Elements>
  );
}

function PayForm({ orderId, totalLabel }: { orderId: string; totalLabel: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);
    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/checkout/success/${orderId}`,
      },
    });
    if (stripeError) {
      setError(stripeError.message ?? 'Payment failed');
      setSubmitting(false);
    }
    // On success Stripe redirects to return_url before this resolves.
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement
        onChange={() => {
          // Stripe surfaces validation copy via stripeError above; clear it
          // as soon as the customer touches the form so the previous "select
          // a payment method" error doesn't linger after they've fixed it.
          if (error) setError(null);
        }}
      />
      {error && <p className="text-[13px] text-error">{error}</p>}
      <button
        type="submit"
        disabled={!stripe || submitting}
        className="inline-flex w-full items-center justify-center bg-foreground-primary text-foreground-inverse px-8 py-4 text-[12px] font-semibold uppercase tracking-[0.25em] hover:bg-foreground-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {submitting ? 'Processing…' : `Pay ${totalLabel}`}
      </button>
    </form>
  );
}
