import { describe, expect, it, vi } from 'vitest';
import { MetaCatalogClient, MetaCatalogError } from '../catalog';
import type { MetaCatalogItem } from '../product-mapper';

const item: MetaCatalogItem = {
  id: 'prod_1',
  title: 'Vera Jacket',
  description: 'A blazer.',
  availability: 'in stock',
  condition: 'new',
  price: '480.00 GBP',
  link: 'https://ynotlondon.com/products/vera-jacket',
  image_link: 'https://cdn/a.jpg',
  additional_image_link: ['https://cdn/b.jpg', 'https://cdn/c.jpg'],
  brand: 'YNOT London',
  quantity_to_sell_on_facebook: 3,
};

function clientWith(fetchImpl: typeof fetch) {
  return new MetaCatalogClient({
    catalogId: 'cat_123',
    accessToken: 'tok',
    baseUrl: 'https://graph.test/v21.0',
    fetchImpl,
  });
}

function okFetch() {
  return vi.fn().mockResolvedValue({ ok: true, text: async () => '' }) as unknown as typeof fetch;
}

/** Parse the urlencoded body the client posts. */
function parseBody(mock: ReturnType<typeof vi.fn>) {
  const body = mock.mock.calls[0][1].body as URLSearchParams;
  return {
    url: mock.mock.calls[0][0] as string,
    accessToken: body.get('access_token'),
    itemType: body.get('item_type'),
    requests: JSON.parse(body.get('requests')!),
  };
}

describe('MetaCatalogClient.upsert', () => {
  it('posts an UPDATE items_batch request to the catalog', async () => {
    const f = okFetch();
    await clientWith(f).upsert([item]);
    const { url, accessToken, itemType, requests } = parseBody(f as never);

    expect(url).toBe('https://graph.test/v21.0/cat_123/items_batch');
    expect(accessToken).toBe('tok');
    expect(itemType).toBe('PRODUCT_ITEM');
    expect(requests).toHaveLength(1);
    expect(requests[0].method).toBe('UPDATE');
    expect(requests[0].data.id).toBe('prod_1');
    expect(requests[0].data.price).toBe('480.00 GBP');
    // items_batch wants additional images comma-separated, not an array.
    expect(requests[0].data.additional_image_link).toBe('https://cdn/b.jpg,https://cdn/c.jpg');
  });

  it('is a no-op for an empty list', async () => {
    const f = okFetch();
    await clientWith(f).upsert([]);
    expect(f).not.toHaveBeenCalled();
  });
});

describe('MetaCatalogClient.remove', () => {
  it('posts a DELETE items_batch request', async () => {
    const f = okFetch();
    await clientWith(f).remove(['prod_1', 'prod_2']);
    const { requests } = parseBody(f as never);
    expect(requests).toEqual([
      { method: 'DELETE', data: { id: 'prod_1' } },
      { method: 'DELETE', data: { id: 'prod_2' } },
    ]);
  });

  it('is a no-op for an empty list', async () => {
    const f = okFetch();
    await clientWith(f).remove([]);
    expect(f).not.toHaveBeenCalled();
  });
});

describe('MetaCatalogClient error handling', () => {
  it('throws MetaCatalogError on a non-2xx response', async () => {
    const f = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => '{"error":{"message":"Invalid catalog"}}',
    }) as unknown as typeof fetch;

    await expect(clientWith(f).upsert([item])).rejects.toBeInstanceOf(MetaCatalogError);
    await expect(clientWith(f).upsert([item])).rejects.toThrow(/400/);
  });
});
