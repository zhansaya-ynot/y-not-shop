import { describe, expect, it, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { prisma } from '@/server/db/client';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import AdminDashboard from '../page';

async function seedDashboardFixtures() {
  // 2 DRAFT products → "Drafts pending publish" = 2
  await prisma.product.create({
    data: {
      name: 'Draft One',
      slug: 'draft-one',
      description: 'd',
      priceCents: 10000,
      materials: '',
      care: '',
      sizing: '',
      status: 'DRAFT',
    },
  });
  await prisma.product.create({
    data: {
      name: 'Draft Two',
      slug: 'draft-two',
      description: 'd',
      priceCents: 10000,
      materials: '',
      care: '',
      sizing: '',
      status: 'DRAFT',
    },
  });
  // 1 PUBLISHED product (not counted as draft)
  const published = await prisma.product.create({
    data: {
      name: 'Published',
      slug: 'published',
      description: 'd',
      priceCents: 10000,
      materials: '',
      care: '',
      sizing: '',
      status: 'PUBLISHED',
    },
  });
  // 1 soft-deleted DRAFT (not counted)
  await prisma.product.create({
    data: {
      name: 'Deleted Draft',
      slug: 'deleted-draft',
      description: 'd',
      priceCents: 10000,
      materials: '',
      care: '',
      sizing: '',
      status: 'DRAFT',
      deletedAt: new Date(),
    },
  });

  // Low-stock alerts: ProductSize.stock <= 2 → all 3 sizes are low here
  await prisma.productSize.createMany({
    data: [
      { productId: published.id, size: 'S', stock: 0 },
      { productId: published.id, size: 'M', stock: 2 },
      { productId: published.id, size: 'L', stock: 1 },
    ],
  });

  // Active promos: 2 active (one no expiry, one future); 1 inactive; 1 expired
  await prisma.promoCode.create({
    data: {
      code: 'ACTIVE-FOREVER',
      discountType: 'FIXED',
      discountValue: 500,
      isActive: true,
    },
  });
  await prisma.promoCode.create({
    data: {
      code: 'ACTIVE-FUTURE',
      discountType: 'PERCENT',
      discountValue: 10,
      isActive: true,
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    },
  });
  await prisma.promoCode.create({
    data: {
      code: 'INACTIVE',
      discountType: 'FIXED',
      discountValue: 500,
      isActive: false,
    },
  });
  await prisma.promoCode.create({
    data: {
      code: 'EXPIRED',
      discountType: 'FIXED',
      discountValue: 500,
      isActive: true,
      expiresAt: new Date(Date.now() - 24 * 3600 * 1000),
    },
  });
}

describe('/admin dashboard', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('renders the original Phase 5 cards (pending shipments, returns, label-failure, tracking-stale)', async () => {
    const el = await AdminDashboard();
    const html = renderToString(el);
    expect(html).toContain('Pending shipments');
    expect(html).toContain('Returns awaiting inspection');
    expect(html).toContain('Label-failure alerts');
    expect(html).toContain('Tracking-stale alerts (&gt;48h)');
  });

  it('renders the new Phase 7a cards (drafts, low-stock, active promos)', async () => {
    const el = await AdminDashboard();
    const html = renderToString(el);
    expect(html).toContain('Drafts pending publish');
    expect(html).toContain('Low-stock alerts');
    expect(html).toContain('Active promos');
  });

  it('drafts card counts only non-deleted DRAFT products', async () => {
    await seedDashboardFixtures();
    const el = await AdminDashboard();
    const html = renderToString(el);
    // Find the "Drafts pending publish" card and assert its count is 2.
    const m = html.match(/Drafts pending publish[\s\S]*?>(\d+)</);
    expect(m).not.toBeNull();
    expect(m![1]).toBe('2');
  });

  it('low-stock card counts ProductSize rows with stock <= 2', async () => {
    await seedDashboardFixtures();
    const el = await AdminDashboard();
    const html = renderToString(el);
    const m = html.match(/Low-stock alerts[\s\S]*?>(\d+)</);
    expect(m).not.toBeNull();
    expect(m![1]).toBe('3');
  });

  it('active promos card counts isActive AND (no expiry OR future expiry)', async () => {
    await seedDashboardFixtures();
    const el = await AdminDashboard();
    const html = renderToString(el);
    const m = html.match(/Active promos[\s\S]*?>(\d+)</);
    expect(m).not.toBeNull();
    expect(m![1]).toBe('2');
  });

  it('renders 7 metric cards in total', async () => {
    const el = await AdminDashboard();
    const html = renderToString(el);
    // Each card is a Link with rounded-lg border classes; the marker
    // we use is the uppercase tracking label container.
    const matches = html.match(/text-xs uppercase tracking-wider/g) ?? [];
    expect(matches.length).toBe(7);
  });
});
