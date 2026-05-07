import { describe, expect, it, beforeEach } from 'vitest';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import { prisma } from '@/server/db/client';
import { getOverviewKpis, getRecentOrders, getTopProducts } from '../service';

async function seedOrder(opts: {
  totalCents?: number;
  status?: 'NEW' | 'DELIVERED' | 'CANCELLED' | 'PAYMENT_FAILED' | 'PENDING_PAYMENT';
  createdAt?: Date;
  withShipment?: { labelGenerated?: boolean };
}) {
  const order = await prisma.order.create({
    data: {
      orderNumber: 'YN-' + Math.random().toString(36).slice(2, 10).toUpperCase(),
      status: opts.status ?? 'NEW',
      subtotalCents: opts.totalCents ?? 5000,
      shippingCents: 0,
      discountCents: 0,
      totalCents: opts.totalCents ?? 5000,
      currency: 'GBP',
      carrier: 'ROYAL_MAIL',
      shipFirstName: 'A',
      shipLastName: 'B',
      shipLine1: '1',
      shipCity: 'L',
      shipPostcode: 'SW1',
      shipCountry: 'GB',
      shipPhone: '+44',
      ...(opts.createdAt ? { createdAt: opts.createdAt } : {}),
      ...(opts.withShipment
        ? {
            shipments: {
              create: [
                {
                  carrier: 'ROYAL_MAIL',
                  labelGeneratedAt: opts.withShipment.labelGenerated
                    ? new Date()
                    : null,
                },
              ],
            },
          }
        : {}),
    },
  });
  return order;
}

describe('getOverviewKpis', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('aggregates today/week/month revenue and excludes non-revenue statuses', async () => {
    const now = new Date('2026-05-15T12:00:00Z'); // Thursday
    // Today
    await seedOrder({ totalCents: 4000, status: 'NEW', createdAt: now });
    // This week, earlier (Monday) — same week, not today
    await seedOrder({
      totalCents: 6000,
      status: 'DELIVERED',
      createdAt: new Date('2026-05-11T08:00:00Z'),
    });
    // This month, last week
    await seedOrder({
      totalCents: 3000,
      status: 'DELIVERED',
      createdAt: new Date('2026-05-04T08:00:00Z'),
    });
    // Cancelled today — must be excluded.
    await seedOrder({ totalCents: 9999, status: 'CANCELLED', createdAt: now });
    // Pending payment today — must be excluded.
    await seedOrder({
      totalCents: 8888,
      status: 'PENDING_PAYMENT',
      createdAt: now,
    });
    // Last month — excluded from month bucket.
    await seedOrder({
      totalCents: 50000,
      status: 'DELIVERED',
      createdAt: new Date('2026-04-15T08:00:00Z'),
    });

    const kpi = await getOverviewKpis(now);
    expect(kpi.revenueTodayCents).toBe(4000);
    expect(kpi.revenueWeekCents).toBe(10000); // today (4000) + Mon (6000)
    expect(kpi.revenueMonthCents).toBe(13000); // 10000 + 3000 (May 4)
    expect(kpi.ordersToday).toBe(1);
    expect(kpi.ordersWeek).toBe(2);
    // Month: 3 captured orders, 13000 → AOV ~= 4333
    expect(kpi.averageOrderValueMonthCents).toBe(4333);
  });

  it('outstandingShipments counts paid-but-unlabeled, ignores cancelled labels', async () => {
    await seedOrder({
      status: 'NEW',
      withShipment: { labelGenerated: false },
    });
    await seedOrder({
      status: 'NEW',
      withShipment: { labelGenerated: true },
    });
    // Cancelled order — its shipment must not count even if no label.
    await seedOrder({
      status: 'CANCELLED',
      withShipment: { labelGenerated: false },
    });
    const kpi = await getOverviewKpis(new Date('2026-05-15T12:00:00Z'));
    expect(kpi.outstandingShipments).toBe(1);
  });
});

describe('getRecentOrders', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('returns the most recent N orders newest-first', async () => {
    const a = await seedOrder({ totalCents: 1000 });
    await new Promise((r) => setTimeout(r, 5));
    const b = await seedOrder({ totalCents: 2000 });
    await new Promise((r) => setTimeout(r, 5));
    const c = await seedOrder({ totalCents: 3000 });
    const recent = await getRecentOrders(2);
    expect(recent).toHaveLength(2);
    expect(recent[0].id).toBe(c.id);
    expect(recent[1].id).toBe(b.id);
    expect(recent[0].customerName).toBe('A B');
    expect(a.id).toBeDefined();
  });
});

describe('getTopProducts', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('ranks products by revenue this month and excludes non-revenue orders', async () => {
    const p1 = await prisma.product.create({
      data: {
        slug: 'top-1', name: 'Top1', priceCents: 5000, currency: 'GBP',
        description: '', materials: '', care: '', sizing: '',
      },
    });
    const p2 = await prisma.product.create({
      data: {
        slug: 'top-2', name: 'Top2', priceCents: 1000, currency: 'GBP',
        description: '', materials: '', care: '', sizing: '',
      },
    });
    const now = new Date('2026-05-15T12:00:00Z');
    await prisma.order.create({
      data: {
        orderNumber: 'YN-X1', status: 'DELIVERED',
        subtotalCents: 5000, shippingCents: 0, discountCents: 0,
        totalCents: 5000, currency: 'GBP', carrier: 'ROYAL_MAIL',
        shipFirstName: 'A', shipLastName: 'B', shipLine1: '1',
        shipCity: 'L', shipPostcode: 'SW1', shipCountry: 'GB',
        shipPhone: '+44', createdAt: now,
        items: {
          create: [
            { productId: p1.id, productSlug: p1.slug, productName: 'Top1',
              productImage: '/x.jpg', colour: 'Black', size: 'M',
              unitPriceCents: 5000, currency: 'GBP', quantity: 1 },
            { productId: p2.id, productSlug: p2.slug, productName: 'Top2',
              productImage: '/x.jpg', colour: 'Black', size: 'M',
              unitPriceCents: 1000, currency: 'GBP', quantity: 3 },
          ],
        },
      },
    });
    // Cancelled order with p2 — must be excluded.
    await prisma.order.create({
      data: {
        orderNumber: 'YN-X2', status: 'CANCELLED',
        subtotalCents: 99999, shippingCents: 0, discountCents: 0,
        totalCents: 99999, currency: 'GBP', carrier: 'ROYAL_MAIL',
        shipFirstName: 'A', shipLastName: 'B', shipLine1: '1',
        shipCity: 'L', shipPostcode: 'SW1', shipCountry: 'GB',
        shipPhone: '+44', createdAt: now,
        items: {
          create: [
            { productId: p2.id, productSlug: p2.slug, productName: 'Top2',
              productImage: '/x.jpg', colour: 'Black', size: 'M',
              unitPriceCents: 1000, currency: 'GBP', quantity: 99 },
          ],
        },
      },
    });

    const top = await getTopProducts(now, 5);
    expect(top).toHaveLength(2);
    expect(top[0].productId).toBe(p1.id); // 5000 revenue beats 3000
    expect(top[0].revenueCents).toBe(5000);
    expect(top[0].units).toBe(1);
    expect(top[1].productId).toBe(p2.id);
    expect(top[1].revenueCents).toBe(3000); // 1000 * 3, cancelled excluded
    expect(top[1].units).toBe(3);
  });
});
