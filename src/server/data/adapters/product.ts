import type { Product as ZodProduct, Size } from "@/lib/schemas";
import type { ProductWithRelations } from "@/server/repositories/product.repo";

export function toProduct(row: ProductWithRelations): ZodProduct {
  const colourOptions = row.colours.length
    ? row.colours.map((c) => ({ name: c.name, hex: c.hex }))
    : undefined;
  // Stock now lives per (size, colour). Aggregate to a per-size total for the
  // legacy `stock` field, and build a colour→size map for the PDP picker so
  // size availability follows the selected colour.
  const stock: Partial<Record<Size, number>> = {};
  const stockByColour: Record<string, Partial<Record<Size, number>>> = {};
  for (const s of row.sizes) {
    const size = s.size as Size;
    stock[size] = (stock[size] ?? 0) + s.stock;
    (stockByColour[s.colour] ??= {})[size] = s.stock;
  }
  // Distinct sizes (the matrix repeats each size once per colour).
  const sizes = Array.from(new Set(row.sizes.map((s) => s.size as Size)));
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    price: row.priceCents,
    currency: "GBP",
    description: row.description,
    images: row.images.map((i) => i.url),
    imageVariants: row.images.map((i) => ({ url: i.url, colour: i.colour ?? null })),
    colour: colourOptions?.[0]?.name,
    colourOptions,
    sizes,
    categorySlugs: row.categories.map((c) => c.category.slug),
    stock,
    stockByColour,
    preOrder: row.preOrder,
    isOneSize: row.isOneSize,
    sizeGuideImage: row.sizeGuideImage,
    details: {
      materials: row.materials,
      care: row.care,
      sizing: row.sizing,
    },
  };
}
