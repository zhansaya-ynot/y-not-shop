// Meta Pixel standard events for the retargeting / dynamic-product-ads funnel.
// `content_ids` are product ids so they line up with the catalog's
// retailer_id (see src/server/meta/product-mapper.ts). All calls no-op safely
// when the pixel hasn't loaded (fbq undefined).

/** Product page view — feeds "viewed product" retargeting audiences. */
export function trackViewContent(p: { productId: string; valueCents: number }): void {
  if (typeof window === 'undefined') return;
  window.fbq?.('track', 'ViewContent', {
    content_type: 'product',
    content_ids: [p.productId],
    value: p.valueCents / 100,
    currency: 'GBP',
  });
}

/** Add-to-bag — feeds "added to cart" audiences + abandoned-cart ads. */
export function trackAddToCart(p: {
  productId: string;
  valueCents: number;
  quantity: number;
}): void {
  if (typeof window === 'undefined') return;
  window.fbq?.('track', 'AddToCart', {
    content_type: 'product',
    content_ids: [p.productId],
    contents: [{ id: p.productId, quantity: p.quantity }],
    value: (p.valueCents * p.quantity) / 100,
    currency: 'GBP',
  });
}
