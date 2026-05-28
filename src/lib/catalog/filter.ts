import type { Product, Size } from "@/lib/schemas";

export type CatalogSort = "newest" | "price-asc" | "price-desc";

export interface CatalogQuery {
  /** A second category to intersect with (e.g. material slug while on /collection/jackets). */
  crossCategorySlug?: string;
  /** Garment category slug — collection / shop pages only. */
  categorySlug?: string;
  /** Colour name (matches ColourOption.name or the product's primary colour). */
  colour?: string;
  size?: Size;
  maxPrice?: number;
  sort?: CatalogSort;
}

export function applyCatalogQuery(
  products: Product[],
  query: CatalogQuery,
): Product[] {
  let result = products;

  if (query.crossCategorySlug) {
    const cross = query.crossCategorySlug;
    result = result.filter((p) => p.categorySlugs.includes(cross));
  }
  if (query.categorySlug) {
    const cat = query.categorySlug;
    result = result.filter((p) => p.categorySlugs.includes(cat));
  }
  if (query.colour) {
    const colour = query.colour;
    result = result.filter(
      (p) =>
        p.colour === colour ||
        (p.colourOptions?.some((c) => c.name === colour) ?? false),
    );
  }
  if (query.size) {
    const s = query.size;
    result = result.filter((p) => p.sizes.includes(s));
  }
  if (typeof query.maxPrice === "number") {
    const max = query.maxPrice;
    result = result.filter((p) => p.price <= max);
  }

  if (query.sort === "price-asc") {
    result = [...result].sort((a, b) => a.price - b.price);
  } else if (query.sort === "price-desc") {
    result = [...result].sort((a, b) => b.price - a.price);
  }
  // "newest" is implicit insertion order (mock has no createdAt yet)

  return result;
}

/** Category slugs that represent a material rather than a garment type.
 *  Used to split the flat category list into the "Material" and
 *  "Category" filter dropdowns. */
export const MATERIAL_SLUGS = ["leather", "suede", "wool", "cotton", "tencel"];

/** Distinct colour options across a product set, alphabetical, for the
 *  colour filter dropdown. Reads colourOptions first, falling back to the
 *  product's primary `colour`. */
export function colourOptionsFromProducts(
  products: Product[],
): Array<{ value: string; label: string }> {
  const names = new Set<string>();
  for (const p of products) {
    if (p.colourOptions?.length) {
      for (const c of p.colourOptions) names.add(c.name);
    } else if (p.colour) {
      names.add(p.colour);
    }
  }
  return [...names]
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ value: name, label: name }));
}
