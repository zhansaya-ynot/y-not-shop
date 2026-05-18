import Link from "next/link";
import type { Product } from "@/lib/schemas";
import { ProductCard } from "@/components/product-card";
import { formatPrice } from "@/lib/format";
import { Section } from "@/components/ui/section";
import { Container } from "@/components/ui/container";
import { Display } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";

export interface ProductsRowProps {
  title: string;
  products: Product[];
  ctaHref: string;
  ctaLabel?: string;
}

export function ProductsRow({
  title,
  products,
  ctaHref,
  ctaLabel = "See more",
}: ProductsRowProps) {
  return (
    <Section padding="lg">
      <Container size="wide">
        <Display level="md" as="h2" className="mb-12 text-center">
          {title}
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

        <div className="mt-12 flex justify-center">
          <Link href={ctaHref}>
            <Button>{ctaLabel}</Button>
          </Link>
        </div>
      </Container>
    </Section>
  );
}
