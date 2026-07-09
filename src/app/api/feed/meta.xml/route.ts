import { listProducts } from '@/server/repositories/product.repo';
import { toMetaCatalogItem, type MetaCatalogItem } from '@/server/meta/product-mapper';
import { siteUrl } from '@/server/meta/sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Escape the five XML metacharacters for attribute/text nodes (URLs, prices). */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Wrap free text in CDATA, defusing any nested terminator. */
function cdata(value: string): string {
  return `<![CDATA[${value.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;
}

function itemXml(item: MetaCatalogItem): string {
  const extra = item.additional_image_link
    .map((url) => `      <g:additional_image_link>${esc(url)}</g:additional_image_link>`)
    .join('\n');
  return [
    '    <item>',
    `      <g:id>${esc(item.id)}</g:id>`,
    `      <g:title>${cdata(item.title)}</g:title>`,
    `      <g:description>${cdata(item.description)}</g:description>`,
    `      <g:link>${esc(item.link)}</g:link>`,
    `      <g:image_link>${esc(item.image_link)}</g:image_link>`,
    extra,
    `      <g:availability>${item.availability}</g:availability>`,
    `      <g:condition>${item.condition}</g:condition>`,
    `      <g:price>${esc(item.price)}</g:price>`,
    `      <g:brand>${cdata(item.brand)}</g:brand>`,
    '    </item>',
  ]
    .filter((line) => line.length > 0)
    .join('\n');
}

/**
 * Product feed for the Meta (Facebook/Instagram) catalog.
 *
 * RSS 2.0 with the `g:` namespace — the same shape Google Merchant Center
 * accepts, so one feed serves both. Only PUBLISHED, non-deleted products with
 * at least one image are listed (`listProducts` already enforces visibility;
 * the mapper drops image-less rows, which Meta would reject anyway).
 *
 * Meta pulls this on a schedule, which also reconciles anything the instant
 * `items_batch` push in `@/server/meta/sync` may have missed.
 */
export async function GET(): Promise<Response> {
  const url = siteUrl();
  const products = await listProducts();
  const items = products
    .map((p) => toMetaCatalogItem(p, { siteUrl: url }))
    .filter((i): i is MetaCatalogItem => i !== null);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${cdata('YNOT London — Product Feed')}</title>
    <link>${esc(url)}</link>
    <description>${cdata('Product catalogue for Meta and Google Shopping')}</description>
${items.map(itemXml).join('\n')}
  </channel>
</rss>`;

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      // Meta polls this; a short cache absorbs bursts without going stale.
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  });
}
