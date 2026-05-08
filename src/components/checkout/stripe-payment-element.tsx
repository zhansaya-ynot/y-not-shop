'use client';

import * as React from 'react';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { getStripe } from '@/lib/stripe-client';
import type { ShippingAddressT } from '@/lib/schemas/checkout';

interface Props {
  clientSecret: string;
  orderId: string;
  totalLabel: string;
  /** Shipping address used as the default billing address — passed to
   *  Stripe's PaymentElement so the customer doesn't enter address fields
   *  twice. Optional only because /checkout/resume can re-use this
   *  component without the store value (the resumed PaymentIntent already
   *  carries an address). */
  shippingAddress?: ShippingAddressT | null;
}

export function StripePaymentElement(props: Props) {
  const stripePromise = React.useMemo(() => getStripe(), []);
  return (
    <Elements stripe={stripePromise} options={{ clientSecret: props.clientSecret, appearance: { theme: 'stripe' } }}>
      <PayForm
        orderId={props.orderId}
        totalLabel={props.totalLabel}
        shippingAddress={props.shippingAddress}
      />
    </Elements>
  );
}

function PayForm({
  orderId,
  totalLabel,
  shippingAddress,
}: {
  orderId: string;
  totalLabel: string;
  shippingAddress?: ShippingAddressT | null;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  // Pre-fill billing details from the shipping address so PaymentElement
  // can skip the billing fields entirely (we tell Stripe never to render
  // them via fields.billingDetails). Memoised to avoid spurious Element
  // re-renders that throw 'cannot change defaultValues after mount'.
  const defaultValues = React.useMemo(() => {
    if (!shippingAddress) return undefined;
    return {
      billingDetails: {
        name: `${shippingAddress.firstName} ${shippingAddress.lastName}`.trim(),
        email: shippingAddress.email,
        phone: shippingAddress.phone,
        address: {
          line1: shippingAddress.line1,
          line2: shippingAddress.line2 ?? '',
          city: shippingAddress.city,
          postal_code: shippingAddress.postcode,
          country: shippingAddress.countryCode,
          state: '',
        },
      },
    };
  }, [shippingAddress]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);
    // When fields.billingDetails === 'never' Stripe REQUIRES the customer's
    // name + address inside confirmParams.payment_method_data.billing_details
    // — otherwise it throws an IntegrationError at confirmPayment time.
    // defaultValues populates the rendered UI but is NOT what gets sent.
    const billingDetails = shippingAddress
      ? {
          name: `${shippingAddress.firstName} ${shippingAddress.lastName}`.trim(),
          email: shippingAddress.email,
          phone: shippingAddress.phone,
          address: {
            line1: shippingAddress.line1,
            line2: shippingAddress.line2 ?? '',
            city: shippingAddress.city,
            postal_code: shippingAddress.postcode,
            country: shippingAddress.countryCode,
            state: '',
          },
        }
      : undefined;
    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/checkout/success/${orderId}`,
        ...(billingDetails
          ? { payment_method_data: { billing_details: billingDetails } }
          : {}),
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
        options={{
          defaultValues,
          // Don't ask for billing again — the shipping address from the
          // previous step is reused as billing. Cleaner UX, fewer fields,
          // and matches what the founder asked for.
          fields: { billingDetails: 'never' },
        }}
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
