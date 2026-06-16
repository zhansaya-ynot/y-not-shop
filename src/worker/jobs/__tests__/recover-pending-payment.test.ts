import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/server/db/client';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import { recoverPendingPayments } from '../recover-pending-payment';

const ONE_HOUR_MS = 60 * 60 * 1000;

async function seedProductWithStock(stock: number) {
  return prisma.product.create({
    data: {
      slug: 'recover-test-' + Math.random().toString(36).slice(2, 8),
      name: 'Recover Test',
      description: '',
      priceCents: 5000,
      materials: 'Cotton',
      care: 'Wash cold',
      sizing: 'Slim',
      weightGrams: 200,
      hsCode: '6109.10',
      countryOfOriginCode: 'GB',
      sizes: {
        create: [
          { size: 'M', colour: 'Black', stock },
        ],
      },
    },
    include: { sizes: true },
  });
}

async function seedOrder(opts: {
  status?: 'PENDING_PAYMENT' | 'NEW';
  createdAt?: Date;
  productId?: string;
  withPayment?: boolean;
  paymentIntentId?: string | null;
}) {
  const order = await prisma.order.create({
    data: {
      orderNumber: 'YN-2026-' + Math.random().toString(36).slice(2, 8),
      status: opts.status ?? 'PENDING_PAYMENT',
      subtotalCents: 5000,
      shippingCents: 0,
      totalCents: 5000,
      carrier: 'ROYAL_MAIL',
      shipFirstName: 'Tom',
      shipLastName: 'B',
      shipLine1: '1 St',
      shipCity: 'London',
      shipPostcode: 'SW1',
      shipCountry: 'GB',
      shipPhone: '+44',
      ...(opts.createdAt ? { createdAt: opts.createdAt } : {}),
    },
  });
  if (opts.productId) {
    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        productId: opts.productId,
        productSlug: 'recover-test',
        productName: 'Recover Test',
        productImage: '/x.jpg',
        colour: 'Black',
        size: 'M',
        unitPriceCents: 5000,
        quantity: 2,
      },
    });
  }
  if (opts.withPayment) {
    await prisma.payment.create({
      data: {
        orderId: order.id,
        amountCents: 5000,
        currency: 'GBP',
        stripePaymentIntentId: opts.paymentIntentId ?? null,
      },
    });
  }
  return order;
}

describe('recoverPendingPayments', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('returns zero when no stuck orders exist', async () => {
    const cancel = vi.fn();
    const r = await recoverPendingPayments({ stripe: { paymentIntents: { cancel } } });
    expect(r).toEqual({ recovered: 0 });
    expect(cancel).not.toHaveBeenCalled();
  });

  it('skips PENDING_PAYMENT orders newer than 1h', async () => {
    const product = await seedProductWithStock(10);
    await seedOrder({
      productId: product.id,
      createdAt: new Date(Date.now() - 30 * 60 * 1000),
    });
    const cancel = vi.fn();
    const r = await recoverPendingPayments({ stripe: { paymentIntents: { cancel } } });
    expect(r.recovered).toBe(0);
    const stockNow = await prisma.productSize.findUniqueOrThrow({
      where: { productId_size_colour: { productId: product.id, size: 'M', colour: 'Black' } },
    });
    expect(stockNow.stock).toBe(10);
  });

  it('skips orders not in PENDING_PAYMENT status', async () => {
    const product = await seedProductWithStock(10);
    await seedOrder({
      status: 'NEW',
      productId: product.id,
      createdAt: new Date(Date.now() - 2 * ONE_HOUR_MS),
    });
    const r = await recoverPendingPayments({
      stripe: { paymentIntents: { cancel: vi.fn() } },
    });
    expect(r.recovered).toBe(0);
  });

  it('cancels stuck orders, restocks items, and cancels Stripe PI', async () => {
    const product = await seedProductWithStock(10);
    const order = await seedOrder({
      productId: product.id,
      createdAt: new Date(Date.now() - 2 * ONE_HOUR_MS),
      withPayment: true,
      paymentIntentId: 'pi_test_123',
    });
    const cancel = vi.fn().mockResolvedValue({});
    const r = await recoverPendingPayments({ stripe: { paymentIntents: { cancel } } });
    expect(r.recovered).toBe(1);

    const refreshed = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(refreshed.status).toBe('CANCELLED');

    const stockNow = await prisma.productSize.findUniqueOrThrow({
      where: { productId_size_colour: { productId: product.id, size: 'M', colour: 'Black' } },
    });
    expect(stockNow.stock).toBe(12); // restocked +2

    expect(cancel).toHaveBeenCalledWith('pi_test_123');

    const events = await prisma.orderStatusEvent.findMany({ where: { orderId: order.id } });
    expect(events).toHaveLength(1);
    expect(events[0].status).toBe('CANCELLED');
    expect(events[0].note).toContain('recovery cron');
  });

  it('still cancels the order when Stripe cancel throws', async () => {
    const product = await seedProductWithStock(10);
    const order = await seedOrder({
      productId: product.id,
      createdAt: new Date(Date.now() - 2 * ONE_HOUR_MS),
      withPayment: true,
      paymentIntentId: 'pi_test_456',
    });
    const cancel = vi.fn().mockRejectedValue(new Error('payment_intent_unexpected_state'));
    const r = await recoverPendingPayments({ stripe: { paymentIntents: { cancel } } });
    expect(r.recovered).toBe(1);
    const refreshed = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(refreshed.status).toBe('CANCELLED');
  });

  it('skips Stripe call when no paymentIntentId is stored', async () => {
    const product = await seedProductWithStock(10);
    await seedOrder({
      productId: product.id,
      createdAt: new Date(Date.now() - 2 * ONE_HOUR_MS),
      withPayment: true,
      paymentIntentId: null,
    });
    const cancel = vi.fn();
    const r = await recoverPendingPayments({ stripe: { paymentIntents: { cancel } } });
    expect(r.recovered).toBe(1);
    expect(cancel).not.toHaveBeenCalled();
  });

  it('is idempotent: a second run after recovery is a no-op', async () => {
    const product = await seedProductWithStock(10);
    await seedOrder({
      productId: product.id,
      createdAt: new Date(Date.now() - 2 * ONE_HOUR_MS),
    });
    await recoverPendingPayments({ stripe: { paymentIntents: { cancel: vi.fn() } } });
    const r2 = await recoverPendingPayments({ stripe: { paymentIntents: { cancel: vi.fn() } } });
    expect(r2.recovered).toBe(0);
  });
});
