#!/usr/bin/env tsx
/**
 * CLI: hand the welcome discount to customers who registered before it existed.
 *
 * Usage:
 *   pnpm tsx scripts/backfill-welcome-promos.ts
 *
 * The storefront has promised "Sign in and get 10% off your first order"
 * since launch, but nothing issued a code until now — so everyone who
 * signed up in the meantime is owed one. This walks those accounts and
 * issues the same personal single-use code a new customer now receives on
 * confirming their address.
 *
 * Customers who already bought are left out: the offer is "10% off your
 * first order", and on production two of these had already spent a welcome
 * code by hand. A cancelled or failed attempt doesn't count as an order.
 *
 * Idempotent: `issueWelcomePromo` refuses to give anyone a second code, so
 * re-running is harmless and reports the repeats as `skipped`.
 */
import { prisma } from '../src/server/db/client';
import { issueWelcomePromo } from '../src/server/promos/welcome';

/** Statuses that mean the customer never actually completed a purchase. */
const NEVER_BOUGHT = ['PENDING_PAYMENT', 'PAYMENT_FAILED', 'CANCELLED'] as const;

export interface BackfillWelcomePromosResult {
  /** Accounts that qualify: registered, confirmed, not deleted, yet to buy. */
  eligible: number;
  /** Codes minted and emails queued by this run. */
  issued: number;
  /** Qualifying accounts that already had a code. */
  skipped: number;
  /** Registered, confirmed accounts left out because they already bought. */
  alreadyBought: number;
}

/** Registered properly and proved the address — the baseline for the offer. */
const REGISTERED_AND_CONFIRMED = {
  role: 'CUSTOMER',
  deletedAt: null,
  isGuest: false,
  // Guest checkout leaves password-less rows; they never opened an account.
  passwordHash: { not: null },
  // Only addresses whose owner has proven they read them.
  emailVerifiedAt: { not: null },
} as const;

export async function backfillWelcomePromos(): Promise<BackfillWelcomePromosResult> {
  const boughtAlready = { status: { notIn: NEVER_BOUGHT as unknown as never[] } };

  const alreadyBought = await prisma.user.count({
    where: { ...REGISTERED_AND_CONFIRMED, orders: { some: boughtAlready } },
  });

  const customers = await prisma.user.findMany({
    where: {
      ...REGISTERED_AND_CONFIRMED,
      // "Your first order" — someone who already bought has had theirs.
      orders: { none: boughtAlready },
    },
    select: { id: true, email: true, name: true },
    orderBy: { createdAt: 'asc' },
  });

  let issued = 0;
  let skipped = 0;
  for (const customer of customers) {
    const promo = await issueWelcomePromo({
      userId: customer.id,
      email: customer.email,
      name: customer.name,
    });
    if (promo) {
      issued += 1;
      console.log(`issued ${promo.code} → ${customer.email}`);
    } else {
      skipped += 1;
      console.log(`skipped ${customer.email} — already has a code`);
    }
  }

  return { eligible: customers.length, issued, skipped, alreadyBought };
}

if (require.main === module) {
  backfillWelcomePromos()
    .then((r) => {
      console.log('Backfill complete:', r);
      process.exit(0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
