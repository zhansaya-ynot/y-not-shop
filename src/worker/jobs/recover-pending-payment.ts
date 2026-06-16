import type Stripe from 'stripe';
import { prisma } from '@/server/db/client';
import { stripe as defaultStripe } from '@/server/checkout/stripe';
import { updateStatus } from '@/server/orders/service';

/** Stripe surface this job actually touches — keeps tests free of the SDK. */
export interface PaymentIntentsLike {
  cancel: (id: string) => Promise<unknown>;
}

export interface RecoverPendingPaymentDeps {
  stripe?: { paymentIntents: PaymentIntentsLike };
}

const PENDING_PAYMENT_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour

/**
 * Recover Orders that have been stuck in PENDING_PAYMENT for >1h:
 *
 * - Restocks every OrderItem (reverses the Phase 4 checkout decrement).
 * - Best-effort cancels the associated Stripe PaymentIntent so abandoned
 *   payments never auto-capture.
 * - Transitions Order → CANCELLED with a recovery note.
 *
 * Stripe cancel errors are swallowed — Stripe's `payment_intent_unexpected_state`
 * is the common one and means we already lost the race; the cancellation still
 * proceeds locally. Returns the count of recovered orders so the cron loop can
 * log it.
 *
 * Idempotent: the status filter (`PENDING_PAYMENT`) excludes already-recovered
 * rows on the next tick.
 */
export async function recoverPendingPayments(
  deps: RecoverPendingPaymentDeps = {},
): Promise<{ recovered: number }> {
  const stripe = deps.stripe ?? (defaultStripe as unknown as { paymentIntents: PaymentIntentsLike });
  const cutoff = new Date(Date.now() - PENDING_PAYMENT_TIMEOUT_MS);

  const stuck = await prisma.order.findMany({
    where: { status: 'PENDING_PAYMENT', createdAt: { lt: cutoff } },
    include: { items: true, payment: true },
  });

  for (const order of stuck) {
    await prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        if (item.productId) {
          await tx.productSize.update({
            where: {
              productId_size_colour: {
                productId: item.productId,
                size: item.size,
                colour: item.colour,
              },
            },
            data: { stock: { increment: item.quantity } },
          });
        }
      }
    });

    if (order.payment?.stripePaymentIntentId) {
      try {
        await stripe.paymentIntents.cancel(order.payment.stripePaymentIntentId);
      } catch (err) {
        process.stderr.write(
          `[worker] stripe.paymentIntents.cancel failed for order ${order.id}: ${
            err instanceof Error ? err.message : String(err)
          }\n`,
        );
      }
    }

    await updateStatus(order.id, 'CANCELLED', 'recovery cron — payment timeout');
  }

  return { recovered: stuck.length };
}

// Re-export the Stripe type for consumers that need the structural shape.
export type { Stripe };
