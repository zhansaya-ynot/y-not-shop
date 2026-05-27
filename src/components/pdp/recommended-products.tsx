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
          You may also like
        </Display>
      </Container>
      {/* Horizontal-scroll carousel — same behaviour on mobile and
          desktop. snap-x gives a tile-to-tile scroll; each card is a
          fixed-width column sized by vw so ~2 fit on phone, ~4 on
          desktop without breaking into a grid. */}
      <ul
        className="
          flex gap-4 overflow-x-auto snap-x snap-mandatory
          px-8 md:px-12 md:gap-8
          [scrollbar-width:thin]
          pb-2
        "
      >
        {products.map((p) => (
          <li
            key={p.id}
            className="
              flex-shrink-0 snap-start
              w-[60vw] sm:w-[40vw] md:w-[30vw] lg:w-[22vw]
              max-w-[340px]
            "
          >
            <ProductCard
              href={`/products/${p.slug}`}
              name={p.name}
              price={formatPrice(p.price, "GBP")}
              image={p.images[0]}
              hoverImage={p.images[1]}
            />
          </li>
        ))}
      </ul>
    </Section>
  );
}
