import { describe, expect, it, beforeEach, vi } from 'vitest';
import { prisma } from '@/server/db/client';
import { resetDb } from '@/server/__tests__/helpers/reset-db';

vi.mock('@/server/auth/nextauth', () => ({ auth: vi.fn() }));
import { auth } from '@/server/auth/nextauth';
import { PATCH } from '../route';

describe('materials/care/sizing persistence', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (auth as any).mockResolvedValue({ user: { id: 'u1', role: 'OWNER' } });
  });

  it('persists materials, care, sizing through a PATCH like the form sends', async () => {
    await resetDb();
    await prisma.user.create({ data: { id: 'u1', email: 'o@b.com', role: 'OWNER' } });
    const p = await prisma.product.create({
      data: { name: 'Mila', slug: 'mila', description: 'd', priceCents: 25000,
        materials: '', care: '', sizing: '', status: 'DRAFT' },
    });

    // Mirror the exact body product-details-form.tsx sends.
    const body = {
      name: 'Mila', slug: 'mila', description: 'd', priceCents: 25000,
      materials: '<p>100% lamb leather, satin lining</p>',
      care: 'Wipe clean only',
      sizing: 'Runs true to size',
      preOrder: false, isOneSize: false, sizeGuideImage: null,
      homeCollections: [], hsCode: '42031000',
    };
    const req = new Request(`http://x/api/admin/products/${p.id}`, {
      method: 'PATCH', body: JSON.stringify(body),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: p.id }) });
    const json = await res.json();
    expect(res.status, `PATCH should 200, got ${res.status}: ${JSON.stringify(json)}`).toBe(200);

    const after = await prisma.product.findUniqueOrThrow({ where: { id: p.id } });
    expect(after.materials).toBe('<p>100% lamb leather, satin lining</p>');
    expect(after.care).toBe('Wipe clean only');
    expect(after.sizing).toBe('Runs true to size');
  });
});
