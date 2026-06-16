import type { Product, HomeCollection } from "@prisma/client";
import { prisma } from "../db/client";

export type ProductWithRelations = Product & {
  images: { url: string; alt: string; sortOrder: number; colour: string | null }[];
  sizes: { size: string; colour: string; stock: number }[];
  colours: { name: string; hex: string; sortOrder: number }[];
  categories: { category: { slug: string } }[];
};

const include = {
  images: { orderBy: { sortOrder: "asc" } },
  sizes: true,
  colours: { orderBy: { sortOrder: "asc" } },
  categories: { include: { category: true } },
} as const;

/**
 * Storefront visibility predicate. Storefront product queries only ever return
 * PUBLISHED, non-soft-deleted rows — DRAFT and ARCHIVED stay hidden from the
 * public site. Admin queries (in `src/server/admin/*`) bypass this and see
 * everything by querying `prisma.product` directly.
 */
const storefrontVisible = { status: "PUBLISHED", deletedAt: null } as const;

export async function findProductBySlug(slug: string): Promise<ProductWithRelations | null> {
  const product = await prisma.product.findFirst({
    where: { slug, ...storefrontVisible },
    include,
  });
  return product as ProductWithRelations | null;
}

export async function listProducts(): Promise<ProductWithRelations[]> {
  const products = await prisma.product.findMany({
    where: { ...storefrontVisible },
    orderBy: { createdAt: "desc" },
    include,
  });
  return products as ProductWithRelations[];
}

export async function listProductsByCategory(
  categorySlug: string,
): Promise<ProductWithRelations[]> {
  const products = await prisma.product.findMany({
    where: {
      ...storefrontVisible,
      categories: { some: { category: { slug: categorySlug } } },
    },
    orderBy: { createdAt: "desc" },
    include,
  });
  return products as ProductWithRelations[];
}

export async function listProductsByHomeCollection(
  collection: HomeCollection,
): Promise<ProductWithRelations[]> {
  const products = await prisma.product.findMany({
    where: { ...storefrontVisible, homeCollections: { has: collection } },
    orderBy: { createdAt: "desc" },
    include,
  });
  return products as ProductWithRelations[];
}

export async function listNewArrivals(limit: number): Promise<ProductWithRelations[]> {
  const products = await prisma.product.findMany({
    where: { ...storefrontVisible },
    orderBy: { createdAt: "desc" },
    take: limit,
    include,
  });
  return products as ProductWithRelations[];
}

/**
 * Operator-curated related products for a product, in the order the
 * operator set. Soft-deleted / non-published suggestions are dropped so
 * the storefront never links to a hidden product.
 */
export async function listRelatedProducts(
  productId: string,
): Promise<ProductWithRelations[]> {
  const relations = await prisma.productRelation.findMany({
    where: { productId },
    orderBy: { sortOrder: "asc" },
    include: { related: { include } },
  });
  return relations
    .map((r) => r.related)
    .filter((p) => p.status === "PUBLISHED" && p.deletedAt === null) as ProductWithRelations[];
}

export async function listRecommendations(
  excludeSlug: string,
  limit: number,
): Promise<ProductWithRelations[]> {
  const products = await prisma.product.findMany({
    where: { ...storefrontVisible, slug: { not: excludeSlug } },
    orderBy: { createdAt: "desc" },
    take: limit,
    include,
  });
  return products as ProductWithRelations[];
}

export async function searchProducts(query: string): Promise<ProductWithRelations[]> {
  const q = query.trim();
  if (!q) return [];
  const products = await prisma.product.findMany({
    where: {
      ...storefrontVisible,
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { categories: { some: { category: { slug: { contains: q.toLowerCase() } } } } },
      ],
    },
    include,
    take: 20,
  });
  return products as ProductWithRelations[];
}
