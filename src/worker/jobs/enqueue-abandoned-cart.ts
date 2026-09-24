import type { Cart, CartItem } from '@prisma/client';
import { prisma } from '@/server/db/client';
import { env } from '@/server/env';
import { enqueueEmailJob } from '@/server/email/jobs';
import { mintSingleUsePromo } from '@/server/promos/mint';
import type { AbandonedCart1hProps } from '@/emails/abandoned-cart-1h';
import type { AbandonedCart24hProps } from '@/emails/abandoned-cart-24h';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const WINDOW_MS = 5 * 60 * 1000; // ±5 min so a 5-minute cron tick captures the cohort
const PROMO_TTL_MS = 7 * DAY_MS;
const PROMO_DISCOUNT_PERCENT = 10;

interface CartContext {
  cart: Cart & {
    items: (CartItem & { product: { name: string; images: { url: string }[] } | null })[];
    user: { email: string; name: string | null } | null;
  };
}

export interface EnqueueAbandonedCartResult {
  enqueued1h: number;
  enqueued24h: number;
}

/**
 * 5-minute worker job: scans carts that landed in the 1h or 24h abandonment
 * windows (centred on `now - {1h,24h}` ±5min) and enqueues `AbandonedCart1h`
 * / `AbandonedCart24h` emails for those that haven't already been recovered.
 *
 * Dedupe is via `EmailJob.cancelReason` (`cartId:1h` / `cartId:24h`) so a
 * cart only ever receives each reminder once regardless of how many times
 * the cron tick fires inside the window.
 *
 * The 24h variant additionally mints a single-use 10% promo
 * (`WELCOME10-XXXXXX`, 7-day expiry) and ships the code in the email payload.
 *
 * Carts without an attached User (anonymous sessions) are skipped — there is
 * no recipient address to send to.
 */
export async function enqueueAbandonedCart(): Promise<EnqueueAbandonedCartResult> {
  const now = Date.now();
  const enqueued1h = await processWindow({
    label: '1h',
    midpoint: now - HOUR_MS,
    windowMs: WINDOW_MS,
    template: 'AbandonedCart1h',
    buildPayload: (ctx) => buildPayload1h(ctx),
  });
  const enqueued24h = await processWindow({
    label: '24h',
    midpoint: now - DAY_MS,
    windowMs: WINDOW_MS,
    template: 'AbandonedCart24h',
    buildPayload: (ctx) => buildPayload24h(ctx),
  });
  return { enqueued1h, enqueued24h };
}

interface WindowSpec {
  label: '1h' | '24h';
  midpoint: number;
  windowMs: number;
  template: 'AbandonedCart1h' | 'AbandonedCart24h';
  buildPayload: (
    ctx: CartContext,
  ) => Promise<AbandonedCart1hProps | AbandonedCart24hProps>;
}

async function processWindow(spec: WindowSpec): Promise<number> {
  const lo = new Date(spec.midpoint - spec.windowMs);
  const hi = new Date(spec.midpoint + spec.windowMs);

  const candidates = await prisma.cart.findMany({
    where: {
      // The cart must still be live (haven't been cleaned up).
      expiresAt: { gt: new Date() },
      // The user must exist — anonymous carts have no recipient.
      userId: { not: null },
      events: {
        some: { kind: 'ITEM_ADDED', createdAt: { gte: lo, lte: hi } },
      },
      // Not already recovered.
      NOT: { events: { some: { kind: 'CHECKED_OUT' } } },
    },
    include: {
      user: { select: { email: true, name: true } },
      items: {
        include: {
          product: {
            select: {
              name: true,
              images: { orderBy: { sortOrder: 'asc' }, take: 1, select: { url: true } },
            },
          },
        },
      },
    },
  });

  let enqueued = 0;
  for (const cart of candidates) {
    if (!cart.user || cart.items.length === 0) continue;

    const payload = await spec.buildPayload({ cart });
    const dedupKey = `${cart.id}:${spec.label}`;
    await enqueueEmailJob({
      template: spec.template,
      recipientEmail: cart.user.email,
      payload: payload as unknown as import('@prisma/client').Prisma.InputJsonValue,
      dispatchAt: new Date(),
      dedupKey,
    });
    enqueued += 1;
  }

  return enqueued;
}

function cartUrl(): string {
  return `${env.NEXT_PUBLIC_SITE_URL}/cart`;
}

function buildItemLines(ctx: CartContext) {
  return ctx.cart.items.map((it) => ({
    name: it.product?.name ?? 'YNOT item',
    image: it.product?.images?.[0]?.url ?? '',
    priceCents: it.unitPriceCents,
    qty: it.quantity,
  }));
}

async function buildPayload1h(ctx: CartContext): Promise<AbandonedCart1hProps> {
  return {
    items: buildItemLines(ctx),
    cartUrl: cartUrl(),
    ...(ctx.cart.user?.name ? { customerName: ctx.cart.user.name } : {}),
  };
}

async function buildPayload24h(ctx: CartContext): Promise<AbandonedCart24hProps> {
  const promo = await mintSingleUsePromo({
    prefix: 'WELCOME10',
    percent: PROMO_DISCOUNT_PERCENT,
    ttlMs: PROMO_TTL_MS,
  });
  return {
    items: buildItemLines(ctx),
    cartUrl: cartUrl(),
    promoCode: promo.code,
    promoExpiresAt: promo.expiresAt.toISOString(),
    ...(ctx.cart.user?.name ? { customerName: ctx.cart.user.name } : {}),
  };
}
