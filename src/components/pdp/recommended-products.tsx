import * as React from "react";
import { ProductCard } from "@/components/product-card";
import { formatPrice } from "@/lib/format";
import { Section } from "@/components/ui/section";
import { Container } from "@/components/ui/container";
import { Display } from "@/components/ui/typography";
import type { Product } from "@/lib/schemas";

export function RecommendedProducts({ products }: { products: Product[] }) {
  if (products.length === 0) return null;
  return (
    <Section padding="lg">
      <Container size="wide">
        <Display level="md" as="h2" className="mb-12 text-center">
          We think you might like
        </Display>
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
      </Container>
    </Section>
  );
}
