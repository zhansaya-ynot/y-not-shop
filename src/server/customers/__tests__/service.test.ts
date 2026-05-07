import { describe, expect, it, beforeEach } from 'vitest';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import { prisma } from '@/server/db/client';
import { listCustomersForAdmin, getCustomerForAdmin } from '../service';

async function seedUser(overrides: Partial<{
  email: string;
  name: string;
  isGuest: boolean;
  role: 'CUSTOMER' | 'ADMIN' | 'OWNER';
}> = {}) {
  return prisma.user.create({
    data: {
      email: overrides.email ?? `c-${Math.random().toString(36).slice(2, 8)}@x.com`,
      name: overrides.name ?? 'Test',
      isGuest: overrides.isGuest ?? false,
      role: overrides.role ?? 'CUSTOMER',
    },
  });
}

async function seedOrder(opts: {
  userId?: string | null;
  status?: 'NEW' | 'DELIVERED' | 'CANCELLED' | 'PAYMENT_FAILED' | 'PENDING_PAYMENT';
  totalCents?: number;
  shipLine1?: string;
  shipPostcode?: string;
}) {
  return prisma.order.create({
    data: {
      orderNumber: 'YN-' + Math.random().toString(36).slice(2, 10).toUpperCase(),
      status: opts.status ?? 'DELIVERED',
      subtotalCents: opts.totalCents ?? 5000,
      shippingCents: 0,
      discountCents: 0,
      totalCents: opts.totalCents ?? 5000,
      currency: 'GBP',
      carrier: 'ROYAL_MAIL',
      shipFirstName: 'A',
      shipLastName: 'B',
      shipLine1: opts.shipLine1 ?? '1 High St',
      shipCity: 'L',
      shipPostcode: opts.shipPostcode ?? 'SW1 1AA',
      shipCountry: 'GB',
      shipPhone: '+44',
      userId: opts.userId ?? null,
    },
  });
}

describe('listCustomersForAdmin', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('returns customers newest-first with revenue + last-order aggregates', async () => {
    const oldUser = await seedUser({ name: 'Old', email: 'old@x.com' });
    // Force a tiny delay so createdAt ordering is stable.
    await new Promise((r) => setTimeout(r, 5));
    const newUser = await seedUser({ name: 'New', email: 'new@x.com' });
    const guestUser = await seedUser({ name: 'Guest', isGuest: true });

    // oldUser: 2 captured orders + 1 cancelled (cancelled excluded from spend).
    await seedOrder({ userId: oldUser.id, totalCents: 4000, status: 'DELIVERED' });
    await seedOrder({ userId: oldUser.id, totalCents: 6000, status: 'NEW' });
    await seedOrder({
      userId: oldUser.id,
      totalCents: 9999,
      status: 'CANCELLED',
    });
    // newUser: no orders.
    // guestUser: 1 order.
    await seedOrder({ userId: guestUser.id, totalCents: 2000 });

    const all = await listCustomersForAdmin({});
    expect(all).toHaveLength(3);
    // Newest first.
    expect(all[0].id).toBe(guestUser.id);
    expect(all[1].id).toBe(newUser.id);
    expect(all[2].id).toBe(oldUser.id);

    const old = all.find((c) => c.id === oldUser.id)!;
    expect(old.ordersCount).toBe(2);
    expect(old.lifetimeSpendCents).toBe(10000);
    expect(old.lastOrderAt).not.toBeNull();

    const fresh = all.find((c) => c.id === newUser.id)!;
    expect(fresh.ordersCount).toBe(0);
    expect(fresh.lifetimeSpendCents).toBe(0);
    expect(fresh.lastOrderAt).toBeNull();
  });

  it('hideGuests filter excludes guest users', async () => {
    await seedUser({ name: 'Real', isGuest: false });
    await seedUser({ name: 'Guesty', isGuest: true });
    const filtered = await listCustomersForAdmin({ hideGuests: true });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].isGuest).toBe(false);
  });

  it('search matches name or email case-insensitively', async () => {
    await seedUser({ name: 'Alice Smith', email: 'alice@example.com' });
    await seedUser({ name: 'Bob Jones', email: 'bob@example.com' });
    const byName = await listCustomersForAdmin({ search: 'alice' });
    expect(byName.map((c) => c.email)).toContain('alice@example.com');
    expect(byName.map((c) => c.email)).not.toContain('bob@example.com');
    const byEmail = await listCustomersForAdmin({ search: 'BOB@' });
    expect(byEmail.map((c) => c.email)).toContain('bob@example.com');
  });

  it('role filter', async () => {
    await seedUser({ role: 'CUSTOMER' });
    const owner = await seedUser({ role: 'OWNER', email: 'o@x.com' });
    const owners = await listCustomersForAdmin({ role: 'OWNER' });
    expect(owners.map((c) => c.id)).toEqual([owner.id]);
  });
});

describe('getCustomerForAdmin', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('returns full detail with stats, orders, and deduplicated addresses', async () => {
    const user = await seedUser({ name: 'Detail', email: 'd@x.com' });
    await seedOrder({ userId: user.id, totalCents: 5000, status: 'DELIVERED' });
    await seedOrder({ userId: user.id, totalCents: 3000, status: 'NEW' });
    // Cancelled — excluded from spend/AOV.
    await seedOrder({
      userId: user.id,
      totalCents: 9999,
      status: 'CANCELLED',
    });
    // Duplicate address (same line1+postcode, different case).
    await seedOrder({
      userId: user.id,
      totalCents: 1000,
      shipLine1: '1 HIGH ST',
      shipPostcode: 'sw1 1aa',
    });
    // Distinct address.
    await seedOrder({
      userId: user.id,
      totalCents: 2000,
      shipLine1: '99 Kings Rd',
      shipPostcode: 'SW3 4AA',
    });

    const detail = await getCustomerForAdmin(user.id);
    expect(detail).not.toBeNull();
    expect(detail!.email).toBe('d@x.com');
    // 4 captured orders (5000+3000+1000+2000=11000); cancelled excluded.
    expect(detail!.ordersCount).toBe(4);
    expect(detail!.lifetimeSpendCents).toBe(11000);
    expect(detail!.averageOrderValueCents).toBe(2750);
    expect(detail!.orders).toHaveLength(5); // includes cancelled in history
    // Addresses deduplicated to 2 (the duplicate case-variant + distinct one).
    expect(detail!.addresses).toHaveLength(2);
  });

  it('returns null for missing user', async () => {
    expect(await getCustomerForAdmin('does-not-exist')).toBeNull();
  });
});
