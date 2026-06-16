import { describe, expect, it, beforeEach, vi } from 'vitest';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import { prisma } from '@/server/db/client';

describe('webhook handler', () => {
  beforeEach(async () => {
    vi.resetModules();
    await resetDb();
  });

  it('rejects on invalid signature', async () => {
    vi.doMock('@/server/checkout/stripe', () => ({
      stripe: {
        webhooks: { constructEvent: vi.fn(() => { throw new Error('bad sig'); }) },
        paymentIntents: { create: vi.fn(), retrieve: vi.fn() },
      },
    }));
    const { handleWebhook } = await import('../webhook');
    const result = await handleWebhook({ rawBody: '{}', signature: 'bad' });
    expect(result.status).toBe(400);
  });

  it('records event id and ignores replays', async () => {
    const fakeEvent = { id: 'evt_test_1', type: 'something.unhandled', data: { object: {} } };
    vi.doMock('@/server/checkout/stripe', () => ({
      stripe: {
        webhooks: { constructEvent: vi.fn(() => fakeEvent) },
        paymentIntents: { create: vi.fn(), retrieve: vi.fn() },
      },
    }));
    const { handleWebhook } = await import('../webhook');
    const r1 = await handleWebhook({ rawBody: '{}', signature: 'sig1' });
    expect(r1.status).toBe(200);
    expect(await prisma.stripeEvent.count()).toBe(1);
    const r2 = await handleWebhook({ rawBody: '{}', signature: 'sig2' });
    expect(r2.status).toBe(200);
    expect(await prisma.stripeEvent.count()).toBe(1); // unchanged
  });
});

