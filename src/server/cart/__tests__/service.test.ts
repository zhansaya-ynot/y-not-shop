import { describe, expect, it, beforeEach } from 'vitest';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import { prisma } from '@/server/db/client';
import { createUser } from '@/server/repositories/user.repo';
import { addItem, applyPromo, getOrCreateCart, removeItem, removePromo, setQuantity, snapshotCart } from '../service';
import { generateCartToken } from '../token';

describe('cart service — getOrCreateCart + snapshotCart', () => {
  beforeEach(async () => { await resetDb(); });

  it('creates a guest cart when neither user nor matching session exists', async () => {
    const token = generateCartToken();
    const cart = await getOrCreateCart({ userId: null, sessionToken: token });
    expect(cart.userId).toBeNull();
    expect(cart.sessionToken).toBe(token);
    expect(cart.items).toEqual([]);
  });

  it('returns the existing guest cart when sessionToken matches', async () => {
    const token = generateCartToken();
    const a = await getOrCreateCart({ userId: null, sessionToken: token });
    const b = await getOrCreateCart({ userId: null, sessionToken: token });
    expect(b.id).toBe(a.id);
  });

  it('creates a user cart when signed in and no cart exists', async () => {
    const u = await createUser({ email: 'a@x.com', passwordHash: 'h', firstName: 'A', lastName: 'B' });
    const cart = await getOrCreateCart({ userId: u.id, sessionToken: null });
    expect(cart.userId).toBe(u.id);
    expect(cart.sessionToken).toBeNull();
  });

  it('snapshotCart computes subtotal, itemCount, and stockAvailable', async () => {
    const product = await prisma.product.create({
      data: {
        slug: 'coat-test',
        name: 'Test Coat',
        description: '',
        materials: '',
        care: '',
        sizing: '',
        priceCents: 25000,
        currency: 'GBP',
        sizes: { create: [{ size: 'S', colour: 'Black', stock: 3 }] },
        images: { create: [{ url: '/img.jpg', alt: '', sortOrder: 0 }] },
      },
      include: { sizes: true, images: true },
    });
    const cart = await prisma.cart.create({
      data: {
        sessionToken: 'tok',
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
        items: { create: [{ productId: product.id, size: 'S', colour: 'Black', quantity: 2, unitPriceCents: 25000 }] },
      },
      include: { items: true },
    });
    const snap = await snapshotCart(cart.id);
    expect(snap.subtotalCents).toBe(50000);
    expect(snap.itemCount).toBe(2);
    expect(snap.items[0].stockAvailable).toBe(3);
    expect(snap.promo).toBeNull();
  });
});

