import { describe, expect, it, beforeEach, vi } from 'vitest';
import { prisma } from '@/server/db/client';
import { resetDb } from '@/server/__tests__/helpers/reset-db';

vi.mock('@/server/auth/nextauth', () => ({ auth: vi.fn() }));

import { auth } from '@/server/auth/nextauth';
import { PATCH } from '../route';

async function seed() {
  await resetDb();
  await prisma.user.create({ data: { id: 'u1', email: 'o@b.com', role: 'OWNER' } });
  return prisma.product.create({
    data: {
      name: 'Coat',
      slug: 'coat',
      description: 'd',
      priceCents: 1000,
      materials: '',
      care: '',
      sizing: '',
      status: 'DRAFT',
    },
  });
}

describe('PATCH /api/admin/products/[id]/sizes', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (auth as any).mockResolvedValue({ user: { id: 'u1', role: 'OWNER' } });
  });

  it('403 when not OWNER', async () => {
    const p = await seed();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (auth as any).mockResolvedValue({ user: { id: 'u1', role: 'CUSTOMER' } });
    const req = new Request('http://x', {
      method: 'PATCH',
      body: JSON.stringify({ sizes: [{ size: 'M', stock: 5 }] }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: p.id }) });
    expect(res.status).toBe(403);
  });

  it('400 on invalid body', async () => {
    const p = await seed();
    const req = new Request('http://x', {
      method: 'PATCH',
      body: JSON.stringify({ sizes: [] }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: p.id }) });
    expect(res.status).toBe(400);
  });

  it('upserts size rows', async () => {
    const p = await seed();
    const req = new Request('http://x', {
      method: 'PATCH',
      body: JSON.stringify({
        sizes: [
          { size: 'S', stock: 1 },
          { size: 'M', stock: 5 },
        ],
      }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: p.id }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(2);
  });
});
