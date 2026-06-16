import * as React from 'react';
import type Stripe from 'stripe';
import type { Shipment } from '@prisma/client';
import { stripe } from './stripe';
import { env } from '@/server/env';
import { prisma } from '@/server/db/client';
import { recordStripeEvent } from '@/server/repositories/stripe-event.repo';
import { sendTemplatedEmail } from '@/server/email/send';
import { getEmailService } from '@/server/email';
import type { EmailService } from '@/server/email';
import { OrderReceipt } from '@/emails/order-receipt';
import { updateStatus } from '@/server/orders/service';
import { sendNewOrderAlert } from '@/server/alerts/service';

export interface WebhookInput {
  rawBody: string;
  signature: string | null;
}

export interface WebhookResult {
  status: 200 | 400 | 500;
  body?: string;
}

/**
 * Dependencies for the webhook handler. All optional so callers (and tests)
 * can pass nothing and get production wiring; tests inject mocks for the
 * label-creation pipeline + email transport without exercising the real
 * carrier providers.
 */
export interface WebhookDeps {
  /**
   * Attempt label creation for one Shipment. Wraps `tryCreateShipment` from
   * `@/server/fulfilment/service` (Group H). Default returns `{ ok: false }`
   * — production callers must inject the real implementation, otherwise the
   * order will simply stay in NEW until the next worker tick picks it up.
   */
  tryCreateShipment?: (shipmentId: string) => Promise<{ ok: boolean }>;
  /** Override the email transport. */
  emailService?: EmailService;
}

export async function handleWebhook(
  input: WebhookInput,
  deps: WebhookDeps = {},
): Promise<WebhookResult> {
  if (!input.signature) return { status: 400, body: 'missing signature' };
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(input.rawBody, input.signature, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return { status: 400, body: 'invalid signature' };
  }

  const { alreadyProcessed } = await recordStripeEvent(
    event.id,
    event.type,
    event as unknown as import('@prisma/client').Prisma.InputJsonValue,
  );
  if (alreadyProcessed) return { status: 200 };

  switch (event.type) {
    case 'payment_intent.succeeded':
      await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent, deps);
      break;
    case 'payment_intent.payment_failed':
      await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
      break;
    case 'charge.refunded':
      await handleChargeRefunded(event.data.object as Stripe.Charge);
      break;
    default:
      // Unhandled events still get 200 so Stripe won't retry.
      break;
  }
  return { status: 200 };
}

async function handlePaymentSucceeded(
  pi: Stripe.PaymentIntent,
  deps: WebhookDeps,
): Promise<void> {
  // Phase 1: flip Order → NEW + Payment → CAPTURED inside a single transaction.
  // Returns false if the event is a replay (status already advanced) — caller
  // skips the post-tx side effects in that case to keep the handler idempotent.
  const orderId = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findFirst({ where: { stripePaymentIntentId: pi.id } });
    if (!payment) return null;
    const order = await tx.order.findUniqueOrThrow({ where: { id: payment.orderId } });
    if (order.status !== 'PENDING_PAYMENT') return null; // replay or already handled

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: 'NEW',
        events: { create: { status: 'NEW', note: 'Payment received' } },
      },
    });
    await tx.payment.update({ where: { id: payment.id }, data: { status: 'CAPTURED' } });

    if (order.promoCodeId) {
      await tx.promoCode.update({
        where: { id: order.promoCodeId },
        data: { usageCount: { increment: 1 } },
      });
      await tx.promoRedemption.create({
        data: {
          promoCodeId: order.promoCodeId,
          orderId: order.id,
          discountCents: order.discountCents,
        },
      });
    }

    // Mark guest user's email verified — receipt email implicitly confirms.
    if (order.userId) {
      await tx.user.update({
        where: { id: order.userId },
        data: { emailVerifiedAt: new Date() },
      });
    }
    return order.id;
  });
  if (!orderId) return;

  // Phase 2: post-payment side effects. Run *outside* the DB transaction so
  // a slow carrier API or email send can't hold rows locked.
  await fulfilOrderPostPayment(orderId, deps);
}

