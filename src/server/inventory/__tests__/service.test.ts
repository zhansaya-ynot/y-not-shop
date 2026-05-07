import { describe, expect, it, beforeEach } from 'vitest';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import { prisma } from '@/server/db/client';
import {
  decodeVariantId,
  encodeVariantId,
  listInventoryForAdmin,
  setVariantStock,
  InventoryError,
} from '../service';

async function seedProduct(opts: {
  name: string;
  sizes: Array<{ size: 'XS' | 'S' | 'M' | 'L' | 'XL'; stock: number }>;
  deleted?: boolean;
}) {
  const slug = opts.name.toLowerCase().replace(/\s+/g, '-') + '-' +
    Math.random().toString(36).slice(2, 6);
  return prisma.product.create({
    data: {
      slug,
      name: opts.name,
      priceCents: 5000, currency: 'GBP',
      description: '', materials: '', care: '', sizing: '',
      ...(opts.deleted ? { deletedAt: new Date() } : {}),
      sizes: { create: opts.sizes },
    },
  });
}

describe('encode/decode variantId', () => {
  it('roundtrips', () => {
    const v = encodeVariantId('cuid_abc123', 'M');
    expect(v).toBe('cuid_abc123__M');
    expect(decodeVariantId(v)).toEqual({ productId: 'cuid_abc123', size: 'M' });
  });

  it('rejects garbage / unknown size', () => {
    expect(decodeVariantId('no-separator')).toBeNull();
    expect(decodeVariantId('pid__BOGUS')).toBeNull();
    expect(decodeVariantId('__M')).toBeNull();
  });
});

describe('listInventoryForAdmin', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('lists every variant with isLow flag, excludes soft-deleted products', async () => {
    await seedProduct({
      name: 'Alpha Coat',
      sizes: [
        { size: 'S', stock: 20 },
        { size: 'M', stock: 3 }, // low
      ],
    });
    await seedProduct({
      name: 'Bravo Jacket',
      sizes: [{ size: 'L', stock: 0 }], // low
    });
    await seedProduct({
      name: 'Charlie Hidden',
      sizes: [{ size: 'M', stock: 10 }],
      deleted: true,
    });

    const rows = await listInventoryForAdmin({});
    expect(rows).toHaveLength(3);
    // Sorted by product name asc, then size asc (enum declaration order:
    // XS, S, M, L, XL → Postgres asc on the enum honours declaration order).
    expect(rows.map((r) => `${r.productName}/${r.size}`)).toEqual([
      'Alpha Coat/S',
      'Alpha Coat/M',
      'Bravo Jacket/L',
    ]);
    const alphaM = rows.find((r) => r.productName === 'Alpha Coat' && r.size === 'M')!;
    expect(alphaM.isLow).toBe(true);
    const alphaS = rows.find((r) => r.productName === 'Alpha Coat' && r.size === 'S')!;
    expect(alphaS.isLow).toBe(false);
  });

  it('lowOnly filter', async () => {
    await seedProduct({
      name: 'Lowy',
      sizes: [{ size: 'S', stock: 2 }, { size: 'M', stock: 50 }],
    });
    const low = await listInventoryForAdmin({ lowOnly: true });
    expect(low).toHaveLength(1);
    expect(low[0].size).toBe('S');
  });

  it('search filter on product name (case-insensitive)', async () => {
    await seedProduct({
      name: 'Special Item',
      sizes: [{ size: 'M', stock: 10 }],
    });
    await seedProduct({
      name: 'Other Thing',
      sizes: [{ size: 'M', stock: 10 }],
    });
    const found = await listInventoryForAdmin({ search: 'special' });
    expect(found).toHaveLength(1);
    expect(found[0].productName).toBe('Special Item');
  });
});

describe('setVariantStock', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('updates stock and returns the new value', async () => {
    const p = await seedProduct({ name: 'Stocky', sizes: [{ size: 'M', stock: 5 }] });
    const variantId = encodeVariantId(p.id, 'M');
    const next = await setVariantStock(variantId, 12);
    expect(next).toBe(12);
    const stored = await prisma.productSize.findUniqueOrThrow({
      where: { productId_size: { productId: p.id, size: 'M' } },
    });
    expect(stored.stock).toBe(12);
  });

  it('rejects negative stock', async () => {
    const p = await seedProduct({ name: 'X', sizes: [{ size: 'M', stock: 1 }] });
    await expect(setVariantStock(encodeVariantId(p.id, 'M'), -1))
      .rejects.toBeInstanceOf(InventoryError);
  });

  it('rejects non-integer stock', async () => {
    const p = await seedProduct({ name: 'X', sizes: [{ size: 'M', stock: 1 }] });
    await expect(setVariantStock(encodeVariantId(p.id, 'M'), 3.5))
      .rejects.toBeInstanceOf(InventoryError);
  });

  it('throws 404 InventoryError for unknown variant', async () => {
    await expect(setVariantStock('does-not-exist__M', 5))
      .rejects.toMatchObject({ status: 404 });
  });

  it('throws 400 InventoryError for malformed variant id', async () => {
    await expect(setVariantStock('garbage', 5))
      .rejects.toMatchObject({ status: 400 });
  });
});
