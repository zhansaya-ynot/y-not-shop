/**
 * Phase 5 end-to-end coverage (plan tasks 100-102).
 *
 * Each `describe` block walks one production scenario through the real
 * services with carrier + Stripe SDKs swapped for in-memory mocks. The DB is
 * a real Postgres (server vitest project, single fork, sequential).
 *
 * The goal is integration-level confidence — unit tests already cover each
 * subsystem in isolation; here we assert that the wiring across checkout +
 * webhook + fulfilment + tracking + email actually drives an Order from
 * PENDING_PAYMENT through DELIVERED without surprises.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type Stripe from 'stripe';
import type { Shipment } from '@prisma/client';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import { mockStripeSdk } from '@/server/__tests__/helpers/mock-stripe';
import { prisma } from '@/server/db/client';
import { addItem, getOrCreateCart } from '@/server/cart/service';
import { generateCartToken } from '@/server/cart/token';
import { applyManualShipmentStatus } from '@/server/fulfilment/shipment-events';
import {
  tryCreateShipment,
  type TryCreateShipmentDeps,
} from '@/server/fulfilment/service';
import type { CarrierServiceDeps } from '@/server/fulfilment/carrier';
import { syncTracking } from '@/worker/jobs/sync-tracking';
import type {
  TrackingProvider,
  TrackingResult,
} from '@/server/tracking/provider';
import type { EmailService, SendEmailInput } from '@/server/email/types';
import type { LabelStorage } from '@/server/fulfilment/label-storage';
import { seedShipping } from '../../../../tests/seeds/shipping';

// ---- Shared in-test infrastructure ----

/** EmailService stub that records every send for later assertions. */
function recordingEmailService(): EmailService & { sent: SendEmailInput[] } {
  const sent: SendEmailInput[] = [];
  const svc = {
    sent,
    async send(input: SendEmailInput) {
      sent.push(input);
      return { id: 'rec-' + sent.length };
    },
  };
  return svc;
}

/**
 * Drains the EmailJob queue using the supplied recording service.
 *
 * Both `_register` (template side-effect) and `processDueEmailJobs` (queue
 * drainer) must be imported in the same module-cache generation as the call
 * site, otherwise vitest's `resetModules` between tests leaves the drainer
 * looking at a registry that the side-effect file populated under a previous
 * generation. We resolve them dynamically and adjacent.
 */
async function drainEmailJobs(svc: EmailService): Promise<void> {
  await import('@/emails/_register');
  const { processDueEmailJobs } = await import('@/server/email/jobs');
  // EmailJob rows where attempts > 0 from a previous failed registry resolve
  // get reset to PENDING with a fresh dispatchAt so the drainer picks them up.
  await prisma.emailJob.updateMany({
    where: { template: 'OrderShipped', status: 'PENDING' },
    data: { dispatchAt: new Date(0) },
  });
  await processDueEmailJobs(svc);
}

/** In-memory LabelStorage suitable for tests. */
function memoryLabelStorage(): LabelStorage {
  const store = new Map<string, Buffer>();
  return {
    async put(id, content) {
      const key = `mem:${id}`;
      store.set(key, content);
      return key;
    },
    async get(key) {
      const buf = store.get(key);
      if (!buf) throw new Error(`missing ${key}`);
      return buf;
    },
    async delete(key) {
      store.delete(key);
    },
  };
}

/** TrackingProvider stub returning a single DELIVERED event. */
function deliveredTrackingProvider(at: Date): TrackingProvider {
  return {
    async getStatus(_trackingNumber: string): Promise<TrackingResult> {
      return {
        currentStatus: 'DELIVERED',
        events: [
          {
            status: 'DELIVERED',
            rawCarrierStatus: 'delivered',
            description: 'Parcel delivered',
            occurredAt: at,
          },
        ],
        deliveredAt: at,
      };
    },
  };
}