async function fulfilOrderPostPayment(orderId: string, deps: WebhookDeps): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { user: true, items: true },
  });
  if (!order) return;

  // 1. Try to create labels for every Shipment whose items are in stock.
  // `every: { isPreorder: false }` skips preorder-only shipments — those wait
  // for `releaseBatchForShipping` (Group M) before label creation.
  const shipments: Shipment[] = await prisma.shipment.findMany({
    where: {
      orderId: order.id,
      labelGeneratedAt: null,
      cancelledAt: null,
      items: { every: { isPreorder: false } },
    },
  });
  if (deps.tryCreateShipment) {
    for (const s of shipments) {
      try {
        await deps.tryCreateShipment(s.id);
      } catch (err) {
        // tryCreateShipment is supposed to swallow carrier errors and only
        // throw on programmer mistakes. Log and keep going so a single broken
        // shipment doesn't block the receipt email.
        process.stderr.write(
          `[checkout/webhook] tryCreateShipment(${s.id}) threw: ${
            err instanceof Error ? err.message : String(err)
          }\n`,
        );
      }
    }
  }

  // 2. Transition NEW → PROCESSING if at least one label was generated.
  const anyLabelGenerated = await prisma.shipment.count({
    where: { orderId: order.id, labelGeneratedAt: { not: null } },
  });
  if (anyLabelGenerated > 0) {
    try {
      await updateStatus(order.id, 'PROCESSING', 'label generated');
    } catch (err) {
      process.stderr.write(
        `[checkout/webhook] updateStatus PROCESSING failed for ${order.id}: ${
          err instanceof Error ? err.message : String(err)
        }\n`,
      );
    }
  }

  // 3. Send the OrderReceipt email. Customer email comes from the linked
  // User row (real account or ghost — both have an email).
  const recipient = order.user?.email ?? null;
  if (!recipient) return;

  const itemsInStock = order.items
    .filter((i) => !i.isPreorder)
    .map((i) => ({
      name: i.productName, size: i.size, qty: i.quantity, priceCents: i.unitPriceCents,
    }));
  const itemsPreorder = order.items
    .filter((i) => i.isPreorder)
    .map((i) => ({
      name: i.productName, size: i.size, qty: i.quantity, priceCents: i.unitPriceCents,
      // ETA defaults to 6 weeks until Group M wires actual batch ETAs.
      batchEtaWeeks: 6,
    }));

  const emailService = deps.emailService ?? getEmailService();
  try {
    await sendTemplatedEmail({
      service: emailService,
      to: recipient,
      subject: `Order ${order.orderNumber} confirmed`,
      component: React.createElement(OrderReceipt, {
        orderNumber: order.orderNumber,
        customerName: order.shipFirstName,
        totalCents: order.totalCents,
        currency: 'GBP',
        itemsInStock,
        itemsPreorder,
        shippingAddress: {
          line1: order.shipLine1,
          ...(order.shipLine2 ? { line2: order.shipLine2 } : {}),
          city: order.shipCity,
          postcode: order.shipPostcode,
          country: order.shipCountry,
        },
      }),
    });
  } catch (err) {
    process.stderr.write(
      `[checkout/webhook] OrderReceipt send failed for ${order.id}: ${
        err instanceof Error ? err.message : String(err)
      }\n`,
    );
  }

  // 4. Admin "New Order" notification — mirrors the legacy WordPress operator
  // email so Y Not Fashion's existing workflow keeps working. Failures are
  // logged but never thrown so they can't interfere with the customer-facing
  // receipt above or with the order being marked NEW/PROCESSING.
  try {
    await sendNewOrderAlert(order.id);
  } catch (err) {
    process.stderr.write(
      `[checkout/webhook] sendNewOrderAlert failed for ${order.id}: ${
        err instanceof Error ? err.message : String(err)
      }\n`,
    );
  }
}

async function handlePaymentFailed(pi: Stripe.PaymentIntent): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findFirst({ where: { stripePaymentIntentId: pi.id } });
    if (!payment) return;
    const order = await tx.order.findUniqueOrThrow({
      where: { id: payment.orderId }, include: { items: true },
    });
    if (order.status !== 'PENDING_PAYMENT') return;

    // Release stock.
    for (const item of order.items) {
      await tx.productSize.update({
        where: {
          productId_size_colour: {
            productId: item.productId!,
            size: item.size,
            colour: item.colour,
          },
        },
        data: { stock: { increment: item.quantity } },
      });
    }

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: 'PAYMENT_FAILED',
        events: { create: { status: 'PAYMENT_FAILED', note: pi.last_payment_error?.message ?? 'Payment failed' } },
      },
    });
    await tx.payment.update({ where: { id: payment.id }, data: { status: 'FAILED' } });
  });
}

/**
 * Stripe `charge.refunded` reconciles the Payment row with the actual amount
 * Stripe has refunded so far. Handles partial and full refunds; safe to
 * replay because we short-circuit when no drift exists.
 *
 * Order status is only flipped → RETURNED when the refund covers the full
 * captured amount. Already-CANCELLED orders are skipped (admin cancel
 * already drove their lifecycle). PENDING_PAYMENT/PAYMENT_FAILED orders are
 * also skipped — a refund there is impossible by the time the state machine
 * is concerned.
 */
async function handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
  const piId = typeof charge.payment_intent === 'string'
    ? charge.payment_intent
    : charge.payment_intent?.id;
  if (!piId) return;
  const payment = await prisma.payment.findUnique({
    where: { stripePaymentIntentId: piId },
  });
  if (!payment) return;

  const refunded = charge.amount_refunded;
  if (refunded === payment.refundedAmountCents) return; // no drift, idempotent

  const fullyRefunded = refunded >= payment.amountCents;
  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      refundedAmountCents: refunded,
      status: fullyRefunded ? 'REFUNDED' : payment.status,
    },
  });

  if (!fullyRefunded) return;

  const order = await prisma.order.findUnique({ where: { id: payment.orderId } });
  if (!order) return;
  // Don't try to drive RETURNED from terminal/unsettled states.
  if (
    order.status === 'CANCELLED' ||
    order.status === 'RETURNED' ||
    order.status === 'PENDING_PAYMENT' ||
    order.status === 'PAYMENT_FAILED'
  ) {
    return;
  }
  try {
    await updateStatus(order.id, 'RETURNED', 'fully refunded via Stripe');
  } catch (err) {
    process.stderr.write(
      `[checkout/webhook] charge.refunded → RETURNED transition failed for ${order.id}: ${
        err instanceof Error ? err.message : String(err)
      }\n`,
    );
  }
}
