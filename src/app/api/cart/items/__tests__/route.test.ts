import { describe, expect, it, beforeEach, vi } from 'vitest';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import { prisma } from '@/server/db/client';
import { POST } from '../route';

const resolveCartMock = vi.fn();
vi.mock('@/server/cart/resolve', () => ({
  resolveCart: () => resolveCartMock(),
}));

describe('POST /api/cart/items', () => {
  beforeEach(async () => {
    await resetDb();
    vi.clearAllMocks();
  });

  async function seedProduct() {
    return prisma.product.create({
      data: {
        slug: 'pi-' + Math.random().toString(36).slice(2, 6),
        name: 'P',
        description: '',
        materials: '',
        care: '',
        sizing: '',
        priceCents: 12000,
        currency: 'GBP',
        sizes: { create: [{ size: 'M', colour: 'Navy', stock: 5 }] },
        images: { create: [{ url: '/x.jpg', alt: '', sortOrder: 0 }] },
      },
    });
  }

  async function seedCart() {
    return prisma.cart.create({
      data: {
        sessionToken: 'cart-tok-' + Math.random().toString(36).slice(2, 6),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      },
      include: { items: true },
    });
  }

  it('adds an item and returns updated snapshot', async () => {
    const product = await seedProduct();
    const cart = await seedCart();
    resolveCartMock.mockResolvedValue(cart);
    const body = JSON.stringify({ productId: product.id, size: 'M', colour: 'Navy', quantity: 1, isPreorder: false });
    const req = new Request('http://localhost/api/cart/items', { method: 'POST', body, headers: { 'content-type': 'application/json' } });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.items).toHaveLength(1);
    expect(json.items[0].quantity).toBe(1);
  });

  it('returns 409 with stockAvailable on stock conflict', async () => {
    // stock = 5, request quantity = 10 (within Zod limit but over stock)
    const product = await prisma.product.create({
      data: {
        slug: 'pi-low-stock',
        name: 'Low Stock',
        description: '',
        materials: '',
        care: '',
        sizing: '',
        priceCents: 12000,
        currency: 'GBP',
        sizes: { create: [{ size: 'M', colour: 'Navy', stock: 2 }] },
        images: { create: [{ url: '/x.jpg', alt: '', sortOrder: 0 }] },
      },
    });
    const cart = await seedCart();
    resolveCartMock.mockResolvedValue(cart);
    const body = JSON.stringify({ productId: product.id, size: 'M', colour: 'Navy', quantity: 10, isPreorder: false });
    const req = new Request('http://localhost/api/cart/items', { method: 'POST', body, headers: { 'content-type': 'application/json' } });
    const res = await POST(req);
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toBe('STOCK_CONFLICT');
    expect(json.stockAvailable).toBe(2);
  });

  it('returns 400 on invalid body', async () => {
    const cart = await seedCart();
    resolveCartMock.mockResolvedValue(cart);
    const req = new Request('http://localhost/api/cart/items', { method: 'POST', body: '{"bad":1}', headers: { 'content-type': 'application/json' } });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