/** Stripe `payment_intent.succeeded` event payload helper. */
function piSucceededEvent(piId: string, eventId: string) {
  return {
    id: eventId,
    type: 'payment_intent.succeeded',
    data: { object: { id: piId } as unknown as Stripe.PaymentIntent },
  };
}

// ---- Task 100: end-to-end happy path (UK in-stock) ----

describe('E2E — order lifecycle (happy path)', () => {
  beforeEach(async () => {
    vi.resetModules();
    await resetDb();
    await seedShipping(prisma);
  });
  afterEach(() => {
    vi.doUnmock('@/server/checkout/stripe');
  });

  it('webhook → label → despatch → tracking sync → DELIVERED', async () => {
    // 1. Seed product + cart + ghost user (via real cart helpers, exactly as
    // checkout would in production).
    const product = await prisma.product.create({
      data: {
        slug: 'lifecycle-uk-' + Math.random().toString(36).slice(2, 6),
        name: 'Wool Coat',
        priceCents: 30000,
        currency: 'GBP',
        description: '',
        materials: 'Wool',
        care: 'Dry clean',
        sizing: 'Standard',
        weightGrams: 1500,
        hsCode: '6202.93',
        countryOfOriginCode: 'GB',
        sizes: { create: [{ size: 'M', colour: 'Black', stock: 3 }] },
        images: { create: [{ url: '/x.jpg', alt: '', sortOrder: 0 }] },
      },
    });
    const cart = await getOrCreateCart({
      userId: null,
      sessionToken: generateCartToken(),
    });
    await addItem(cart.id, {
      productId: product.id,
      size: 'M',
      colour: 'Black',
      quantity: 1,
      isPreorder: false,
    });

    // 2. Run real `createOrderAndPaymentIntent` with mocked Stripe SDK.
    const stripeMock = mockStripeSdk({ intentId: 'pi_lifecycle_uk' });
    const { createOrderAndPaymentIntent } = await import(
      '@/server/checkout/service'
    );
    const result = await createOrderAndPaymentIntent({
      cartId: cart.id,
      user: null,
      address: {
        email: 'lifecycle@x.com',
        firstName: 'Lifecycle',
        lastName: 'Customer',
        line1: '1 Test St',
        city: 'London',
        postcode: 'SW1A 1AA',
        countryCode: 'GB',
        phone: '+447000000000',
      },
      methodId: 'method-uk-rm-tracked48',
      attribution: null,
    });
    expect(stripeMock.create).toHaveBeenCalledTimes(1);

    const orderId = result.orderId;
    let order = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { shipments: true },
    });
    expect(order.status).toBe('PENDING_PAYMENT');
    expect(order.shipments).toHaveLength(1);
    const shipmentId = order.shipments[0].id;

    // 3. Dispatch payment_intent.succeeded webhook with mocked carrier deps.
    // The webhook calls our injected `tryCreateShipment` which writes the
    // tracking number and label key, then transitions NEW → PROCESSING and
    // sends the OrderReceipt email.
    vi.doMock('@/server/checkout/stripe', () => ({
      stripe: {
        webhooks: {
          constructEvent: () => piSucceededEvent('pi_lifecycle_uk', 'evt_lc_uk_1'),
        },
        paymentIntents: { create: vi.fn(), retrieve: vi.fn() },
      },
    }));
    const { handleWebhook } = await import('@/server/checkout/webhook');
    const email = recordingEmailService();
    const tryCreateShipmentMock = vi.fn(async (id: string) => {
      await prisma.shipment.update({
        where: { id },
        data: {
          trackingNumber: 'RM-LIFECYCLE-1',
          labelStorageKey: 'mem:' + id,
          labelGeneratedAt: new Date(),
        },
      });
      await prisma.shipmentEvent.create({
        data: { shipmentId: id, status: 'label_created', occurredAt: new Date() },
      });
      return { ok: true };
    });
    const webhookResult = await handleWebhook(
      { rawBody: '{}', signature: 's' },
      { tryCreateShipment: tryCreateShipmentMock, emailService: email },
    );
    expect(webhookResult.status).toBe(200);
    expect(tryCreateShipmentMock).toHaveBeenCalledWith(shipmentId);

    order = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { shipments: true },
    });
    expect(order.status).toBe('PROCESSING');
    expect(order.shipments[0].trackingNumber).toBe('RM-LIFECYCLE-1');
    expect(order.shipments[0].labelStorageKey).toBe('mem:' + shipmentId);
    expect(order.shipments[0].labelGeneratedAt).not.toBeNull();
    expect(email.sent.some((m) => m.subject === `Order ${order.orderNumber} confirmed`)).toBe(true);

    // 4. Mark the shipment as despatched (admin action). This enqueues an
    // OrderShipped email job and walks the order to SHIPPED.
    await applyManualShipmentStatus(shipmentId, 'IN_TRANSIT', 'admin-test');

    order = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { shipments: true },
    });
    expect(order.status).toBe('SHIPPED');
    expect(order.shipments[0].shippedAt).not.toBeNull();

    // Drain the email queue → OrderShipped email is sent.
    const shippedEmail = recordingEmailService();
    await drainEmailJobs(shippedEmail);
    expect(
      shippedEmail.sent.some(
        (m) => m.subject === `Your order ${order.orderNumber} is on the way`,
      ),
    ).toBe(true);

    // 5. Run sync-tracking with a mock provider that reports DELIVERED.
    const deliveredAt = new Date();
    const providers = {
      dhl: deliveredTrackingProvider(deliveredAt),
      royalMail: deliveredTrackingProvider(deliveredAt),
    };
    const fakeRedis = {
      async incr() {
        return 1;
      },
      async del() {
        return 1;
      },
    };
    await syncTracking({ providers, redis: fakeRedis });

    order = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { shipments: true },
    });
    expect(order.status).toBe('DELIVERED');
    expect(order.shipments[0].deliveredAt).not.toBeNull();

    // 6. Note: the production Phase 5 flow does NOT enqueue an OrderDelivered
    // email — `sync-tracking` reconciles status only. The `OrderDelivered`
    // template is still wired up for the resend-tracking-email admin endpoint
    // and a future "delivery confirmation" worker tick. We only assert the
    // status transition + persisted `deliveredAt` here.
    const events = await prisma.orderStatusEvent.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
    });
    const seq = events.map((e) => e.status);
    expect(seq).toContain('NEW');
    expect(seq).toContain('PROCESSING');
    expect(seq).toContain('SHIPPED');
    expect(seq).toContain('DELIVERED');
  }, 30_000);
});

