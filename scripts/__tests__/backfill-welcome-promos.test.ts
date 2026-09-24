import { describe, expect, it, beforeEach } from 'vitest';
import { prisma } from '@/server/db/client';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import { backfillWelcomePromos } from '../backfill-welcome-promos';

/**
 * Customers who registered before the welcome discount shipped never got a
 * code, because nothing issued one. This hands them theirs retroactively.
 *
 * Who qualifies is the whole question: only people who registered properly
 * and proved their address. Guest rows created by checkout never asked for
 * an account, and an unverified address may not belong to the person who
 * typed it.
 */
async function user(overrides: Record<string, unknown> = {}) {
  return prisma.user.create({
    data: {
      email: `u${Math.random().toString(36).slice(2, 10)}@x.com`,
      passwordHash: '$2b$10$h',
      emailVerifiedAt: new Date('2026-09-23T15:17:00Z'),
      ...overrides,
    },
  });
}

async function order(userId: string, status: 'DELIVERED' | 'CANCELLED' | 'PAYMENT_FAILED') {
  return prisma.order.create({
    data: {
      orderNumber: `YN-2026-${Math.floor(Math.random() * 90000 + 10000)}`,
      userId,
      status,
      carrier: 'ROYAL_MAIL',
      subtotalCents: 50000,
      shippingCents: 0,
      totalCents: 50000,
      shipFirstName: 'A',
      shipLastName: 'B',
      shipLine1: '1 St',
      shipCity: 'London',
      shipPostcode: 'SW1',
      shipCountry: 'GB',
      shipPhone: '',
    },
  });
}

describe('backfillWelcomePromos', () => {
  beforeEach(() => resetDb());

  it('issues a code to a registered customer who confirmed their address', async () => {
    const u = await user({ name: 'Robyn Mackay' });

    const result = await backfillWelcomePromos();

    expect(result.issued).toBe(1);
    const job = await prisma.emailJob.findFirstOrThrow({
      where: { template: 'WelcomeDiscount' },
    });
    expect(job.recipientEmail).toBe(u.email);
  });

  it('skips guest rows created by checkout — they never opened an account', async () => {
    await user({ isGuest: true, passwordHash: null });

    const result = await backfillWelcomePromos();

    expect(result.issued).toBe(0);
    expect(await prisma.promoCode.count()).toBe(0);
  });

  it('skips addresses nobody has confirmed', async () => {
    await user({ emailVerifiedAt: null });

    const result = await backfillWelcomePromos();

    expect(result.issued).toBe(0);
  });

  it('skips deleted accounts', async () => {
    await user({ deletedAt: new Date() });

    const result = await backfillWelcomePromos();

    expect(result.issued).toBe(0);
  });

  it('is safe to run twice — nobody collects a second code', async () => {
    await user();

    const first = await backfillWelcomePromos();
    const second = await backfillWelcomePromos();

    expect(first.issued).toBe(1);
    expect(second.issued).toBe(0);
    expect(second.skipped).toBe(1);
    expect(await prisma.promoCode.count()).toBe(1);
  });

  it('reports how many it handled across a mixed set', async () => {
    await user();
    await user();
    await user({ emailVerifiedAt: null });
    await user({ isGuest: true, passwordHash: null });

    const result = await backfillWelcomePromos();

    expect(result.eligible).toBe(2);
    expect(result.issued).toBe(2);
  });

  it('skips a customer who has already placed their first order', async () => {
    // The offer is "10% off your first order". Someone who has already
    // bought has had theirs — and on production two of these had already
    // spent a welcome code, so handing them a second would be a giveaway.
    const u = await user();
    await order(u.id, 'DELIVERED');

    const result = await backfillWelcomePromos();

    expect(result.issued).toBe(0);
    // Counted separately from `skipped` (= already holds a code), so the
    // operator can see why the numbers don't add up to the account count.
    expect(result.alreadyBought).toBe(1);
    expect(result.eligible).toBe(0);
  });

  it('still issues to someone whose only order fell through', async () => {
    // A cancelled or failed attempt is not a first order.
    const u = await user();
    await order(u.id, 'CANCELLED');
    await order(u.id, 'PAYMENT_FAILED');

    const result = await backfillWelcomePromos();

    expect(result.issued).toBe(1);
  });
});
