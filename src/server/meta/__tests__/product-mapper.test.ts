import { describe, expect, it } from 'vitest';
import type { ProductWithRelations } from '@/server/repositories/product.repo';
import {
  availabilityFor,
  htmlToPlainText,
  toMetaCatalogItem,
} from '../product-mapper';

const SITE = 'https://ynotlondon.com';

function product(overrides: Partial<ProductWithRelations> = {}): ProductWithRelations {
  return {
    id: 'prod_1',
    slug: 'vera-jacket',
    name: 'Vera Jacket',
    description: '<p>A <b>modern</b> leather blazer.</p><p>Made in Italy.</p>',
    priceCents: 48000,
    currency: 'GBP',
    preOrder: false,
    materials: '',
    images: [
      { url: 'https://cdn.ynotlondon.com/a.jpg', alt: '', sortOrder: 0, colour: null },
      { url: '/api/media/b.jpg', alt: '', sortOrder: 1, colour: null },
    ],
    sizes: [
      { size: 'M', colour: 'Olive', stock: 2 },
      { size: 'L', colour: 'Olive', stock: 1 },
    ],
    colours: [],
    categories: [],
    ...overrides,
  } as unknown as ProductWithRelations;
}

describe('htmlToPlainText', () => {
  it('strips tags and collapses whitespace', () => {
    expect(htmlToPlainText('<p>A <b>modern</b> blazer.</p><p>Made in Italy.</p>')).toBe(
      'A modern blazer. Made in Italy.',
    );
  });

  it('decodes common entities', () => {
    expect(htmlToPlainText('<p>Wool &amp; silk&nbsp;blend</p>')).toBe('Wool & silk blend');
  });
});

describe('availabilityFor', () => {
  it('preorder wins over stock', () => {
    expect(availabilityFor({ preOrder: true, sizes: [{ stock: 0 }] })).toBe('preorder');
  });

  it('in stock when any variant has stock', () => {
    expect(availabilityFor({ preOrder: false, sizes: [{ stock: 0 }, { stock: 3 }] })).toBe(
      'in stock',
    );
  });

  it('out of stock when every variant is zero', () => {
    expect(availabilityFor({ preOrder: false, sizes: [{ stock: 0 }] })).toBe('out of stock');
  });
});

describe('toMetaCatalogItem', () => {
  it('maps a published product to a catalog item', () => {
    const item = toMetaCatalogItem(product(), { siteUrl: SITE })!;
    expect(item.id).toBe('prod_1');
    expect(item.title).toBe('Vera Jacket');
    expect(item.description).toBe('A modern leather blazer. Made in Italy.');
    expect(item.price).toBe('480.00 GBP');
    expect(item.availability).toBe('in stock');
    expect(item.condition).toBe('new');
    expect(item.link).toBe('https://ynotlondon.com/products/vera-jacket');
    expect(item.brand).toBe('YNOT London');
    expect(item.quantity_to_sell_on_facebook).toBe(3);
  });

  it('uses the first image and absolutises relative ones', () => {
    const item = toMetaCatalogItem(product(), { siteUrl: SITE })!;
    expect(item.image_link).toBe('https://cdn.ynotlondon.com/a.jpg');
    expect(item.additional_image_link).toEqual(['https://ynotlondon.com/api/media/b.jpg']);
  });

  it('returns null when the product has no image (Meta rejects it)', () => {
    expect(toMetaCatalogItem(product({ images: [] }), { siteUrl: SITE })).toBeNull();
  });

  it('marks pre-order products as preorder', () => {
    const item = toMetaCatalogItem(product({ preOrder: true }), { siteUrl: SITE })!;
    expect(item.availability).toBe('preorder');
  });

  it('falls back to materials, then name, for an empty description', () => {
    const item = toMetaCatalogItem(
      product({ description: '', materials: '<p>100% lamb leather</p>' }),
      { siteUrl: SITE },
    )!;
    expect(item.description).toBe('100% lamb leather');
  });
});
