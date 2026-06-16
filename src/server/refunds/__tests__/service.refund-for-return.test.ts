import { describe, expect, it, beforeEach, vi } from 'vitest';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import { prisma } from '@/server/db/client';

describe('refundForReturn', () => {
  beforeEach(async () => {
    vi.resetModules();
    await resetDb();
  });

  async function seedReturnWithItems() {
    const product = await prisma.product.create({
      data: {
        slug: 'rfr-' + Math.random().toString(36).slice(2, 6),
        name: 'P', priceCents: 4500, currency: 'GBP',
        description: '', materials: '', care: '', sizing: '',
        sizes: { create: [{ size: 'M', colour: 'Black', stock: 3 }] },
        images: { create: [{ url: '/x.jpg', alt: '', sortOrder: 0 }] },
      },
    });
    const order = await prisma.order.create({
      data: {
        orderNumber: 'YN-2026-RFR' + Math.random().toString(36).slice(2, 6).toUpperCase(),
        status: 'DELIVERED',
        subtotalCents: 9000, shippingCents: 0, discountCents: 0,
        totalCents: 9000, currency: 'GBP', carrier: 'ROYAL_MAIL',
        shipFirstName: 'A', shipLastName: 'B', shipLine1: '1',
        shipCity: 'L', shipPostcode: 'SW1', shipCountry: 'GB', shipPhone: '+44',
        items: {
          create: [{
            productId: product.id, productSlug: product.slug, productName: 'P',
            productImage: '/x.jpg', colour: 'Black', size: 'M',
            unitPriceCents: 4500, currency: 'GBP', quantity: 2,
          }],
        },
        payment: {
          create: {
            stripePaymentIntentId: 'pi_rfr_' + Math.random().toString(36).slice(2, 8),
            status: 'CAPTURED', amountCents: 9000, currency: 'GBP',
          },
        },
      },
      include: { items: true, payment: true },
    });
    const ret = await prisma.return.create({
      data: {
        orderId: order.id,
        returnNumber: 'RT-2026-RFR' + Math.random().toString(36).slice(2, 4),
        reason: 'fit', reasonCategory: 'DOES_NOT_FIT', status: 'RECEIVED',
        items: { create: [{ orderItemId: order.items[0].id, quantity: 2 }] },
      },
      include: { items: true },
    });
    return { order, product, ret };
  }

  it('sums accepted item prices, calls Stripe, restocks, links RefundEvent to Return', async () => {
    const create = vi.fn<(args: { payment_intent: string; amount: number; metadata: Record<string, string> }) => Promise<{ id: string }>>(
      async () => ({ id: 're_for_return' }),
    );
    vi.doMock('@/server/checkout/stripe', () => ({
      stripe: { refunds: { create } },
    }));
    const { refundForReturn } = await import('../service');

    const { order, ret, product } = await seedReturnWithItems();
    const result = await refundForReturn(ret.id, [ret.items[0].id]);

    expect(result.amountCents).toBe(9000); // 4500 * 2
    expect(create.mock.calls[0][0]).toMatchObject({
      payment_intent: order.payment!.stripePaymentIntentId,
      amount: 9000,
      metadata: { orderId: order.id, returnId: ret.id, reason: 'return_approved' },
    });

    const events = await prisma.refundEvent.findMany({ where: { orderId: order.id } });
    expect(events).toHaveLength(1);
    expect(events[0].returnId).toBe(ret.id);
    expect(events[0].stripeRefundId).toBe('re_for_return');

    const stock = await prisma.productSize.findFirstOrThrow({
      where: { productId: product.id },
    });
    expect(stock.stock).toBe(5); // 3 + 2 restocked

    const payment = await prisma.payment.findUniqueOrThrow({
      where: { orderId: order.id },
    });
    expect(payment.refundedAmountCents).toBe(9000);
    expect(payment.status).toBe('REFUNDED');

    const updated = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.status).toBe('RETURNED');
  });

  it('throws on empty acceptedItemIds', async () => {
    vi.doMock('@/server/checkout/stripe', () => ({
      stripe: { refunds: { create: vi.fn() } },
    }));
    const { refundForReturn } = await import('../service');
    const { ret } = await seedReturnWithItems();
    await expect(refundForReturn(ret.id, [])).rejects.toThrow(/at least one/);
  });

  it('throws when an accepted id is not on the Return', async () => {
    vi.doMock('@/server/checkout/stripe', () => ({
      stripe: { refunds: { create: vi.fn() } },
    }));
    const { refundForReturn } = await import('../service');
    const { ret } = await seedReturnWithItems();
    await expect(
      refundForReturn(ret.id, ['not-on-return']),
    ).rejects.toThrow(/do not belong/);
  });

  it('throws when the Return does not exist', async () => {
    vi.doMock('@/server/checkout/stripe', () => ({
      stripe: { refunds: { create: vi.fn() } },
    }));
    const { refundForReturn } = await import('../service');
    await expect(refundForReturn('nope', ['x'])).rejects.toThrow(/not found/);
  });

  it('throws when payment is not captured', async () => {
    vi.doMock('@/server/checkout/stripe', () => ({
      stripe: { refunds: { create: vi.fn() } },
    }));
    const { refundForReturn } = await import('../service');
    const { ret, order } = await seedReturnWithItems();
    await prisma.payment.update({
      where: { id: order.payment!.id }, data: { status: 'PENDING' },
    });
    await expect(
      refundForReturn(ret.id, [ret.items[0].id]),
    ).rejects.toThrow(/PENDING/);
  });
});