describe('cart service — addItem', () => {
  beforeEach(async () => { await resetDb(); });

  async function makeProduct(stock = 5, price = 10000) {
    return prisma.product.create({
      data: {
        slug: 'p-' + Math.random().toString(36).slice(2, 8),
        name: 'P',
        description: '',
        materials: '',
        care: '',
        sizing: '',
        priceCents: price,
        currency: 'GBP',
        sizes: { create: [{ size: 'S', colour: 'Black', stock }] },
        images: { create: [{ url: '/x.jpg', alt: '', sortOrder: 0 }] },
        colours: { create: [{ name: 'Black', hex: '#000', sortOrder: 0 }] },
      },
    });
  }

  it('adds a new item to an empty cart', async () => {
    const product = await makeProduct(5);
    const token = generateCartToken();
    const cart = await getOrCreateCart({ userId: null, sessionToken: token });
    const snap = await addItem(cart.id, {
      productId: product.id, size: 'S', colour: 'Black', quantity: 2, isPreorder: false,
    });
    expect(snap.items).toHaveLength(1);
    expect(snap.items[0].quantity).toBe(2);
    expect(snap.subtotalCents).toBe(20000);
  });

  it('merges quantity when productId+size match existing line', async () => {
    const product = await makeProduct(5);
    const token = generateCartToken();
    const cart = await getOrCreateCart({ userId: null, sessionToken: token });
    await addItem(cart.id, { productId: product.id, size: 'S', colour: 'Black', quantity: 2, isPreorder: false });
    const snap = await addItem(cart.id, { productId: product.id, size: 'S', colour: 'Black', quantity: 1, isPreorder: false });
    expect(snap.items).toHaveLength(1);
    expect(snap.items[0].quantity).toBe(3);
  });

  it('throws StockConflictError when requested qty exceeds stock', async () => {
    const product = await makeProduct(2);
    const token = generateCartToken();
    const cart = await getOrCreateCart({ userId: null, sessionToken: token });
    await expect(
      addItem(cart.id, { productId: product.id, size: 'S', colour: 'Black', quantity: 5, isPreorder: false }),
    ).rejects.toThrow(/stock/i);
  });

  it('auto-assigns preorder items to the active PreorderBatch', async () => {
    const product = await prisma.product.create({
      data: {
        slug: 'p-pre-' + Math.random().toString(36).slice(2, 6),
        name: 'P', priceCents: 30000, currency: 'GBP',
        description: '', materials: '', care: '', sizing: '',
        preOrder: true,
        sizes: { create: [{ size: 'S', colour: 'Black', stock: 5 }] },
        images: { create: [{ url: '/x.jpg', alt: '', sortOrder: 0 }] },
      },
    });
    // Two batches — earliest estimatedShipFrom should win.
    await prisma.preorderBatch.create({
      data: {
        name: 'Later batch',
        productId: product.id,
        estimatedShipFrom: new Date('2026-09-01'),
        estimatedShipTo: new Date('2026-09-15'),
        status: 'PENDING',
      },
    });
    const earlyBatch = await prisma.preorderBatch.create({
      data: {
        name: 'Earlier batch',
        productId: product.id,
        estimatedShipFrom: new Date('2026-07-01'),
        estimatedShipTo: new Date('2026-07-15'),
        status: 'IN_PRODUCTION',
      },
    });
    const cart = await getOrCreateCart({ userId: null, sessionToken: generateCartToken() });
    await addItem(cart.id, {
      productId: product.id, size: 'S', colour: 'Black', quantity: 1, isPreorder: true,
    });
    const row = await prisma.cartItem.findFirstOrThrow({ where: { cartId: cart.id } });
    expect(row.isPreorder).toBe(true);
    expect(row.preorderBatchId).toBe(earlyBatch.id);
  });

  it('does not assign a batch for non-preorder products', async () => {
    const product = await makeProduct(5);
    const cart = await getOrCreateCart({ userId: null, sessionToken: generateCartToken() });
    await addItem(cart.id, {
      productId: product.id, size: 'S', colour: 'Black', quantity: 1, isPreorder: false,
    });
    const row = await prisma.cartItem.findFirstOrThrow({ where: { cartId: cart.id } });
    expect(row.preorderBatchId).toBeNull();
  });

  it('adds a preorder colour with no stock row (made-to-order, no inventory)', async () => {
    // Preorder product whose selected (size, colour) has NO ProductSize row —
    // e.g. a coloured preorder where stock was never set. Must still add.
    const product = await prisma.product.create({
      data: {
        slug: 'p-pre-nostock-' + Math.random().toString(36).slice(2, 6),
        name: 'Olive Coat', priceCents: 48000, currency: 'GBP',
        description: '', materials: '', care: '', sizing: '',
        preOrder: true,
        colours: { create: [{ name: 'Olive', hex: '#556B2F', sortOrder: 0 }] },
        images: { create: [{ url: '/x.jpg', alt: '', sortOrder: 0 }] },
        // Note: no sizes/stock rows at all.
      },
    });
    const cart = await getOrCreateCart({ userId: null, sessionToken: generateCartToken() });
    const snap = await addItem(cart.id, {
      productId: product.id, size: 'M', colour: 'Olive', quantity: 1, isPreorder: true,
    });
    expect(snap.items).toHaveLength(1);
    expect(snap.items[0].isPreorder).toBe(true);
    expect(snap.items[0].colour).toBe('Olive');
  });
});

describe('cart service — setQuantity / removeItem', () => {
  beforeEach(async () => { await resetDb(); });

  async function seedCartWithItem() {
    const product = await prisma.product.create({
      data: {
        slug: 'p-set-' + Math.random().toString(36).slice(2, 6),
        name: 'P',
        description: '',
        materials: '',
        care: '',
        sizing: '',
        priceCents: 5000,
        currency: 'GBP',
        sizes: { create: [{ size: 'S', colour: 'Black', stock: 5 }] },
        images: { create: [{ url: '/x.jpg', alt: '', sortOrder: 0 }] },
      },
    });
    const cart = await getOrCreateCart({ userId: null, sessionToken: generateCartToken() });
    const snap = await addItem(cart.id, { productId: product.id, size: 'S', colour: 'Black', quantity: 2, isPreorder: false });
    return { cart, item: snap.items[0]!, product };
  }

  it('setQuantity adjusts an item up', async () => {
    const { cart, item } = await seedCartWithItem();
    const snap = await setQuantity(cart.id, item.id, 4);
    expect(snap.items[0].quantity).toBe(4);
  });

  it('setQuantity rejects when above stock', async () => {
    const { cart, item } = await seedCartWithItem();
    await expect(setQuantity(cart.id, item.id, 99)).rejects.toThrow(/stock/i);
  });

  it('setQuantity to 0 removes the item', async () => {
    const { cart, item } = await seedCartWithItem();
    const snap = await setQuantity(cart.id, item.id, 0);
    expect(snap.items).toHaveLength(0);
  });

  it('removeItem deletes the line', async () => {
    const { cart, item } = await seedCartWithItem();
    const snap = await removeItem(cart.id, item.id);
    expect(snap.items).toHaveLength(0);
    expect(snap.itemCount).toBe(0);
  });
});

