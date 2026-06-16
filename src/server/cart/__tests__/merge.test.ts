import { describe, expect, it, beforeEach } from 'vitest';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import { prisma } from '@/server/db/client';
import { createUser } from '@/server/repositories/user.repo';
import { mergeGuestIntoUser } from '../merge';
import { addItem, getOrCreateCart, snapshotCart } from '../service';
import { generateCartToken } from '../token';

describe('mergeGuestIntoUser', () => {
  beforeEach(async () => { await resetDb(); });

  async function seedProduct(opts: { stock: number; price: number; slug: string }) {
    return prisma.product.create({
      data: {
        slug: opts.slug,
        name: 'P',
        description: '',
        materials: '',
        care: '',
        sizing: '',
        priceCents: opts.price,
        currency: 'GBP',
        sizes: { create: [{ size: 'S', colour: 'Black', stock: opts.stock }] },
        images: { create: [{ url: '/x.jpg', alt: '', sortOrder: 0 }] },
      },
    });
  }

  it('adopts guest cart when user has none', async () => {
    const product = await seedProduct({ stock: 5, price: 10000, slug: 'p1' });
    const u = await createUser({ email: 'a@x.com', passwordHash: 'h', firstName: 'A', lastName: 'B' });
    const guestToken = generateCartToken();
    const guest = await getOrCreateCart({ userId: null, sessionToken: guestToken });
    await addItem(guest.id, { productId: product.id, size: 'S', colour: 'Black', quantity: 1, isPreorder: false });

    const merged = await mergeGuestIntoUser({ userId: u.id, guestSessionToken: guestToken });
    expect(merged.id).toBe(guest.id); // adopted, same row
    expect(merged.userId).toBe(u.id);
    const snap = await snapshotCart(merged.id);
    expect(snap.items).toHaveLength(1);
  });

  it('merges items by (productId, size) into existing user cart', async () => {
    const product = await seedProduct({ stock: 5, price: 10000, slug: 'p2' });
    const u = await createUser({ email: 'a@x.com', passwordHash: 'h', firstName: 'A', lastName: 'B' });
    const userCart = await getOrCreateCart({ userId: u.id, sessionToken: null });
    await addItem(userCart.id, { productId: product.id, size: 'S', colour: 'Black', quantity: 1, isPreorder: false });

    const guestToken = generateCartToken();
    const guest = await getOrCreateCart({ userId: null, sessionToken: guestToken });
    await addItem(guest.id, { productId: product.id, size: 'S', colour: 'Black', quantity: 2, isPreorder: false });

    const merged = await mergeGuestIntoUser({ userId: u.id, guestSessionToken: guestToken });
    expect(merged.id).toBe(userCart.id);
    const snap = await snapshotCart(merged.id);
    expect(snap.items).toHaveLength(1);
    expect(snap.items[0].quantity).toBe(3); // 1 + 2
    // Guest cart deleted.
    const ghost = await prisma.cart.findUnique({ where: { sessionToken: guestToken } });
    expect(ghost).toBeNull();
  });

  it('caps merged quantity to stock', async () => {
    const product = await seedProduct({ stock: 3, price: 10000, slug: 'p3' });
    const u = await createUser({ email: 'a@x.com', passwordHash: 'h', firstName: 'A', lastName: 'B' });
    const userCart = await getOrCreateCart({ userId: u.id, sessionToken: null });
    await addItem(userCart.id, { productId: product.id, size: 'S', colour: 'Black', quantity: 2, isPreorder: false });

    const guestToken = generateCartToken();
    const guest = await getOrCreateCart({ userId: null, sessionToken: guestToken });
    await addItem(guest.id, { productId: product.id, size: 'S', colour: 'Black', quantity: 2, isPreorder: false });

    const merged = await mergeGuestIntoUser({ userId: u.id, guestSessionToken: guestToken });
    const snap = await snapshotCart(merged.id);
    expect(snap.items[0].quantity).toBe(3); // capped at stock 3
  });

  it('prefers user cart promo when both have one', async () => {
    const u = await createUser({ email: 'a@x.com', passwordHash: 'h', firstName: 'A', lastName: 'B' });
    const userPromo = await prisma.promoCode.create({
      data: { code: 'USER10', discountType: 'PERCENT', discountValue: 10, isActive: true },
    });
    const guestPromo = await prisma.promoCode.create({
      data: { code: 'GUEST20', discountType: 'PERCENT', discountValue: 20, isActive: true },
    });
    const userCart = await getOrCreateCart({ userId: u.id, sessionToken: null });
    await prisma.cart.update({ where: { id: userCart.id }, data: { promoCodeId: userPromo.id } });
    const guestToken = generateCartToken();
    const guest = await getOrCreateCart({ userId: null, sessionToken: guestToken });
    await prisma.cart.update({ where: { id: guest.id }, data: { promoCodeId: guestPromo.id } });

    const merged = await mergeGuestIntoUser({ userId: u.id, guestSessionToken: guestToken });
    const m = await prisma.cart.findUniqueOrThrow({ where: { id: merged.id } });
    expect(m.promoCodeId).toBe(userPromo.id);
  });

  it('returns user cart unchanged when guest cart does not exist', async () => {
    const u = await createUser({ email: 'a@x.com', passwordHash: 'h', firstName: 'A', lastName: 'B' });
    const userCart = await getOrCreateCart({ userId: u.id, sessionToken: null });
    const merged = await mergeGuestIntoUser({ userId: u.id, guestSessionToken: 'never-existed' });
    expect(merged.id).toBe(userCart.id);
  });
});
