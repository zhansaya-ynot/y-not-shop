import type { ProductWithRelations } from '@/server/repositories/product.repo';

/** Brand shown on every catalog item — Meta requires a non-empty brand. */
export const BRAND = 'YNOT London';

/**
 * Meta availability values (also valid for a Google-style RSS feed).
 * @see https://developers.facebook.com/docs/marketing-api/catalog/reference
 */
export type MetaAvailability = 'in stock' | 'out of stock' | 'preorder';

/**
 * One row of the product catalog, shared by the XML feed and the Graph API
 * push so both always describe a product identically.
 */
export interface MetaCatalogItem {
  /** `retailer_id` — must match the `content_ids` the Pixel sends. */
  id: string;
  title: string;
  description: string;
  availability: MetaAvailability;
  condition: 'new';
  /** e.g. "480.00 GBP" */
  price: string;
  link: string;
  image_link: string;
  additional_image_link: string[];
  brand: string;
  /** Total units across every (size, colour) variant. */
  quantity_to_sell_on_facebook: number;
}

/**
 * Strip HTML to plain text. Product descriptions/materials are rich text
 * (TipTap HTML) but Meta and the RSS feed both want plain prose.
 */
export function htmlToPlainText(html: string): string {
  return html
    // Block-level tags become spaces so words don't run together.
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Absolute URL for a stored image; passes through already-absolute URLs. */
function absoluteUrl(url: string, siteUrl: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${siteUrl.replace(/\/$/, '')}/${url.replace(/^\//, '')}`;
}

export function availabilityFor(product: {
  preOrder: boolean;
  sizes: { stock: number }[];
}): MetaAvailability {
  if (product.preOrder) return 'preorder';
  const total = product.sizes.reduce((sum, s) => sum + s.stock, 0);
  return total > 0 ? 'in stock' : 'out of stock';
}

export interface MapOptions {
  /** Absolute site origin, e.g. https://ynotlondon.com */
  siteUrl: string;
}

/**
 * Map a storefront product row to a Meta catalog item.
 *
 * Returns `null` when the product can't be listed — currently that means it has
 * no image, which Meta rejects (`image_link` is required). Callers skip those.
 *
 * Granularity: one item per product (not per size/colour variant). The item id
 * is the product id so the Pixel's `content_ids` line up with the catalog.
 */
export function toMetaCatalogItem(
  product: ProductWithRelations,
  opts: MapOptions,
): MetaCatalogItem | null {
  const images = product.images.map((i) => absoluteUrl(i.url, opts.siteUrl));
  if (images.length === 0) return null;

  const description =
    htmlToPlainText(product.description) || htmlToPlainText(product.materials) || product.name;

  return {
    id: product.id,
    title: product.name,
    // Meta caps description at 9,999 chars.
    description: description.slice(0, 9999),
    availability: availabilityFor(product),
    condition: 'new',
    price: `${(product.priceCents / 100).toFixed(2)} ${product.currency}`,
    link: `${opts.siteUrl.replace(/\/$/, '')}/products/${product.slug}`,
    image_link: images[0],
    // Meta allows up to 20 additional images.
    additional_image_link: images.slice(1, 21),
    brand: BRAND,
    quantity_to_sell_on_facebook: product.sizes.reduce((sum, s) => sum + s.stock, 0),
  };
}