describe('handlePaymentSucceeded', () => {
  beforeEach(async () => {
    vi.resetModules();
    await resetDb();
  });

  async function seedPendingOrder(opts: { promoCode?: string } = {}) {
    const product = await prisma.product.create({
      data: {
        slug: 'pp-' + Math.random().toString(36).slice(2, 6),
        name: 'P', priceCents: 20000, currency: 'GBP',
        description: '', materials: '', care: '', sizing: '',
        sizes: { create: [{ size: 'S', colour: 'Black', stock: 5 }] },
        images: { create: [{ url: '/x.jpg', alt: '', sortOrder: 0 }] },
      },
    });
    let promoId: string | null = null;
    if (opts.promoCode) {
      const promo = await prisma.promoCode.create({
        data: { code: opts.promoCode, discountType: 'PERCENT', discountValue: 10, isActive: true },
      });
      promoId = promo.id;
    }
    const order = await prisma.order.create({
      data: {
        orderNumber: 'YN-2026-00001',
        status: 'PENDING_PAYMENT',
        subtotalCents: 20000, shippingCents: 0, discountCents: 0, totalCents: 20000, currency: 'GBP',
        carrier: 'ROYAL_MAIL', shipFirstName: 'A', shipLastName: 'B', shipLine1: '1', shipCity: 'L',
        shipPostcode: 'SW1', shipCountry: 'GB', shipPhone: '+44',
        promoCodeId: promoId,
        items: { create: [{ productId: product.id, productSlug: product.slug, productName: 'P',
          productImage: '/x.jpg', colour: 'Black', size: 'S', unitPriceCents: 20000, currency: 'GBP', quantity: 1 }] },
        payment: { create: { stripePaymentIntentId: 'pi_test_succ', status: 'PENDING', amountCents: 20000, currency: 'GBP' } },
      },
      include: { payment: true },
    });
    return { order, promoId };
  }

  it('flips Order to NEW + Payment to CAPTURED', async () => {
    const { order } = await seedPendingOrder();
    const fakeEvent = {
      id: 'evt_succ_1', type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_test_succ' } as unknown as import('stripe').default.PaymentIntent },
    };
    vi.doMock('@/server/checkout/stripe', () => ({
      stripe: { webhooks: { constructEvent: () => fakeEvent }, paymentIntents: { create: vi.fn(), retrieve: vi.fn() } },
    }));
    const { handleWebhook } = await import('../webhook');
    await handleWebhook({ rawBody: '{}', signature: 's' });
    const o = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { payment: true } });
    expect(o.status).toBe('NEW');
    expect(o.payment?.status).toBe('CAPTURED');
  });

  it('calls tryCreateShipment for in-stock-eligible Shipments and sends OrderReceipt', async () => {
    const { order } = await seedPendingOrder();
    // Attach a user (with email) and a Shipment containing the existing item.
    const user = await prisma.user.create({
      data: { email: 'recv@x.com', name: 'R', isGuest: true },
    });
    await prisma.order.update({ where: { id: order.id }, data: { userId: user.id } });
    const shipment = await prisma.shipment.create({
      data: { orderId: order.id, carrier: 'ROYAL_MAIL' },
    });
    await prisma.orderItem.updateMany({
      where: { orderId: order.id }, data: { shipmentId: shipment.id },
    });

    const fakeEvent = {
      id: 'evt_succ_3', type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_test_succ' } as unknown as import('stripe').default.PaymentIntent },
    };
    vi.doMock('@/server/checkout/stripe', () => ({
      stripe: { webhooks: { constructEvent: () => fakeEvent }, paymentIntents: { create: vi.fn(), retrieve: vi.fn() } },
    }));
    const { handleWebhook } = await import('../webhook');

    const tryCreateShipment = vi.fn(async (id: string) => {
      // Mark the shipment as if a label were generated, so PROCESSING transition fires.
      await prisma.shipment.update({
        where: { id }, data: { labelGeneratedAt: new Date(), trackingNumber: 'RB-X' },
      });
      return { ok: true };
    });
    const send = vi.fn(async (_input: { to: string; subject: string }) => ({ id: 'em_1' }));

    await handleWebhook(
      { rawBody: '{}', signature: 's' },
      { tryCreateShipment, emailService: { send } },
    );

    expect(tryCreateShipment).toHaveBeenCalledTimes(1);
    expect(tryCreateShipment).toHaveBeenCalledWith(shipment.id);
    expect(send).toHaveBeenCalledTimes(1);
    const sent = send.mock.calls[0][0];
    expect(sent.to).toBe('recv@x.com');
    expect(sent.subject).toContain(order.orderNumber);
    const o = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(o.status).toBe('PROCESSING');
  });

  it('skips shipments that contain a preorder item', async () => {
    const { order } = await seedPendingOrder();
    const shipment = await prisma.shipment.create({
      data: { orderId: order.id, carrier: 'ROYAL_MAIL' },
    });
    // Mark the existing OrderItem as preorder + link it to the shipment.
    await prisma.orderItem.updateMany({
      where: { orderId: order.id }, data: { shipmentId: shipment.id, isPreorder: true },
    });

    const fakeEvent = {
      id: 'evt_succ_4', type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_test_succ' } as unknown as import('stripe').default.PaymentIntent },
    };
    vi.doMock('@/server/checkout/stripe', () => ({
      stripe: { webhooks: { constructEvent: () => fakeEvent }, paymentIntents: { create: vi.fn(), retrieve: vi.fn() } },
    }));
    const { handleWebhook } = await import('../webhook');
    const tryCreateShipment = vi.fn(async () => ({ ok: true }));
    const send = vi.fn(async () => ({ id: 'em_2' }));
    await handleWebhook(
      { rawBody: '{}', signature: 's' },
      { tryCreateShipment, emailService: { send } },
    );
    expect(tryCreateShipment).not.toHaveBeenCalled();
    // Order stays in NEW because no label was generated.
    const o = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(o.status).toBe('NEW');
  });

  it('does not transition to PROCESSING when no shipment generated a label', async () => {
    const { order } = await seedPendingOrder();
    const shipment = await prisma.shipment.create({
      data: { orderId: order.id, carrier: 'ROYAL_MAIL' },
    });
    await prisma.orderItem.updateMany({
      where: { orderId: order.id }, data: { shipmentId: shipment.id },
    });
    const fakeEvent = {
      id: 'evt_succ_5', type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_test_succ' } as unknown as import('stripe').default.PaymentIntent },
    };
    vi.doMock('@/server/checkout/stripe', () => ({
      stripe: { webhooks: { constructEvent: () => fakeEvent }, paymentIntents: { create: vi.fn(), retrieve: vi.fn() } },
    }));
    const { handleWebhook } = await import('../webhook');
    const tryCreateShipment = vi.fn(async () => ({ ok: false })); // carrier failed
    const send = vi.fn(async () => ({ id: 'em_3' }));
    await handleWebhook(
      { rawBody: '{}', signature: 's' },
      { tryCreateShipment, emailService: { send } },
    );
    const o = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(o.status).toBe('NEW');
  });

  it('increments promo.usageCount + creates PromoRedemption', async () => {
    const { order, promoId } = await seedPendingOrder({ promoCode: 'WELCOME10' });
    const fakeEvent = {
      id: 'evt_succ_2', type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_test_succ' } as unknown as import('stripe').default.PaymentIntent },
    };
    vi.doMock('@/server/checkout/stripe', () => ({
      stripe: { webhooks: { constructEvent: () => fakeEvent }, paymentIntents: { create: vi.fn(), retrieve: vi.fn() } },
    }));
    const { handleWebhook } = await import('../webhook');
    await handleWebhook({ rawBody: '{}', signature: 's' });
    const promo = await prisma.promoCode.findUniqueOrThrow({ where: { id: promoId! } });
    expect(promo.usageCount).toBe(1);
    const redemption = await prisma.promoRedemption.findFirst({ where: { orderId: order.id } });
    expect(redemption).not.toBeNull();
  });
});

