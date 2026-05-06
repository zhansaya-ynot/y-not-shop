'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Drawer } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { QuantityStepper } from '@/components/ui/quantity-stepper';
import { useCartStore } from '@/lib/stores/cart-store';
import { formatPrice } from '@/lib/format';

export function CartDrawer() {
  const isOpen = useCartStore((s) => s.isOpen);
  const close = useCartStore((s) => s.closeDrawer);
  // Read snapshot as a whole to avoid creating new array references on each render
  const snapshot = useCartStore((s) => s.snapshot);
  const removeItem = useCartStore((s) => s.removeItem);
  const setQuantity = useCartStore((s) => s.setQuantity);

  const items = snapshot?.items ?? [];
  const subtotalCents = snapshot?.subtotalCents ?? 0;

  return (
    <Drawer open={isOpen} onClose={close} side="right" title="Your Bag">
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-6 px-6 py-16 text-center">
          <p className="text-[14px] text-foreground-secondary">
            Your bag is empty
          </p>
          <Link href="/collection/jackets" onClick={close}>
            <Button variant="outline" size="md">
              Continue shopping
            </Button>
          </Link>
        </div>
      ) : (
        <div className="flex h-full flex-col">
          <ul className="flex-1 divide-y divide-border-light overflow-y-auto">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex gap-4 p-5"
              >
                <div className="relative h-24 w-20 flex-shrink-0 bg-surface-secondary">
                  <Image
                    src={item.productImage}
                    alt={item.productName}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                </div>
                <div className="flex flex-1 flex-col justify-between">
                  <div>
                    <p className="text-[13px] font-medium text-foreground-primary">
                      {item.productName}
                    </p>
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
                      onChange={(q) => {
                        // Pressing − at qty=1 removes the line so the button
                        // never feels dead — common pattern in checkout UIs.
                        if (q < 1) {
                          removeItem(item.id);
                          return;
                        }
                        setQuantity(item.id, q);
                      }}
                      min={0}
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
          <div className="border-t border-border-light p-5 space-y-3">
            <div className="flex justify-between text-[13px]">
              <span className="text-foreground-secondary">Subtotal</span>
              <span className="font-medium">{formatPrice(subtotalCents, 'GBP')}</span>
            </div>
            <div className="flex justify-between text-[13px]">
              <span className="text-foreground-secondary">Shipping</span>
              <span className="font-medium">Free</span>
            </div>
            <Link href="/checkout/shipping" onClick={close} className="block">
              <Button fullWidth size="lg">
                Checkout
              </Button>
            </Link>
            <p className="text-center text-[11px] uppercase tracking-[0.2em] text-foreground-tertiary">
              Secure checkout
            </p>
          </div>
        </div>
      )}
    </Drawer>
  );
}
