import * as React from "react";
import { ProductCard } from "@/components/product-card";
import { formatPrice } from "@/lib/format";
import type { Product } from "@/lib/schemas";

export interface ProductGridProps {
  products: Product[];
}

export function ProductGrid({ products }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <p className="py-16 text-center text-[14px] text-foreground-secondary">
        No products match the current filters.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-6 md:grid-cols-4 md:gap-8">
      {products.map((p) => (
        <ProductCard
          key={p.id}
          href={`/products/${p.slug}`}
          name={p.name}
          price={formatPrice(p.price, "GBP")}
          image={p.images[0]}
          hoverImage={p.images[1]}
        />
      ))}
    </div>
  );
}