describe('handlePaymentFailed', () => {
  beforeEach(async () => {
    vi.resetModules();
    await resetDb();
  });

  it('flips Order to PAYMENT_FAILED and releases stock', async () => {
    const product = await prisma.product.create({
      data: {
        slug: 'pf-' + Math.random().toString(36).slice(2, 6),
        name: 'P', priceCents: 20000, currency: 'GBP',
        description: '', materials: '', care: '', sizing: '',
        sizes: { create: [{ size: 'S', colour: 'Black', stock: 2 }] }, // already decremented in real flow
        images: { create: [{ url: '/x.jpg', alt: '', sortOrder: 0 }] },
      },
    });
    const order = await prisma.order.create({
      data: {
        orderNumber: 'YN-2026-00001',
        status: 'PENDING_PAYMENT',
        subtotalCents: 20000, shippingCents: 0, discountCents: 0, totalCents: 20000, currency: 'GBP',
        carrier: 'ROYAL_MAIL', shipFirstName: 'A', shipLastName: 'B', shipLine1: '1', shipCity: 'L',
        shipPostcode: 'SW1', shipCountry: 'GB', shipPhone: '+44',
        items: { create: [{ productId: product.id, productSlug: product.slug, productName: 'P',
          productImage: '/x.jpg', colour: 'Black', size: 'S', unitPriceCents: 20000, currency: 'GBP', quantity: 1 }] },
        payment: { create: { stripePaymentIntentId: 'pi_test_fail', status: 'PENDING', amountCents: 20000, currency: 'GBP' } },
      },
    });
    const fakeEvent = {
      id: 'evt_fail_1', type: 'payment_intent.payment_failed',
      data: { object: { id: 'pi_test_fail' } as unknown as import('stripe').default.PaymentIntent },
    };
    vi.doMock('@/server/checkout/stripe', () => ({
      stripe: { webhooks: { constructEvent: () => fakeEvent }, paymentIntents: { create: vi.fn(), retrieve: vi.fn() } },
    }));
    const { handleWebhook } = await import('../webhook');
    await handleWebhook({ rawBody: '{}', signature: 's' });

    const o = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { payment: true } });
    expect(o.status).toBe('PAYMENT_FAILED');
    expect(o.payment?.status).toBe('FAILED');
    const stock = await prisma.productSize.findUniqueOrThrow({
      where: { productId_size_colour: { productId: product.id, size: 'S', colour: 'Black' } },
    });
    expect(stock.stock).toBe(3); // 2 + released 1
  });
});

