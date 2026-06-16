import { describe, expect, it, beforeEach, vi } from 'vitest';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import { prisma } from '@/server/db/client';

describe('refundPartialItems', () => {
  beforeEach(async () => {
    vi.resetModules();
    await resetDb();
  });

  async function seedTwoItemOrder(opts: { initialStock?: number } = {}) {
    const product = await prisma.product.create({
      data: {
        slug: 'rp-' + Math.random().toString(36).slice(2, 6),
        name: 'P', priceCents: 4000, currency: 'GBP',
        description: '', materials: '', care: '', sizing: '',
        sizes: { create: [{ size: 'M', colour: 'Black', stock: opts.initialStock ?? 5 }] },
        images: { create: [{ url: '/x.jpg', alt: '', sortOrder: 0 }] },
      },
    });
    return prisma.order.create({
      data: {
        orderNumber: 'YN-2026-RP' + Math.random().toString(36).slice(2, 6).toUpperCase(),
        status: 'DELIVERED',
        subtotalCents: 8000, shippingCents: 0, discountCents: 0,
        totalCents: 8000, currency: 'GBP', carrier: 'ROYAL_MAIL',
        shipFirstName: 'A', shipLastName: 'B', shipLine1: '1',
        shipCity: 'L', shipPostcode: 'SW1', shipCountry: 'GB', shipPhone: '+44',
        items: {
          create: [{
            productId: product.id, productSlug: product.slug, productName: 'P',
            productImage: '/x.jpg', colour: 'Black', size: 'M',
            unitPriceCents: 4000, currency: 'GBP', quantity: 2,
          }],
        },
        payment: {
          create: {
            stripePaymentIntentId: 'pi_rp_' + Math.random().toString(36).slice(2, 8),
            status: 'CAPTURED', amountCents: 8000, currency: 'GBP',
          },
        },
      },
      include: { payment: true, items: true },
    });
  }

  it('refunds the sum of selected items, restocks them, leaves Order DELIVERED', async () => {
    const create = vi.fn<(args: { payment_intent: string; amount: number; metadata: Record<string, string> }) => Promise<{ id: string }>>(
      async () => ({ id: 're_partial' }),
    );
    vi.doMock('@/server/checkout/stripe', () => ({
      stripe: { refunds: { create } },
    }));
    const { refundPartialItems } = await import('../service');

    const order = await seedTwoItemOrder({ initialStock: 5 });
    const result = await refundPartialItems(
      order.id,
      [{ orderItemId: order.items[0].id, quantity: 1 }],
      'damaged_in_transit',
    );

    expect(result.amountCents).toBe(4000);
    expect(create.mock.calls[0][0].amount).toBe(4000);

    const stock = await prisma.productSize.findFirstOrThrow({
      where: { productId: order.items[0].productId! },
    });
    expect(stock.stock).toBe(6); // 5 + 1 restocked

    const updated = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.status).toBe('DELIVERED');

    const payment = await prisma.payment.findUniqueOrThrow({
      where: { orderId: order.id },
    });
    expect(payment.refundedAmountCents).toBe(4000);
    expect(payment.status).toBe('CAPTURED'); // not fully refunded
  });

  it('marks Payment REFUNDED + Order RETURNED when full amount refunded across multiple calls', async () => {
    const create = vi.fn(async () => ({
      id: 're_' + Math.random().toString(36).slice(2, 8),
    }));
    vi.doMock('@/server/checkout/stripe', () => ({
      stripe: { refunds: { create } },
    }));
    const { refundPartialItems } = await import('../service');

    const order = await seedTwoItemOrder();
    await refundPartialItems(
      order.id,
      [{ orderItemId: order.items[0].id, quantity: 2 }],
      'all_returned',
    );

    const payment = await prisma.payment.findUniqueOrThrow({
      where: { orderId: order.id },
    });
    expect(payment.refundedAmountCents).toBe(8000);
    expect(payment.status).toBe('REFUNDED');

    const updated = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.status).toBe('RETURNED');
  });

  it('throws on empty items list', async () => {
    vi.doMock('@/server/checkout/stripe', () => ({
      stripe: { refunds: { create: vi.fn() } },
    }));
    const { refundPartialItems } = await import('../service');
    const order = await seedTwoItemOrder();
    await expect(
      refundPartialItems(order.id, [], 'x'),
    ).rejects.toThrow(/at least one item/);
  });

  it('throws on item not in order', async () => {
    vi.doMock('@/server/checkout/stripe', () => ({
      stripe: { refunds: { create: vi.fn() } },
    }));
    const { refundPartialItems } = await import('../service');
    const order = await seedTwoItemOrder();
    await expect(
      refundPartialItems(order.id, [{ orderItemId: 'nope', quantity: 1 }], 'x'),
    ).rejects.toThrow(/does not belong/);
  });

  it('throws on quantity exceeding ordered', async () => {
    vi.doMock('@/server/checkout/stripe', () => ({
      stripe: { refunds: { create: vi.fn() } },
    }));
    const { refundPartialItems } = await import('../service');
    const order = await seedTwoItemOrder();
    await expect(
      refundPartialItems(
        order.id,
        [{ orderItemId: order.items[0].id, quantity: 5 }],
        'x',
      ),
    ).rejects.toThrow(/Invalid refund quantity/);
  });

  it('throws when total exceeds remaining', async () => {
    vi.doMock('@/server/checkout/stripe', () => ({
      stripe: { refunds: { create: vi.fn() } },
    }));
    const { refundPartialItems } = await import('../service');
    const order = await seedTwoItemOrder();
    // Pre-refund 7000 so only 1000 remains, but request 4000.
    await prisma.payment.update({
      where: { id: order.payment!.id },
      data: { refundedAmountCents: 7000 },
    });
    await expect(
      refundPartialItems(
        order.id,
        [{ orderItemId: order.items[0].id, quantity: 1 }],
        'x',
      ),
    ).rejects.toThrow(/exceeds remaining/);
  });
});