// ---- Task 101: mixed-cart preorder ----

describe('E2E — order lifecycle (mixed cart with preorder)', () => {
  beforeEach(async () => {
    vi.resetModules();
    await resetDb();
    await seedShipping(prisma);
  });

  it('1 Order + 2 Shipments (in-stock + preorder) walks through to DELIVERED', async () => {
    // Seed: in-stock product + preorder product + active PreorderBatch.
    const inStock = await prisma.product.create({
      data: {
        slug: 'mc-instock-' + Math.random().toString(36).slice(2, 6),
        name: 'In-stock Item',
        priceCents: 12000,
        currency: 'GBP',
        description: '',
        materials: '',
        care: '',
        sizing: '',
        weightGrams: 800,
        hsCode: '6202.93',
        countryOfOriginCode: 'GB',
        sizes: { create: [{ size: 'M', colour: 'Black', stock: 5 }] },
        images: { create: [{ url: '/x.jpg', alt: '', sortOrder: 0 }] },
      },
    });
    const preorderProduct = await prisma.product.create({
      data: {
        slug: 'mc-preord-' + Math.random().toString(36).slice(2, 6),
        name: 'Preorder Item',
        priceCents: 18000,
        currency: 'GBP',
        description: '',
        materials: '',
        care: '',
        sizing: '',
        weightGrams: 1000,
        hsCode: '6202.93',
        countryOfOriginCode: 'GB',
        // Stock seeded so cart `addItem` validation passes; the splitter cares
        // about `isPreorder`, not stock balance.
        sizes: { create: [{ size: 'M', colour: 'Black', stock: 2 }] },
        images: { create: [{ url: '/x.jpg', alt: '', sortOrder: 0 }] },
      },
    });
    const batch = await prisma.preorderBatch.create({
      data: {
        name: 'AW26',
        productId: preorderProduct.id,
        estimatedShipFrom: new Date(Date.now() + 30 * 86_400_000),
        estimatedShipTo: new Date(Date.now() + 60 * 86_400_000),
        status: 'PENDING',
      },
    });

    // Seed an Order directly with both items + two Shipments. We bypass the
    // full cart→checkout path because production checkout doesn't yet auto-
    // assign `preorderBatchId` to OrderItems (the splitter requires it). A
    // future plan ticket can backfill that wiring; for now this mirrors what
    // an admin would see after the assignment step lands.
    const user = await prisma.user.create({
      data: { email: 'mc@x.com', name: 'MC', isGuest: true },
    });
    const order = await prisma.order.create({
      data: {
        orderNumber: 'YN-MC-' + Math.random().toString(36).slice(2, 6),
        status: 'NEW',
        userId: user.id,
        subtotalCents: 30000,
        shippingCents: 0,
        totalCents: 30000,
        currency: 'GBP',
        carrier: 'ROYAL_MAIL',
        shipFirstName: 'M',
        shipLastName: 'C',
        shipLine1: '1 Mixed St',
        shipCity: 'London',
        shipPostcode: 'SW1',
        shipCountry: 'GB',
        shipPhone: '+44',
        items: {
          create: [
            {
              productId: inStock.id,
              productSlug: inStock.slug,
              productName: inStock.name,
              productImage: '/x.jpg',
              colour: 'Black',
              size: 'M',
              unitPriceCents: inStock.priceCents,
              currency: 'GBP',
              quantity: 1,
              isPreorder: false,
            },
            {
              productId: preorderProduct.id,
              productSlug: preorderProduct.slug,
              productName: preorderProduct.name,
              productImage: '/x.jpg',
              colour: 'Black',
              size: 'M',
              unitPriceCents: preorderProduct.priceCents,
              currency: 'GBP',
              quantity: 1,
              isPreorder: true,
              preorderBatchId: batch.id,
            },
          ],
        },
        payment: {
          create: {
            stripePaymentIntentId: 'pi_mc_test',
            status: 'CAPTURED',
            amountCents: 30000,
            currency: 'GBP',
          },
        },
      },
      include: { items: true },
    });
    const inStockItem = order.items.find((i) => !i.isPreorder)!;
    const preorderItem = order.items.find((i) => i.isPreorder)!;

    const inStockShipment = await prisma.shipment.create({
      data: { orderId: order.id, carrier: 'ROYAL_MAIL' },
    });
    const preorderShipment = await prisma.shipment.create({
      data: { orderId: order.id, carrier: 'ROYAL_MAIL' },
    });
    await prisma.orderItem.update({
      where: { id: inStockItem.id },
      data: { shipmentId: inStockShipment.id },
    });
    await prisma.orderItem.update({
      where: { id: preorderItem.id },
      data: { shipmentId: preorderShipment.id },
    });

    // 1. Generate label for the in-stock shipment via `tryCreateShipment`
    // wired through the in-memory carrier mocks. This mirrors what the
    // post-payment hook would do in production.
    const storage = memoryLabelStorage();
    const carrierDeps: CarrierServiceDeps & {
      sendLabelFailureAlert: (s: Shipment) => Promise<void>;
    } = {
      dhl: {
        async createShipment() {
          return {
            trackingNumber: 'DHL-MC-1',
            labelPdfBytes: Buffer.from('PDF'),
          };
        },
      },
      rm: {
        async createShipment() {
          return { trackingNumber: 'RM-MC-INSTOCK', rmOrderId: 'rm_mc_1' };
        },
        async getLabel() {
          return Buffer.from('PDF');
        },
      },
      storage,
      sendLabelFailureAlert: vi.fn(async () => undefined),
    };

    const r1 = await tryCreateShipment(
      inStockShipment.id,
      carrierDeps as TryCreateShipmentDeps,
    );
    expect(r1.ok).toBe(true);

    const inStockAfter = await prisma.shipment.findUniqueOrThrow({
      where: { id: inStockShipment.id },
    });
    expect(inStockAfter.trackingNumber).toBe('RM-MC-INSTOCK');
    expect(inStockAfter.labelGeneratedAt).not.toBeNull();

    // Mirror the webhook's NEW → PROCESSING transition once a label exists.
    const { updateStatus } = await import('@/server/orders/service');
    await updateStatus(order.id, 'PROCESSING', 'label generated');

    // 2. Mark the in-stock shipment despatched → Order PARTIALLY_SHIPPED.
    await applyManualShipmentStatus(
      inStockShipment.id,
      'IN_TRANSIT',
      'admin-mc',
    );
    let after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(after.status).toBe('PARTIALLY_SHIPPED');

    // 3. Release the preorder batch → second Shipment label generated.
    const { releaseBatchForShipping } = await import(
      '@/server/preorders/service'
    );
    const releaseResult = await releaseBatchForShipping(batch.id, {
      tryCreateShipment,
      shipmentDeps: carrierDeps as TryCreateShipmentDeps,
    });
    expect(releaseResult.shipmentIds).toEqual([preorderShipment.id]);
    expect(releaseResult.results[0].result.ok).toBe(true);

    const preorderAfter = await prisma.shipment.findUniqueOrThrow({
      where: { id: preorderShipment.id },
    });
    expect(preorderAfter.labelGeneratedAt).not.toBeNull();
    expect(preorderAfter.trackingNumber).toBe('RM-MC-INSTOCK');

    // 4. Mark preorder shipment despatched → Order SHIPPED.
    await applyManualShipmentStatus(
      preorderShipment.id,
      'IN_TRANSIT',
      'admin-mc',
    );
    after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(after.status).toBe('SHIPPED');

    // 5. Tracking sync delivers both → Order DELIVERED.
    const deliveredAt = new Date();
    await syncTracking({
      providers: {
        dhl: deliveredTrackingProvider(deliveredAt),
        royalMail: deliveredTrackingProvider(deliveredAt),
      },
      redis: {
        async incr() {
          return 1;
        },
        async del() {
          return 1;
        },
      },
    });
    const final = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { shipments: true },
    });
    expect(final.status).toBe('DELIVERED');
    expect(final.shipments.every((s) => s.deliveredAt !== null)).toBe(true);
  }, 30_000);
});

