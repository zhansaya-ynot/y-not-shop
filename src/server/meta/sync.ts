import { prisma } from '@/server/db/client';
import { env } from '@/server/env';
import type { ProductWithRelations } from '@/server/repositories/product.repo';
import { MetaCatalogClient } from './catalog';
import { toMetaCatalogItem } from './product-mapper';

const include = {
  images: { orderBy: { sortOrder: 'asc' } },
  sizes: true,
  colours: { orderBy: { sortOrder: 'asc' } },
  categories: { include: { category: true } },
} as const;

export function siteUrl(): string {
  return env.APP_URL ?? env.NEXT_PUBLIC_SITE_URL;
}

/** `null` when Meta catalog credentials aren't configured — push is disabled. */
export function getMetaCatalogClient(): MetaCatalogClient | null {
  if (!env.META_CATALOG_ID || !env.META_ACCESS_TOKEN) return null;
  return new MetaCatalogClient({
    catalogId: env.META_CATALOG_ID,
    accessToken: env.META_ACCESS_TOKEN,
  });
}

function logFailure(action: string, productId: string, err: unknown): void {
  process.stderr.write(
    `[meta/sync] ${action} failed for ${productId}: ${
      err instanceof Error ? err.message : String(err)
    }\n`,
  );
}

/**
 * Push a single product's current state to the Meta catalog.
 *
 * Only PUBLISHED, non-deleted products with at least one image belong in an ad
 * catalog — everything else is removed from it. Drafts intentionally never
 * appear, otherwise unfinished listings could be advertised.
 *
 * Best-effort by design: a Meta outage must never fail an admin save. Failures
 * are logged and reconciled by the next scheduled pull of /api/feed/meta.xml.
 */
export async function syncProductToMeta(productId: string): Promise<void> {
  const client = getMetaCatalogClient();
  if (!client) return;

  try {
    const product = await prisma.product.findUnique({ where: { id: productId }, include });

    // Not sellable → make sure it's not in the catalog.
    if (!product || product.deletedAt !== null || product.status !== 'PUBLISHED') {
      await client.remove([productId]);
      return;
    }

    const item = toMetaCatalogItem(product as unknown as ProductWithRelations, {
      siteUrl: siteUrl(),
    });
    // No image — Meta rejects the item, so keep it out of the catalog.
    if (!item) {
      await client.remove([productId]);
      return;
    }

    await client.upsert([item]);
  } catch (err) {
    logFailure('syncProductToMeta', productId, err);
  }
}

/**
 * Remove a product from the catalog by id. Used on hard delete, where the row
 * is already gone and {@link syncProductToMeta} can't load it.
 */
export async function removeProductFromMeta(productId: string): Promise<void> {
  const client = getMetaCatalogClient();
  if (!client) return;
  try {
    await client.remove([productId]);
  } catch (err) {
    logFailure('removeProductFromMeta', productId, err);
  }
}

/**
 * Upsert every published product in one batch. Used to backfill a fresh
 * catalog; the XML feed covers ongoing reconciliation.
 */
export async function syncAllPublishedProducts(): Promise<{ pushed: number; skipped: number }> {
  const client = getMetaCatalogClient();
  if (!client) return { pushed: 0, skipped: 0 };

  const products = await prisma.product.findMany({
    where: { status: 'PUBLISHED', deletedAt: null },
    include,
  });
  const url = siteUrl();
  const items = products
    .map((p) => toMetaCatalogItem(p as unknown as ProductWithRelations, { siteUrl: url }))
    .filter((i): i is NonNullable<typeof i> => i !== null);

  await client.upsert(items);
  return { pushed: items.length, skipped: products.length - items.length };
}
