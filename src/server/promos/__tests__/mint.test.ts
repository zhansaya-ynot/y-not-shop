import { describe, expect, it, beforeEach } from 'vitest';
import { prisma } from '@/server/db/client';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import { mintSingleUsePromo } from '../mint';

/**
 * Single-use promo minting, shared by the welcome discount and the 24h
 * abandoned-cart reminder. Each call must produce a code nobody else holds —
 * these are handed to one named customer, so a collision would let two
 * people spend the same discount.
 */
describe('mintSingleUsePromo', () => {
  beforeEach(() => resetDb());

  it('creates an active percent code that can be spent exactly once', async () => {
    const { code } = await mintSingleUsePromo({
      prefix: 'WELCOME10',
      percent: 10,
      ttlMs: 30 * 24 * 60 * 60 * 1000,
    });

    const row = await prisma.promoCode.findUnique({ where: { code } });
    expect(row).not.toBeNull();
    expect(row!.discountType).toBe('PERCENT');
    expect(row!.discountValue).toBe(10);
    expect(row!.usageLimit).toBe(1);
    expect(row!.usageCount).toBe(0);
    expect(row!.isActive).toBe(true);
  });

  it('prefixes the code so its origin is readable in the admin list', async () => {
    const { code } = await mintSingleUsePromo({ prefix: 'WELCOME10', percent: 10, ttlMs: 1000 });
    expect(code).toMatch(/^WELCOME10-[0-9A-Z_-]{6}$/);
  });

  it('expires the code ttlMs after the given moment', async () => {
    const now = new Date('2026-09-24T12:00:00Z');
    const { expiresAt } = await mintSingleUsePromo({
      prefix: 'WELCOME10',
      percent: 10,
      ttlMs: 30 * 24 * 60 * 60 * 1000,
      now,
    });
    expect(expiresAt.toISOString()).toBe('2026-10-24T12:00:00.000Z');
  });

  it('never hands the same code to two customers', async () => {
    const codes = new Set<string>();
    for (let i = 0; i < 25; i += 1) {
      const { code } = await mintSingleUsePromo({ prefix: 'WELCOME10', percent: 10, ttlMs: 1000 });
      codes.add(code);
    }
    expect(codes.size).toBe(25);
  });
});
