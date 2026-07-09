import type { MetaCatalogItem } from './product-mapper';

const GRAPH_VERSION = 'v21.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

/** Network timeout for a catalog call — the admin save must never hang on Meta. */
const TIMEOUT_MS = 8_000;

export interface MetaCatalogConfig {
  catalogId: string;
  accessToken: string;
  /** Override for tests. */
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

interface BatchRequest {
  method: 'UPDATE' | 'DELETE';
  data: Record<string, unknown>;
}

export class MetaCatalogError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'MetaCatalogError';
  }
}

/**
 * Thin client over the Meta Catalog `items_batch` endpoint.
 *
 * `items_batch` upserts by `retailer_id` (our product id), so the same call
 * creates a new item or updates an existing one — no separate create path.
 * @see https://developers.facebook.com/docs/marketing-api/catalog-batch
 */
export class MetaCatalogClient {
  private readonly base: string;
  private readonly doFetch: typeof fetch;

  constructor(private readonly cfg: MetaCatalogConfig) {
    this.base = cfg.baseUrl ?? GRAPH_BASE;
    this.doFetch = cfg.fetchImpl ?? fetch;
  }

  /** Create-or-update the given items in the catalog. */
  async upsert(items: MetaCatalogItem[]): Promise<void> {
    if (items.length === 0) return;
    await this.batch(
      items.map((item) => ({
        method: 'UPDATE' as const,
        // `additional_image_link` is a comma-separated string in items_batch,
        // unlike the XML feed where it's a repeated element.
        data: {
          ...item,
          additional_image_link: item.additional_image_link.join(','),
        },
      })),
    );
  }

  /** Remove items from the catalog (unpublished / archived / deleted). */
  async remove(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.batch(ids.map((id) => ({ method: 'DELETE' as const, data: { id } })));
  }

  private async batch(requests: BatchRequest[]): Promise<void> {
    const body = new URLSearchParams({
      access_token: this.cfg.accessToken,
      item_type: 'PRODUCT_ITEM',
      requests: JSON.stringify(requests),
    });

    const res = await this.doFetch(`${this.base}/${this.cfg.catalogId}/items_batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new MetaCatalogError(
        `Meta catalog items_batch failed (${res.status}): ${text.slice(0, 500)}`,
        res.status,
      );
    }
  }
}
