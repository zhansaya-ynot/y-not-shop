import { nanoid } from 'nanoid';
import { prisma } from '@/server/db/client';

export interface MintSingleUsePromoInput {
  /** Leading segment of the code, e.g. `WELCOME10` — readable in the admin list. */
  prefix: string;
  /** Percentage off, 1..100. */
  percent: number;
  /** How long the code stays spendable. */
  ttlMs: number;
  /** Clock, so callers and tests can pin the expiry. */
  now?: Date;
}

export interface MintedPromo {
  code: string;
  expiresAt: Date;
}

const MAX_ATTEMPTS = 5;

/**
 * Mint a personal, single-use percentage promo code.
 *
 * Every code here is handed to exactly one named customer, so `usageLimit`
 * is 1 and the random suffix must be unique — a collision would let two
 * people spend the same discount. The unique index on `PromoCode.code` is
 * the real guard; the retry loop just absorbs the rare clash.
 */
export async function mintSingleUsePromo(
  input: MintSingleUsePromoInput,
): Promise<MintedPromo> {
  const issuedAt = input.now ?? new Date();
  const expiresAt = new Date(issuedAt.getTime() + input.ttlMs);

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const code = `${input.prefix}-${nanoid(6).toUpperCase()}`;
    try {
      const created = await prisma.promoCode.create({
        data: {
          code,
          discountType: 'PERCENT',
          discountValue: input.percent,
          usageLimit: 1,
          expiresAt,
        },
      });
      return { code: created.code, expiresAt };
    } catch (err) {
      const isCollision =
        err instanceof Error && err.message.includes('Unique constraint');
      if (isCollision && attempt < MAX_ATTEMPTS - 1) continue;
      throw err;
    }
  }
  throw new Error('mintSingleUsePromo: exhausted retries generating a unique code');
}
