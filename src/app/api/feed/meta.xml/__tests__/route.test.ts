import { describe, expect, it, beforeEach } from 'vitest';
import { prisma } from '@/server/db/client';
import { resetDb } from '@/server/__tests__/helpers/reset-db';
import { GET } from '../route';

async function seedProduct(opts: {
  name: string;
  slug: string;
  status: 'DRAFT' | 'PUBLISHED';
  withImage: boolean;
  preOrder?: boolean;
  stock?: number;
}) {
  return prisma.product.create({
    data: {
      slug: opts.slug,
      name: opts.name,
      description: '<p>A <b>fine</b> coat.</p>',
      priceCents: 48000,
      currency: 'GBP',
      materials: '', care: '', sizing: '',
      status: opts.status,
      preOrder: opts.preOrder ?? false,
      sizes: { create: [{ size: 'M', colour: 'Olive', stock: opts.stock ?? 2 }] },
      ...(opts.withImage
        ? { images: { create: [{ url: 'https://cdn.test/a.jpg', alt: '', sortOrder: 0 }] } }
        : {}),
    },
  });
}

describe('GET /api/feed/meta.xml', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('lists published products with an image, as RSS with the g: namespace', async () => {
    const p = await seedProduct({
      name: 'Vera Jacket', slug: 'vera-jacket', status: 'PUBLISHED', withImage: true,
    });

    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('application/xml');

    const xml = await res.text();
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('xmlns:g="http://base.google.com/ns/1.0"');
    expect(xml).toContain(`<g:id>${p.id}</g:id>`);
    expect(xml).toContain('Vera Jacket');
    expect(xml).toContain('<g:price>480.00 GBP</g:price>');
    expect(xml).toContain('<g:availability>in stock</g:availability>');
    expect(xml).toContain('<g:condition>new</g:condition>');
    expect(xml).toContain('<g:image_link>https://cdn.test/a.jpg</g:image_link>');
    expect(xml).toContain('/products/vera-jacket');
    // Rich-text description is flattened to plain prose.
    expect(xml).toContain('A fine coat.');
    expect(xml).not.toContain('<b>');
  });

  it('excludes drafts and products without an image', async () => {
    await seedProduct({ name: 'Draft', slug: 'draft-x', status: 'DRAFT', withImage: true });
    await seedProduct({ name: 'NoImage', slug: 'no-image', status: 'PUBLISHED', withImage: false });

    const xml = await (await GET()).text();
    expect(xml).not.toContain('Draft');
    expect(xml).not.toContain('NoImage');
    expect(xml).not.toContain('<item>');
  });

  it('marks pre-order products as preorder', async () => {
    await seedProduct({
      name: 'Ami', slug: 'ami', status: 'PUBLISHED', withImage: true, preOrder: true, stock: 0,
    });
    const xml = await (await GET()).text();
    expect(xml).toContain('<g:availability>preorder</g:availability>');
  });

  it('marks zero-stock products as out of stock', async () => {
    await seedProduct({
      name: 'Sold', slug: 'sold', status: 'PUBLISHED', withImage: true, stock: 0,
    });
    const xml = await (await GET()).text();
    expect(xml).toContain('<g:availability>out of stock</g:availability>');
  });
});
