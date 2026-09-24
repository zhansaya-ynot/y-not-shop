import { describe, expect, it, beforeEach } from 'vitest';
import { prisma } from '@/server/db/client';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import { renderTemplate } from '@/server/email/render-template-registry';
import { issueWelcomePromo, WELCOME_DISCOUNT_PERCENT } from '../welcome';

/**
 * The storefront's announcement bar promises "Sign in and get 10% off your
 * first order". This is what makes good on it: one personal, single-use code
 * per customer, emailed the moment they confirm their address.
 *
 * Issuing must be exactly-once. A customer who verifies twice — a resent
 * code, a second click — must not collect a second discount, and a failed
 * run must not leave an orphan code nobody was told about.
 */
async function customer(email = 'robyn@example.com') {
  return prisma.user.create({
    data: { email, name: 'Robyn Mackay', passwordHash: '$2b$10$h' },
  });
}

describe('issueWelcomePromo', () => {
  beforeEach(() => resetDb());

  it('mints a single-use 10% code for the customer', async () => {
    const user = await customer();

    const issued = await issueWelcomePromo({ userId: user.id, email: user.email });

    expect(issued).not.toBeNull();
    const promo = await prisma.promoCode.findUnique({ where: { code: issued!.code } });
    expect(promo!.discountValue).toBe(WELCOME_DISCOUNT_PERCENT);
    expect(promo!.usageLimit).toBe(1);
  });

  it('queues the email that carries the code to the customer', async () => {
    const user = await customer();

    const issued = await issueWelcomePromo({
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    const job = await prisma.emailJob.findFirst({ where: { template: 'WelcomeDiscount' } });
    expect(job).not.toBeNull();
    expect(job!.recipientEmail).toBe('robyn@example.com');
    const payload = job!.payload as Record<string, unknown>;
    expect(payload.promoCode).toBe(issued!.code);
    expect(payload.customerName).toBe('Robyn Mackay');
    expect(payload.discountPercent).toBe(WELCOME_DISCOUNT_PERCENT);
    expect(String(payload.promoExpiresAt)).toBe(issued!.expiresAt.toISOString());
  });

  it('gives a customer who verifies twice nothing the second time', async () => {
    const user = await customer();

    const first = await issueWelcomePromo({ userId: user.id, email: user.email });
    const second = await issueWelcomePromo({ userId: user.id, email: user.email });

    expect(first).not.toBeNull();
    expect(second).toBeNull();
    expect(await prisma.promoCode.count()).toBe(1);
    expect(await prisma.emailJob.count({ where: { template: 'WelcomeDiscount' } })).toBe(1);
  });

  it('gives two customers two different codes', async () => {
    const a = await customer('a@example.com');
    const b = await customer('b@example.com');

    const first = await issueWelcomePromo({ userId: a.id, email: a.email });
    const second = await issueWelcomePromo({ userId: b.id, email: b.email });

    expect(first!.code).not.toBe(second!.code);
    expect(await prisma.emailJob.count({ where: { template: 'WelcomeDiscount' } })).toBe(2);
  });

  it('dates the code 30 days out so the offer has a real deadline', async () => {
    const user = await customer();
    const now = new Date('2026-09-24T09:00:00Z');

    const issued = await issueWelcomePromo({ userId: user.id, email: user.email, now });

    expect(issued!.expiresAt.toISOString()).toBe('2026-10-24T09:00:00.000Z');
  });

  it('queues a job the worker can actually render and send', async () => {
    // The enqueued template name and payload shape are a contract with the
    // renderer registry. Get either wrong and the job retries three times,
    // flips to FAILED, and the customer silently never hears about the code.
    await import('@/emails/_register');
    const user = await customer();
    const issued = await issueWelcomePromo({
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    const job = await prisma.emailJob.findFirstOrThrow({
      where: { template: 'WelcomeDiscount' },
    });
    const rendered = await renderTemplate(job.template, job.payload);

    expect(rendered.subject).toContain('10%');
    expect(rendered.html).toContain(issued!.code);
  });
});
