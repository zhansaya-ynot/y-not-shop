import type { Prisma, Size } from '@prisma/client';
import { prisma } from '@/server/db/client';

/**
 * ProductSize has a composite primary key (productId, size) — there's no
 * scalar id. The admin UI needs a stable single-field identifier so we
 * encode/decode it here. The separator is `__` (double underscore) which
 * cuid (used for productId) cannot produce.
 */
const VARIANT_SEPARATOR = '__';

export function encodeVariantId(productId: string, size: Size): string {
  return `${productId}${VARIANT_SEPARATOR}${size}`;
}

export interface DecodedVariantId {
  productId: string;
  size: Size;
}

const VALID_SIZES: ReadonlySet<string> = new Set([
  'XS', 'S', 'M', 'L', 'XL',
] satisfies Size[]);

export function decodeVariantId(raw: string): DecodedVariantId | null {
  const idx = raw.indexOf(VARIANT_SEPARATOR);
  if (idx === -1) return null;
  const productId = raw.slice(0, idx);
  const size = raw.slice(idx + VARIANT_SEPARATOR.length);
  if (!productId || !VALID_SIZES.has(size)) return null;
  return { productId, size: size as Size };
}

export interface InventoryRow {
  variantId: string;
  productId: string;
  productName: string;
  productSlug: string;
  size: Size;
  stock: number;
  isLow: boolean;
}

export interface ListInventoryOpts {
  search?: string;
  lowOnly?: boolean;
}

const LOW_STOCK_THRESHOLD = 5;

/**
 * List every (product, size) variant for the inventory grid. Joins through
 * Product to expose name + slug; soft-deleted products are excluded.
 *
 * Sorted by product name then size for stable display. The list is
 * unpaginated by design — even a 200-product catalogue × 6 sizes is 1.2k
 * rows, which renders instantly.
 */
export async function listInventoryForAdmin(
  opts: ListInventoryOpts = {},
): Promise<InventoryRow[]> {
  const productWhere: Prisma.ProductWhereInput = { deletedAt: null };
  if (opts.search) {
    productWhere.name = { contains: opts.search, mode: 'insensitive' };
  }

  const sizesWhere: Prisma.ProductSizeWhereInput = {
    product: productWhere,
  };
  if (opts.lowOnly) {
    sizesWhere.stock = { lte: LOW_STOCK_THRESHOLD };
  }

  const rows = await prisma.productSize.findMany({
    where: sizesWhere,
    include: {
      product: { select: { id: true, name: true, slug: true } },
    },
    orderBy: [{ product: { name: 'asc' } }, { size: 'asc' }],
  });

  return rows.map((r) => ({
    variantId: encodeVariantId(r.productId, r.size),
    productId: r.productId,
    productName: r.product.name,
    productSlug: r.product.slug,
    size: r.size,
    stock: r.stock,
    isLow: r.stock <= LOW_STOCK_THRESHOLD,
  }));
}

export class InventoryError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'InventoryError';
  }
}

/**
 * Set the absolute stock for a single variant. Throws InventoryError(400)
 * for negative input, InventoryError(404) when the variant doesn't exist.
 *
 * Returns the new stock value so the client can confirm the optimistic
 * update wasn't clobbered by a concurrent write.
 */
export async function setVariantStock(
  variantId: string,
  stock: number,
): Promise<number> {
  if (!Number.isInteger(stock) || stock < 0) {
    throw new InventoryError('Stock must be a non-negative integer', 400);
  }
  const decoded = decodeVariantId(variantId);
  if (!decoded) {
    throw new InventoryError('Invalid variant id', 400);
  }
  const existing = await prisma.productSize.findUnique({
    where: { productId_size: { productId: decoded.productId, size: decoded.size } },
  });
  if (!existing) {
    throw new InventoryError('Variant not found', 404);
  }
  const updated = await prisma.productSize.update({
    where: { productId_size: { productId: decoded.productId, size: decoded.size } },
    data: { stock },
    select: { stock: true },
  });
  return updated.stock;
}

export const INVENTORY_LOW_STOCK_THRESHOLD = LOW_STOCK_THRESHOLD;
