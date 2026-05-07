import type { Product as ZodProduct, Size } from "@/lib/schemas";
import type { ProductWithRelations } from "@/server/repositories/product.repo";

export function toProduct(row: ProductWithRelations): ZodProduct {
  const colourOptions = row.colours.length
    ? row.colours.map((c) => ({ name: c.name, hex: c.hex }))
    : undefined;
  const stock = Object.fromEntries(
    row.sizes.map((s) => [s.size as Size, s.stock]),
  ) as Partial<Record<Size, number>>;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    price: row.priceCents,
    currency: "GBP",
    description: row.description,
    images: row.images.map((i) => i.url),
    colour: colourOptions?.[0]?.name,
    colourOptions,
    sizes: row.sizes.map((s) => s.size as Size),
    categorySlugs: row.categories.map((c) => c.category.slug),
    stock,
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
