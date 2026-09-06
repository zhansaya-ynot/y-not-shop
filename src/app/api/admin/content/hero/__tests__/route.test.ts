import { describe, expect, it, beforeEach, vi } from 'vitest';
import { prisma } from '@/server/db/client';
import { resetDb } from '@/server/__tests__/helpers/reset-db';

vi.mock('@/server/auth/nextauth', () => ({ auth: vi.fn() }));
import { auth } from '@/server/auth/nextauth';
import { POST } from '../route';
import { PATCH, DELETE } from '../[id]/route';
import { POST as ACTIVATE } from '../[id]/activate/route';

const heroBody = {
  kind: 'IMAGE',
  imageUrl: 'https://x/h.jpg',
  eyebrow: 'New season',
  ctaLabel: 'Shop',
  ctaHref: '/shop',
};

describe('hero endpoints', () => {
  beforeEach(async () => {
    await resetDb();
    await prisma.user.create({ data: { id: 'u1', email: 'o@b.com', role: 'OWNER' } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (auth as any).mockResolvedValue({ user: { id: 'u1', role: 'OWNER' } });
  });

  it('POST 403 when not OWNER', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (auth as any).mockResolvedValue({ user: { id: 'u1', role: 'CUSTOMER' } });
    const req = new Request('http://x/api/admin/content/hero', {
      method: 'POST',
      body: JSON.stringify(heroBody),
    });
    expect((await POST(req)).status).toBe(403);
  });

  it('POST 400 on invalid body', async () => {
    const req = new Request('http://x/api/admin/content/hero', {
      method: 'POST',
      body: JSON.stringify({ ...heroBody, eyebrow: '' }),
    });
    expect((await POST(req)).status).toBe(400);
  });

  it('POST 201 returns isActive=false', async () => {
    const req = new Request('http://x/api/admin/content/hero', {
      method: 'POST',
      body: JSON.stringify(heroBody),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.isActive).toBe(false);
  });

  it('PATCH updates fields', async () => {
    const created = await prisma.heroBlock.create({
      data: {
        kind: 'IMAGE',
        imageUrl: 'https://x/a.jpg',
        eyebrow: 'old',
        ctaLabel: 'old',
        ctaHref: '/x',
      },
    });
    const req = new Request(`http://x/api/admin/content/hero/${created.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ eyebrow: 'new' }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: created.id }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.eyebrow).toBe('new');
  });

  it('PATCH 404 on missing hero', async () => {
    const req = new Request('http://x/api/admin/content/hero/nope', {
      method: 'PATCH',
      body: JSON.stringify({ eyebrow: 'x' }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: 'nope' }) });
    expect(res.status).toBe(404);
  });

  it('DELETE removes hero', async () => {
    const created = await prisma.heroBlock.create({
      data: { kind: 'IMAGE', imageUrl: 'https://x/a.jpg', eyebrow: 'a', ctaLabel: 'a', ctaHref: '/a' },
    });
    const req = new Request(`http://x/api/admin/content/hero/${created.id}`, { method: 'DELETE' });
    const res = await DELETE(req, { params: Promise.resolve({ id: created.id }) });
    expect(res.status).toBe(200);
    expect(await prisma.heroBlock.findUnique({ where: { id: created.id } })).toBeNull();
  });


  it('POST persists the mobile image variant', async () => {
    const req = new Request('http://x/api/admin/content/hero', {
      method: 'POST',
      body: JSON.stringify({ ...heroBody, mobileImageUrl: 'https://x/h-9x16.jpg' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.mobileImageUrl).toBe('https://x/h-9x16.jpg');
  });

  it('PATCH clears the mobile image when sent null', async () => {
    const created = await prisma.heroBlock.create({
      data: {
        kind: 'IMAGE',
        imageUrl: 'https://x/a.jpg',
        mobileImageUrl: 'https://x/a-9x16.jpg',
        eyebrow: 'a',
        ctaLabel: 'a',
        ctaHref: '/a',
      },
    });
    const req = new Request(`http://x/api/admin/content/hero/${created.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ mobileImageUrl: null }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: created.id }) });
    expect(res.status).toBe(200);
    expect((await res.json()).mobileImageUrl).toBeNull();
  });

  it('PATCH updates the mobile video variant', async () => {
    const created = await prisma.heroBlock.create({
      data: {
        kind: 'VIDEO',
        imageUrl: 'https://x/a.jpg',
        videoUrl: 'https://x/a.mp4',
        eyebrow: 'a',
        ctaLabel: 'a',
        ctaHref: '/a',
      },
    });
    const req = new Request(`http://x/api/admin/content/hero/${created.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ mobileVideoUrl: 'https://x/a-9x16.mp4' }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: created.id }) });
    expect(res.status).toBe(200);
    expect((await res.json()).mobileVideoUrl).toBe('https://x/a-9x16.mp4');
  });

  it('POST 400 when the mobile image is not a URL', async () => {
    const req = new Request('http://x/api/admin/content/hero', {
      method: 'POST',
      body: JSON.stringify({ ...heroBody, mobileImageUrl: 'not-a-url' }),
    });
    expect((await POST(req)).status).toBe(400);
  });

  it('POST /activate flips isActive', async () => {
    const a = await prisma.heroBlock.create({
      data: {
        kind: 'IMAGE',
        imageUrl: 'https://x/a.jpg',
        eyebrow: 'a',
        ctaLabel: 'a',
        ctaHref: '/a',
        isActive: true,
      },
    });
    const b = await prisma.heroBlock.create({
      data: {
        kind: 'IMAGE',
        imageUrl: 'https://x/b.jpg',
        eyebrow: 'b',
        ctaLabel: 'b',
        ctaHref: '/b',
      },
    });
    const req = new Request(`http://x/api/admin/content/hero/${b.id}/activate`, { method: 'POST' });
    const res = await ACTIVATE(req, { params: Promise.resolve({ id: b.id }) });
    expect(res.status).toBe(200);
    expect((await prisma.heroBlock.findUnique({ where: { id: a.id } }))!.isActive).toBe(false);
    expect((await prisma.heroBlock.findUnique({ where: { id: b.id } }))!.isActive).toBe(true);
  });
});
