import Image from "next/image";
import Link from "next/link";
import { Section } from "@/components/ui/section";
import { Container } from "@/components/ui/container";
import { Display, Eyebrow } from "@/components/ui/typography";

export interface ShopByCategoryItem {
  slug: string;
  name: string;
  /** Optional banner image; falls back to a neutral surface when missing
   *  so a freshly-seeded category without an image still renders. */
  bannerImage: string | null;
}

export interface ShopByCategoryProps {
  items: ShopByCategoryItem[];
  /** Eyebrow label above the heading. Defaults to 'Browse Collections'. */
  eyebrow?: string;
  /** Display heading; defaults to 'Shop by Category'. */
  heading?: string;
}

/**
 * Homepage block presenting top-level categories as image cards. Tapping a
 * card lands on /collection/<slug>. Layout: 2 columns on mobile, 3 on
 * tablet, 4 on desktop — matches the editorial feel of DUCIE's category
 * grid.
 */
export function ShopByCategory({ items, eyebrow, heading }: ShopByCategoryProps) {
  if (items.length === 0) return null;
  return (
    <Section padding="lg">
      <Container size="wide">
        <div className="text-center mb-10">
          <Eyebrow className="mb-3">{eyebrow ?? "Browse Collections"}</Eyebrow>
          <Display level="md" as="h2">
            {heading ?? "Shop by Category"}
          </Display>
        </div>
        <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((item) => (
            <li key={item.slug}>
              <Link
                href={`/collection/${item.slug}`}
                className="group block relative overflow-hidden bg-surface-secondary aspect-[3/4]"
              >
                {item.bannerImage ? (
                  <Image
                    src={item.bannerImage}
                    alt={item.name}
                    fill
                    sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : null}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/40" aria-hidden />
                <div className="absolute inset-0 flex items-end justify-center pb-6">
                  <span className="text-[14px] font-semibold uppercase tracking-[0.2em] text-white drop-shadow">
                    {item.name}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}
