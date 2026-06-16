import { describe, expect, it, beforeEach, vi } from 'vitest';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import { prisma } from '@/server/db/client';
import { mockStripeSdk } from '@/server/__tests__/helpers/mock-stripe';
import { seedShipping } from '../../../../../tests/seeds/shipping';
import { generateCartToken } from '@/server/cart/token';
import { POST as addItem } from '../../cart/items/route';
import { GET as getCart } from '../../cart/route';
import { POST as quote } from '../quote/route';

// Both cart and checkout route handlers call resolveCart() which uses Next.js
// cookies(). Mock the module so we can inject a real DB cart instead.
const resolveCartMock = vi.fn();
vi.mock('@/server/cart/resolve', () => ({
  resolveCart: () => resolveCartMock(),
}));

// The create route reads cookies() for attribution cookie + sets order-token cookie.
// Mock next/headers to avoid Next.js context errors in test environment.
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(() => undefined),
    set: vi.fn(),
    delete: vi.fn(),
  })),
}));

// Mock next-auth to prevent next/server import errors in test env.
vi.mock('@/server/auth/nextauth', () => ({
  auth: vi.fn(async () => null),
}));

// Mock getSessionUser so the create route treats this as a guest checkout.
vi.mock('@/server/auth/session', () => ({
  getSessionUser: vi.fn(async () => null),
  requireSessionUser: vi.fn(async () => { throw new Error('not authenticated'); }),
}));

describe('checkout flow (cart → quote → create)', () => {
  beforeEach(async () => {
    await resetDb();
    await seedShipping(prisma);
  });

  it('creates Order(PENDING_PAYMENT) end-to-end for a guest UK order', async () => {
    const stripe = mockStripeSdk();

    const product = await prisma.product.create({
      data: {
        slug: 'eco',
        name: 'Eco',
        description: '',
        materials: '',
        care: '',
        sizing: '',
        priceCents: 30000,
        currency: 'GBP',
        weightGrams: 1500,
        hsCode: '6202.93',
        countryOfOriginCode: 'GB',
        sizes: { create: [{ size: 'M', colour: 'Black', stock: 5 }] },
        images: { create: [{ url: '/x.jpg', alt: '', sortOrder: 0 }] },
      },
    });

    // 1) Guest cart — create in DB, point resolveCart mock at it.
    const guestToken = generateCartToken();
    const guestCart = await prisma.cart.create({
      data: {
        sessionToken: guestToken,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      include: { items: true },
    });
    resolveCartMock.mockResolvedValue(guestCart);

    // 1b) GET /api/cart — confirms mock wiring works.
    const r1 = await getCart(new Request('http://localhost/api/cart'));
    expect(r1.status).toBe(200);

    // 2) Add item.
    resolveCartMock.mockResolvedValue(guestCart);
    await addItem(
      new Request('http://localhost/api/cart/items', {
        method: 'POST',
        body: JSON.stringify({ productId: product.id, size: 'M', colour: 'Black', quantity: 1, isPreorder: false }),
        headers: { 'content-type': 'application/json' },
      }),
    );

    // Refresh cart from DB so it includes the newly added item.
    const cartWithItem = await prisma.cart.findUniqueOrThrow({
      where: { id: guestCart.id },
      include: { items: true },
    });

    // 3) Quote shipping for GB.
    resolveCartMock.mockResolvedValue(cartWithItem);
    const qRes = await quote(
      new Request('http://localhost/api/checkout/quote', {
        method: 'POST',
        body: JSON.stringify({
          address: {
            email: 'g@x.com',
            firstName: 'G',
            lastName: 'X',
            line1: '1 St',
            city: 'London',
            postcode: 'SW1',
            countryCode: 'GB',
            phone: '+440000000000',
          },
        }),
        headers: { 'content-type': 'application/json' },
      }),
    );
    expect(qRes.status).toBe(200);
    const qBody = await qRes.json();
    expect(qBody.methods.length).toBeGreaterThan(0);
    const methodId = qBody.methods[0].methodId;

    // 4) Create order.
    const { POST: createOrder } = await import('../create/route');
    resolveCartMock.mockResolvedValue(cartWithItem);
    const cRes = await createOrder(
      new Request('http://localhost/api/checkout/create', {
        method: 'POST',
        body: JSON.stringify({
          address: {
            email: 'g@x.com',
            firstName: 'G',
            lastName: 'X',
            line1: '1 St',
            city: 'London',
            postcode: 'SW1',
            countryCode: 'GB',
            phone: '+440000000000',
          },
          methodId,
        }),
        headers: { 'content-type': 'application/json' },
      }),
    );
    expect(cRes.status).toBe(200);
    const cBody = await cRes.json();
    expect(cBody.orderId).toBeDefined();
    expect(cBody.clientSecret).toBe(stripe.clientSecret);

    const order = await prisma.order.findUniqueOrThrow({
      where: { id: cBody.orderId },
      include: { items: true, payment: true, user: true },
    });
    expect(order.status).toBe('PENDING_PAYMENT');
    expect(order.totalCents).toBe(30000); // UK is £0 shipping
    expect(order.user?.isGuest).toBe(true);
    expect(stripe.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 30000,
        currency: 'gbp',
        metadata: expect.objectContaining({ orderId: cBody.orderId }),
      }),
    );
  });
});
