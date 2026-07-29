import { describe, expect, it, beforeEach } from 'vitest';
import { prisma } from '@/server/db/client';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import { updateSitePolicy } from '../sitepolicy-service';

describe('updateSitePolicy', () => {
  beforeEach(async () => {
    await resetDb();
    await prisma.user.create({ data: { id: 'u1', email: 'o@b.com', role: 'OWNER' } });
  });

  it('upserts the singleton row when none exists', async () => {
    const result = await updateSitePolicy({
      input: {
        contactEmail: 'hi@ynot.london',
        whatsappNumber: '+447700900000',
        freeShipThresholdCents: 15000,
      },
      actorId: 'u1',
    });
    expect(result.id).toBe('singleton');
    expect(result.contactEmail).toBe('hi@ynot.london');
    expect(result.whatsappNumber).toBe('+447700900000');
    expect(result.freeShipThresholdCents).toBe(15000);
    const log = await prisma.auditLog.findFirst({ where: { action: 'sitepolicy.update' } });
    expect(log).not.toBeNull();
  });

  it('persists the social-share image (ogImage) and clears it with null', async () => {
    await updateSitePolicy({ input: { ogImage: '/media/seo/share.jpg' }, actorId: 'u1' });
    let row = await prisma.sitePolicy.findUniqueOrThrow({ where: { id: 'singleton' } });
    expect(row.ogImage).toBe('/media/seo/share.jpg');

    await updateSitePolicy({ input: { ogImage: null }, actorId: 'u1' });
    row = await prisma.sitePolicy.findUniqueOrThrow({ where: { id: 'singleton' } });
    expect(row.ogImage).toBeNull();
  });

  it('updates existing singleton without creating duplicate rows', async () => {
    await updateSitePolicy({ input: { contactEmail: 'one@x.com' }, actorId: 'u1' });
    await updateSitePolicy({ input: { contactEmail: 'two@x.com' }, actorId: 'u1' });
    const all = await prisma.sitePolicy.findMany();
    expect(all.length).toBe(1);
    expect(all[0].contactEmail).toBe('two@x.com');
  });

  it('preserves untouched fields on partial update', async () => {
    await updateSitePolicy({
      input: { contactEmail: 'hi@x.com', whatsappNumber: '+1' },
      actorId: 'u1',
    });
    const after = await updateSitePolicy({
      input: { contactEmail: 'bye@x.com' },
      actorId: 'u1',
    });
    expect(after.contactEmail).toBe('bye@x.com');
    expect(after.whatsappNumber).toBe('+1');
  });
});