describe('cart service — applyPromo / removePromo', () => {
  beforeEach(async () => { await resetDb(); });

  async function seedCartWithSubtotal(amount: number) {
    const product = await prisma.product.create({
      data: {
        slug: 'p-promo-' + Math.random().toString(36).slice(2, 6),
        name: 'P',
        description: '',
        materials: '',
        care: '',
        sizing: '',
        priceCents: amount,
        currency: 'GBP',
        sizes: { create: [{ size: 'S', colour: 'Black', stock: 5 }] },
        images: { create: [{ url: '/x.jpg', alt: '', sortOrder: 0 }] },
      },
    });
    const cart = await getOrCreateCart({ userId: null, sessionToken: generateCartToken() });
    await addItem(cart.id, { productId: product.id, size: 'S', colour: 'Black', quantity: 1, isPreorder: false });
    return cart;
  }

  it('applies a PERCENT promo and computes discount', async () => {
    const cart = await seedCartWithSubtotal(20000);
    await prisma.promoCode.create({
      data: { code: 'WELCOME10', discountType: 'PERCENT', discountValue: 10, minOrderCents: 0, isActive: true },
    });
    const snap = await applyPromo(cart.id, 'WELCOME10');
    expect(snap.promo).toEqual({ code: 'WELCOME10', discountCents: 2000 });
    expect(snap.discountCents).toBe(2000);
  });

  it('applies a FIXED promo', async () => {
    const cart = await seedCartWithSubtotal(20000);
    await prisma.promoCode.create({
      data: { code: 'GBP5OFF', discountType: 'FIXED', discountValue: 500, minOrderCents: 0, isActive: true },
    });
    const snap = await applyPromo(cart.id, 'GBP5OFF');
    expect(snap.promo).toEqual({ code: 'GBP5OFF', discountCents: 500 });
  });

  it('rejects unknown promo with NOT_FOUND', async () => {
    const cart = await seedCartWithSubtotal(20000);
    await expect(applyPromo(cart.id, 'NOPE')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('rejects expired promo', async () => {
    const cart = await seedCartWithSubtotal(20000);
    await prisma.promoCode.create({
      data: { code: 'OLD', discountType: 'PERCENT', discountValue: 10, isActive: true, expiresAt: new Date(Date.now() - 1000) },
    });
    await expect(applyPromo(cart.id, 'OLD')).rejects.toMatchObject({ code: 'EXPIRED' });
  });

  it('rejects when subtotal below minOrderCents', async () => {
    const cart = await seedCartWithSubtotal(5000);
    await prisma.promoCode.create({
      data: { code: 'BIG', discountType: 'PERCENT', discountValue: 10, minOrderCents: 10000, isActive: true },
    });
    await expect(applyPromo(cart.id, 'BIG')).rejects.toMatchObject({ code: 'MIN_ORDER' });
  });

  it('rejects when usageLimit reached', async () => {
    const cart = await seedCartWithSubtotal(20000);
    await prisma.promoCode.create({
      data: { code: 'MAXED', discountType: 'PERCENT', discountValue: 10, usageLimit: 1, usageCount: 1, isActive: true },
    });
    await expect(applyPromo(cart.id, 'MAXED')).rejects.toMatchObject({ code: 'LIMIT_REACHED' });
  });

  it('removePromo clears the discount', async () => {
    const cart = await seedCartWithSubtotal(20000);
    await prisma.promoCode.create({
      data: { code: 'X', discountType: 'PERCENT', discountValue: 10, isActive: true },
    });
    await applyPromo(cart.id, 'X');
    const snap = await removePromo(cart.id);
    expect(snap.promo).toBeNull();
    expect(snap.discountCents).toBe(0);
  });
});
