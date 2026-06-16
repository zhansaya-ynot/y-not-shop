import { describe, expect, it, beforeEach, vi } from 'vitest';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import { prisma } from '@/server/db/client';
import { GET as getCart } from '../route';
import { POST as addItem } from '../items/route';
import { mergeGuestIntoUser } from '@/server/cart/merge';
import { createUser } from '@/server/repositories/user.repo';
import { generateCartToken } from '@/server/cart/token';

// resolveCart uses Next.js cookies() which is unavailable in test env.
// We mock it at the module level so route handlers under test get a
// controllable cart without touching the cookie store.
const resolveCartMock = vi.fn();
vi.mock('@/server/cart/resolve', () => ({
  resolveCart: () => resolveCartMock(),
}));

describe('cart full lifecycle (guest → signin → merge)', () => {
  beforeEach(async () => {
    await resetDb();
    vi.clearAllMocks();
  });

  it('end-to-end', async () => {
    const product = await prisma.product.create({
      data: {
        slug: 'flow',
        name: 'P',
        description: '',
        materials: '',
        care: '',
        sizing: '',
        priceCents: 10000,
        currency: 'GBP',
        sizes: { create: [{ size: 'S', colour: 'Black', stock: 5 }] },
        images: { create: [{ url: '/x.jpg', alt: '', sortOrder: 0 }] },
      },
    });

    // 1) Guest GET — create a guest cart and return its snapshot.
    const guestToken = generateCartToken();
    const guestCart = await prisma.cart.create({
      data: {
        sessionToken: guestToken,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      include: { items: true },
    });
    resolveCartMock.mockResolvedValue(guestCart);
    const r1 = await getCart(new Request('http://localhost/api/cart'));
    expect(r1.status).toBe(200);
    const emptySnap = await r1.json();
    expect(emptySnap.items).toHaveLength(0);

    // 2) Guest adds item — resolveCart still returns the guest cart.
    resolveCartMock.mockResolvedValue(guestCart);
    const r2 = await addItem(
      new Request('http://localhost/api/cart/items', {
        method: 'POST',
        body: JSON.stringify({ productId: product.id, size: 'S', colour: 'Black', quantity: 1, isPreorder: false }),
        headers: { 'content-type': 'application/json' },
      }),
    );
    expect(r2.status).toBe(200);
    const guestSnap = await r2.json();
    expect(guestSnap.itemCount).toBe(1);

    // 3) Sign in — directly invoke mergeGuestIntoUser (simulates what happens on session sign-in).
    const user = await createUser({ email: 'a@x.com', passwordHash: 'h', firstName: 'A', lastName: 'B' });
    const merged = await mergeGuestIntoUser({ userId: user.id, guestSessionToken: guestToken });
    expect(merged.userId).toBe(user.id);

    // 4) After-signin GET — resolveCart returns the merged (user-owned) cart.
    const mergedWithItems = await prisma.cart.findUniqueOrThrow({
      where: { id: merged.id },
      include: { items: true },
    });
    resolveCartMock.mockResolvedValue(mergedWithItems);
    const r3 = await getCart(new Request('http://localhost/api/cart'));
    expect(r3.status).toBe(200);
    const userSnap = await r3.json();
    expect(userSnap.items).toHaveLength(1);
    expect(userSnap.id).toBe(merged.id);
  });
});