// ---- Task 102: carrier failure → retry → alert ----

describe('E2E — carrier failure with retry + alert', () => {
  beforeEach(async () => {
    vi.resetModules();
    await resetDb();
  });

  async function seedShipmentReady(): Promise<{
    shipmentId: string;
    orderId: string;
  }> {
    const product = await prisma.product.create({
      data: {
        slug: 'cf-' + Math.random().toString(36).slice(2, 6),
        name: 'Carrier Fail',
        priceCents: 10000,
        currency: 'GBP',
        description: '',
        materials: '',
        care: '',
        sizing: '',
        weightGrams: 800,
        hsCode: '6202.93',
        countryOfOriginCode: 'GB',
      },
    });
    const order = await prisma.order.create({
      data: {
        orderNumber: 'YN-CF-' + Math.random().toString(36).slice(2, 6),
        status: 'NEW',
        subtotalCents: 10000,
        shippingCents: 0,
        totalCents: 10000,
        currency: 'GBP',
        carrier: 'DHL',
        shipFirstName: 'C',
        shipLastName: 'F',
        shipLine1: '1 Fail St',
        shipCity: 'Berlin',
        shipPostcode: '10115',
        shipCountry: 'DE',
        shipPhone: '+49',
      },
    });
    const shipment = await prisma.shipment.create({
      data: { orderId: order.id, carrier: 'DHL' },
    });
    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        productId: product.id,
        productSlug: product.slug,
        productName: product.name,
        productImage: '/x.jpg',
        colour: 'Black',
        size: 'M',
        unitPriceCents: 10000,
        currency: 'GBP',
        quantity: 1,
        shipmentId: shipment.id,
      },
    });
    return { shipmentId: shipment.id, orderId: order.id };
  }

  function makeFailingDhl(failTimes: number) {
    let calls = 0;
    return {
      createShipment: vi.fn(async () => {
        calls++;
        if (calls <= failTimes) {
          const err = new Error(`DHL 503 attempt ${calls}`);
          throw err;
        }
        return {
          trackingNumber: `DHL-RETRY-${calls}`,
          labelPdfBytes: Buffer.from('PDF'),
        };
      }),
    };
  }

  it('eventually succeeds after 4 failures → label generated on 5th attempt', async () => {
    const { shipmentId } = await seedShipmentReady();
    const dhl = makeFailingDhl(4);
    const sendLabelFailureAlert = vi.fn<(s: Shipment) => Promise<void>>(
      async () => undefined,
    );
    const deps: TryCreateShipmentDeps = {
      dhl,
      rm: {
        async createShipment() {
          throw new Error('not used');
        },
        async getLabel() {
          throw new Error('not used');
        },
      },
      storage: memoryLabelStorage(),
      sendLabelFailureAlert,
    };

    // Attempts 1-4: fail. attemptCount goes 1, 2, 3, 4. lastAttemptError set.
    for (let i = 1; i <= 4; i++) {
      const r = await tryCreateShipment(shipmentId, deps);
      expect(r.ok).toBe(false);
      const s = await prisma.shipment.findUniqueOrThrow({ where: { id: shipmentId } });
      expect(s.attemptCount).toBe(i);
      expect(s.lastAttemptError).toContain('DHL 503');
    }

    // Attempt 5: succeeds (DHL mock flips to success). Label is persisted.
    const r5 = await tryCreateShipment(shipmentId, deps);
    expect(r5.ok).toBe(true);
    const final = await prisma.shipment.findUniqueOrThrow({ where: { id: shipmentId } });
    expect(final.labelGeneratedAt).not.toBeNull();
    expect(final.trackingNumber).toBe('DHL-RETRY-5');
    expect(sendLabelFailureAlert).not.toHaveBeenCalled();
  });

  it('5 failures in a row → gaveUp + sendLabelFailureAlert fired', async () => {
    const { shipmentId } = await seedShipmentReady();
    const dhl = makeFailingDhl(99); // always fails
    const sendLabelFailureAlert = vi.fn<(s: Shipment) => Promise<void>>(
      async () => undefined,
    );
    const deps: TryCreateShipmentDeps = {
      dhl,
      rm: {
        async createShipment() {
          throw new Error('not used');
        },
        async getLabel() {
          throw new Error('not used');
        },
      },
      storage: memoryLabelStorage(),
      sendLabelFailureAlert,
    };

    let lastResult: Awaited<ReturnType<typeof tryCreateShipment>> | undefined;
    for (let i = 1; i <= 5; i++) {
      lastResult = await tryCreateShipment(shipmentId, deps);
    }
    expect(lastResult?.ok).toBe(false);
    expect(lastResult?.gaveUp).toBe(true);
    expect(sendLabelFailureAlert).toHaveBeenCalledTimes(1);
    const callArg = sendLabelFailureAlert.mock.calls[0][0] as Shipment;
    expect(callArg.id).toBe(shipmentId);
    expect(callArg.attemptCount).toBe(5);

    const final = await prisma.shipment.findUniqueOrThrow({ where: { id: shipmentId } });
    expect(final.labelGeneratedAt).toBeNull();
    expect(final.attemptCount).toBe(5);
  });
});
