import type { Prisma } from '@prisma/client';
import { prisma } from '@/server/db/client';
import { env } from '@/server/env';
import { enqueueEmailJob } from '@/server/email/jobs';
import type { WelcomeDiscountProps } from '@/emails/welcome-discount';
import { mintSingleUsePromo, type MintedPromo } from './mint';

/** The figure the announcement bar promises: "10% off your first order". */
export const WELCOME_DISCOUNT_PERCENT = 10;

/** Long enough to shop properly, short enough to be a reason to act. */
export const WELCOME_TTL_DAYS = 30;

const WELCOME_TTL_MS = WELCOME_TTL_DAYS * 24 * 60 * 60 * 1000;

/** Template name in the email registry, and the dedupe namespace. */
const TEMPLATE = 'WelcomeDiscount';

export interface IssueWelcomePromoInput {
  userId: string;
  email: string;
  name?: string | null;
  now?: Date;
}

/**
 * Give a newly verified customer their welcome discount: a personal
 * single-use code, plus the email that tells them about it.
 *
 * Exactly-once per customer. The queued `EmailJob` doubles as the ledger of
 * who has already been given one — checked before minting, so a repeat call
 * leaves no orphan code sitting in the promo list that nobody was told
 * about. Returns `null` when the customer already has theirs.
 *
 * Callers own the decision of *when* someone qualifies; this only enforces
 * that it happens once.
 */
export async function issueWelcomePromo(
  input: IssueWelcomePromoInput,
): Promise<MintedPromo | null> {
  const dedupKey = `welcome:${input.userId}`;

  const alreadyIssued = await prisma.emailJob.findFirst({
    where: {
      template: TEMPLATE,
      cancelReason: dedupKey,
      status: { in: ['PENDING', 'SENT'] },
    },
  });
  if (alreadyIssued) return null;

  const promo = await mintSingleUsePromo({
    prefix: 'WELCOME10',
    percent: WELCOME_DISCOUNT_PERCENT,
    ttlMs: WELCOME_TTL_MS,
    ...(input.now ? { now: input.now } : {}),
  });

  const payload: WelcomeDiscountProps = {
    promoCode: promo.code,
    promoExpiresAt: promo.expiresAt.toISOString(),
    discountPercent: WELCOME_DISCOUNT_PERCENT,
    shopUrl: `${env.NEXT_PUBLIC_SITE_URL}/shop`,
    ...(input.name ? { customerName: input.name } : {}),
  };

  await enqueueEmailJob({
    template: TEMPLATE,
    recipientEmail: input.email,
    payload: payload as unknown as Prisma.InputJsonValue,
    dispatchAt: input.now ?? new Date(),
    dedupKey,
  });

  return promo;
}
