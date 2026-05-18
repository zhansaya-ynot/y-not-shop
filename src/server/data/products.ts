import type { HomeCollection } from "@prisma/client";
import type { Product } from "@/lib/schemas";
import {
  findProductBySlug,
  listProducts,
  listProductsByCategory,
  listProductsByHomeCollection,
  listNewArrivals,
  listRecommendations,
} from "@/server/repositories/product.repo";
import { toProduct } from "./adapters/product";

export async function getAllProducts(): Promise<Product[]> {
  const rows = await listProducts();
  return rows.map(toProduct);
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const row = await findProductBySlug(slug);
  return row ? toProduct(row) : null;
}

export async function getProductsByCategory(
  categorySlug: string,
): Promise<Product[]> {
  const rows = await listProductsByCategory(categorySlug);
  return rows.map(toProduct);
}

export async function getProductsByHomeCollection(
  collection: HomeCollection,
): Promise<Product[]> {
  const rows = await listProductsByHomeCollection(collection);
  return rows.map(toProduct);
}

export async function getNewArrivals(limit = 4): Promise<Product[]> {
  const rows = await listNewArrivals(limit);
  return rows.map(toProduct);
}

export async function getRecommendations(
  excludeSlug: string,
  limit = 4,
): Promise<Product[]> {
  const rows = await listRecommendations(excludeSlug, limit);
  return rows.map(toProduct);
}
