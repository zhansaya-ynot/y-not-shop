import Image from "next/image";
import Link from "next/link";
import { Section } from "@/components/ui/section";
import { Display, Eyebrow } from "@/components/ui/typography";
import { BLUR_DARK } from "@/lib/image-placeholders";

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
 * Homepage block presenting top-level categories as a horizontal-scroll
 * carousel — same behaviour on mobile and desktop. snap-x snap-mandatory
 * gives a precise tile-to-tile scroll, scrollbar-thin keeps the chrome
 * unobtrusive on Mac/Windows. Each card is a fixed-width column that
 * responds to viewport width via vw units so 2 fit on phone, 3 on tablet,
 * ~4 on desktop without breaking out into a grid.
 */
export function ShopByCategory({ items, eyebrow, heading }: ShopByCategoryProps) {
  if (items.length === 0) return null;
  return (
    <Section padding="lg">
      <div className="text-center mb-10 px-6">
        <Eyebrow className="mb-3">{eyebrow ?? "Browse Collections"}</Eyebrow>
        <Display level="md" as="h2">
          {heading ?? "Shop by Category"}
        </Display>
      </div>
      <ul
        className="
          flex gap-4 overflow-x-auto snap-x snap-mandatory
          px-6 md:px-10
          [scrollbar-width:thin]
          pb-2
        "
      >
        {items.map((item) => (
          <li
            key={item.slug}
            className="
              flex-shrink-0 snap-start
              w-[60vw] md:w-[34vw] lg:w-[24vw]
              max-w-[420px]
            "
          >
            <Link
              href={`/collection/${item.slug}`}
              className="group block relative overflow-hidden bg-surface-secondary aspect-[3/4]"
            >
              {item.bannerImage ? (
                <Image
                  src={item.bannerImage}
                  alt={item.name}
                  fill
                  sizes="(min-width: 1024px) 24vw, (min-width: 768px) 34vw, 60vw"
                  placeholder="blur"
                  blurDataURL={BLUR_DARK}
                  quality={75}
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : null}
              <div
                className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/40"
                aria-hidden
              />
              <div className="absolute inset-0 flex items-end justify-center pb-6">
                <span className="text-[14px] font-semibold uppercase tracking-[0.2em] text-white drop-shadow">
                  {item.name}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}
