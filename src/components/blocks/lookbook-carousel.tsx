import Image from "next/image";
import { BLUR_DARK } from "@/lib/image-placeholders";
import Link from "next/link";
import type { Lookbook } from "@/lib/schemas";
import { Section } from "@/components/ui/section";
import { Container } from "@/components/ui/container";
import { Display } from "@/components/ui/typography";

export interface LookbookCarouselProps {
  lookbook: Lookbook;
  title?: string;
}

export function LookbookCarousel({
  lookbook,
  title = "Lookbook",
}: LookbookCarouselProps) {
  return (
    <Section padding="lg">
      <Container size="wide" className="mb-10">
        <Display level="md" as="h2">
          {title}
        </Display>
      </Container>
      <div className="overflow-x-auto scroll-smooth snap-x snap-mandatory">
        <ul className="flex gap-4 px-5 md:gap-6 md:px-10">
          {lookbook.images.map((img, i) => {
            const inner = (
              <div className="relative h-[60vh] w-[80vw] max-w-[480px] flex-shrink-0 snap-start bg-surface-secondary overflow-hidden">
                <Image
                  src={img.src}
                  alt={img.alt}
                  fill
                  sizes="(min-width: 768px) 480px, 80vw"
                  placeholder="blur"
                  blurDataURL={BLUR_DARK}
                  quality={75}
                  loading="lazy"
                  className="object-cover"
                />
              </div>
            );
            return (
              <li key={i} className="flex-shrink-0">
                {img.productSlug ? (
                  <Link href={`/products/${img.productSlug}`}>{inner}</Link>
                ) : (
                  inner
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </Section>
  );
}