describe('handleChargeRefunded', () => {
  beforeEach(async () => {
    vi.resetModules();
    await resetDb();
  });

  async function seedShippedOrder(opts: { paymentIntentId?: string } = {}) {
    const product = await prisma.product.create({
      data: {
        slug: 'cr-' + Math.random().toString(36).slice(2, 6),
        name: 'P', priceCents: 5000, currency: 'GBP',
        description: '', materials: '', care: '', sizing: '',
        sizes: { create: [{ size: 'S', colour: 'Black', stock: 5 }] },
        images: { create: [{ url: '/x.jpg', alt: '', sortOrder: 0 }] },
      },
    });
    return prisma.order.create({
      data: {
        orderNumber: 'YN-CR-' + Math.random().toString(36).slice(2, 6),
        status: 'SHIPPED',
        subtotalCents: 5000, shippingCents: 0, discountCents: 0, totalCents: 5000, currency: 'GBP',
        carrier: 'ROYAL_MAIL', shipFirstName: 'A', shipLastName: 'B', shipLine1: '1', shipCity: 'L',
        shipPostcode: 'SW1', shipCountry: 'GB', shipPhone: '+44',
        items: { create: [{ productId: product.id, productSlug: product.slug, productName: 'P',
          productImage: '/x.jpg', colour: 'Black', size: 'S',
          unitPriceCents: 5000, currency: 'GBP', quantity: 1 }] },
        payment: { create: {
          stripePaymentIntentId: opts.paymentIntentId ?? 'pi_cr_test',
          status: 'CAPTURED', amountCents: 5000, currency: 'GBP',
          refundedAmountCents: 0,
        } },
      },
      include: { payment: true },
    });
  }

  it('full refund flips Order to RETURNED + Payment to REFUNDED', async () => {
    const order = await seedShippedOrder();
    const fakeEvent = {
      id: 'evt_cr_full', type: 'charge.refunded',
      data: { object: { payment_intent: 'pi_cr_test', amount_refunded: 5000 } as unknown as import('stripe').default.Charge },
    };
    vi.doMock('@/server/checkout/stripe', () => ({
      stripe: { webhooks: { constructEvent: () => fakeEvent }, paymentIntents: { create: vi.fn(), retrieve: vi.fn() } },
    }));
    const { handleWebhook } = await import('../webhook');
    await handleWebhook({ rawBody: '{}', signature: 's' });

    const o = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { payment: true } });
    expect(o.status).toBe('RETURNED');
    expect(o.payment?.status).toBe('REFUNDED');
    expect(o.payment?.refundedAmountCents).toBe(5000);
  });

  it('partial refund updates refundedAmountCents but not Order/Payment status', async () => {
    const order = await seedShippedOrder();
    const fakeEvent = {
      id: 'evt_cr_part', type: 'charge.refunded',
      data: { object: { payment_intent: 'pi_cr_test', amount_refunded: 2000 } as unknown as import('stripe').default.Charge },
    };
    vi.doMock('@/server/checkout/stripe', () => ({
      stripe: { webhooks: { constructEvent: () => fakeEvent }, paymentIntents: { create: vi.fn(), retrieve: vi.fn() } },
    }));
    const { handleWebhook } = await import('../webhook');
    await handleWebhook({ rawBody: '{}', signature: 's' });

    const o = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { payment: true } });
    expect(o.status).toBe('SHIPPED');
    expect(o.payment?.status).toBe('CAPTURED');
    expect(o.payment?.refundedAmountCents).toBe(2000);
  });

  it('is idempotent — second event with same amount is a no-op', async () => {
    const order = await seedShippedOrder();
    await prisma.payment.update({
      where: { orderId: order.id },
      data: { refundedAmountCents: 5000, status: 'REFUNDED' },
    });
    await prisma.order.update({ where: { id: order.id }, data: { status: 'RETURNED' } });

    const fakeEvent = {
      id: 'evt_cr_replay', type: 'charge.refunded',
      data: { object: { payment_intent: 'pi_cr_test', amount_refunded: 5000 } as unknown as import('stripe').default.Charge },
    };
    vi.doMock('@/server/checkout/stripe', () => ({
      stripe: { webhooks: { constructEvent: () => fakeEvent }, paymentIntents: { create: vi.fn(), retrieve: vi.fn() } },
    }));
    const { handleWebhook } = await import('../webhook');
    await handleWebhook({ rawBody: '{}', signature: 's' });

    const o = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { payment: true } });
    expect(o.status).toBe('RETURNED');
    expect(o.payment?.status).toBe('REFUNDED');
    const eventCount = await prisma.orderStatusEvent.count({
      where: { orderId: order.id, status: 'RETURNED' },
    });
    expect(eventCount).toBe(0); // no spurious event from replay
  });

  it('skips Order status flip when already CANCELLED', async () => {
    const order = await seedShippedOrder();
    // Forge a non-default initial state: cancel the order before refund arrives.
    await prisma.order.update({ where: { id: order.id }, data: { status: 'CANCELLED' } });

    const fakeEvent = {
      id: 'evt_cr_cancel', type: 'charge.refunded',
      data: { object: { payment_intent: 'pi_cr_test', amount_refunded: 5000 } as unknown as import('stripe').default.Charge },
    };
    vi.doMock('@/server/checkout/stripe', () => ({
      stripe: { webhooks: { constructEvent: () => fakeEvent }, paymentIntents: { create: vi.fn(), retrieve: vi.fn() } },
    }));
    const { handleWebhook } = await import('../webhook');
    await handleWebhook({ rawBody: '{}', signature: 's' });

    const o = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { payment: true } });
    expect(o.status).toBe('CANCELLED');
    expect(o.payment?.status).toBe('REFUNDED');
    expect(o.payment?.refundedAmountCents).toBe(5000);
  });

  it('returns 200 silently when payment intent is unknown', async () => {
    const fakeEvent = {
      id: 'evt_cr_orphan', type: 'charge.refunded',
      data: { object: { payment_intent: 'pi_unknown', amount_refunded: 100 } as unknown as import('stripe').default.Charge },
    };
    vi.doMock('@/server/checkout/stripe', () => ({
      stripe: { webhooks: { constructEvent: () => fakeEvent }, paymentIntents: { create: vi.fn(), retrieve: vi.fn() } },
    }));
    const { handleWebhook } = await import('../webhook');
    const r = await handleWebhook({ rawBody: '{}', signature: 's' });
    expect(r.status).toBe(200);
  });
});
