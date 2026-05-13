'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Container } from '@/components/ui/container';
import { Section } from '@/components/ui/section';
import { Button } from '@/components/ui/button';
import { QuantityStepper } from '@/components/ui/quantity-stepper';
import { useCartStore } from '@/lib/stores/cart-store';
import { formatPrice } from '@/lib/format';

export default function CartPage() {
  const items = useCartStore((s) => s.snapshot?.items ?? []);
  const subtotalCents = useCartStore((s) => s.snapshot?.subtotalCents ?? 0);
  const itemCount = useCartStore((s) => s.snapshot?.itemCount ?? 0);
  const removeItem = useCartStore((s) => s.removeItem);
  const setQuantity = useCartStore((s) => s.setQuantity);
  const isLoading = useCartStore((s) => s.isLoading);

  React.useEffect(() => {
    useCartStore.getState().hydrate();
  }, []);

  if (isLoading) {
    return (
      <Section padding="md">
        <Container size="narrow" className="text-center py-16">
          <p className="text-foreground-secondary">Loading your bag…</p>
        </Container>
      </Section>
    );
  }

  if (itemCount === 0) {
    return (
      <Section padding="md">
        <Container size="narrow" className="text-center py-16">
          <h1 className="font-heading text-[36px] mb-4">Your bag is empty</h1>
          <p className="text-[14px] text-foreground-secondary mb-8">
            Looks like you haven&apos;t added anything yet.
          </p>
          <Link href="/shop">
            <Button variant="outline" size="md">Continue shopping</Button>
          </Link>
        </Container>
      </Section>
    );
  }

  return (
    <Section padding="md">
      <Container size="wide">
        <h1 className="font-heading text-[36px] mb-8">Your Bag</h1>
        <div className="grid gap-12 md:grid-cols-[1fr_360px]">
          <ul className="divide-y divide-border-light">
            {items.map((item) => (
              <li key={item.id} className="flex gap-4 py-6">
                <div className="relative h-28 w-22 flex-shrink-0 bg-surface-secondary">
                  <Image
                    src={item.productImage}
                    alt={item.productName}
                    fill
                    sizes="88px"
                    className="object-cover"
                  />
                </div>
                <div className="flex flex-1 flex-col justify-between">
                  <div>
                    <p className="text-[14px] font-medium">{item.productName}</p>
                    <p className="text-[12px] text-foreground-secondary">
                      {item.colour} · Size {item.size}
                    </p>
                    {item.isPreorder && (
                      <p className="text-[11px] uppercase tracking-[0.15em] text-accent-warm mt-1">
                        Pre-order — ships in 4-6 weeks
                      </p>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <QuantityStepper
                      value={item.quantity}
                      onChange={(q) => setQuantity(item.id, q)}
                      min={1}
                      // Pre-order items bypass the live stockAvailable cap
                      // (zero stock is allowed); cap at a generous 20.
                      max={item.isPreorder ? 20 : item.stockAvailable}
                    />
                    <p className="text-[13px] font-medium">
                      {formatPrice(item.unitPriceCents * item.quantity, 'GBP')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="self-start text-[11px] uppercase tracking-[0.2em] text-foreground-secondary hover:text-foreground-primary"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <aside className="border border-border-light p-6 bg-surface-primary h-fit">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.25em] text-foreground-secondary mb-4">
              Order summary
            </h3>
            <div className="space-y-2 text-[13px]">
              <div className="flex justify-between">
                <span className="text-foreground-secondary">Subtotal ({itemCount} items)</span>
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
            <Link href="/checkout/shipping" className="block mt-6">
              <Button fullWidth size="lg">Checkout</Button>
            </Link>
            <p className="text-center text-[11px] uppercase tracking-[0.2em] text-foreground-tertiary mt-3">
              Secure checkout
            </p>
          </aside>
        </div>
      </Container>
    </Section>
  );
}
