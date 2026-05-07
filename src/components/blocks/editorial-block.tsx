import Image from "next/image";
import { BLUR_DARK } from "@/lib/image-placeholders";
import Link from "next/link";
import { Section } from "@/components/ui/section";
import { Container } from "@/components/ui/container";
import { Display } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";

export interface EditorialBlockProps {
  title: string;
  body: string;
  image: string;
  ctaHref?: string;
  ctaLabel?: string;
  /** Image side; defaults to left on desktop. */
  imageSide?: "left" | "right";
}

export function EditorialBlock({
  title,
  body,
  image,
  ctaHref,
  ctaLabel,
  imageSide = "left",
}: EditorialBlockProps) {
  return (
    <Section padding="lg">
      <Container size="wide">
        <div
          className={`grid items-center gap-10 md:grid-cols-2 md:gap-16 ${
            imageSide === "right" ? "md:[&>*:first-child]:order-2" : ""
          }`}
        >
          <div className="relative aspect-[4/5] w-full bg-surface-secondary overflow-hidden">
            <Image
              src={image}
              alt={title}
              fill
              sizes="(min-width: 768px) 50vw, 100vw"
              placeholder="blur"
              blurDataURL={BLUR_DARK}
              quality={80}
              className="object-cover"
            />
          </div>
          <div className="w-full max-w-[480px]">
            <Display level="md" as="h2">
              {title}
            </Display>
            <p className="mt-6 text-[15px] leading-relaxed text-foreground-secondary">
              {body}
            </p>
            {ctaHref && ctaLabel && (
              <Link href={ctaHref} className="mt-8 inline-block">
                <Button variant="outline">{ctaLabel}</Button>
              </Link>
            )}
          </div>
        </div>
      </Container>
    </Section>
  );
}
