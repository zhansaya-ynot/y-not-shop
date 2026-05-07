import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Display } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { BLUR_DARK } from "@/lib/image-placeholders";

export interface EditorialOverlayProps {
  title: string;
  body: string;
  image: string;
  ctaHref?: string;
  ctaLabel?: string;
}

/**
 * Full-width editorial section with the image as background and centred text on top.
 * Used for "Timeless Collection" on the homepage.
 */
export function EditorialOverlay({
  title,
  body,
  image,
  ctaHref,
  ctaLabel,
}: EditorialOverlayProps) {
  return (
    <section className="relative h-[80vh] min-h-[560px] w-full overflow-hidden bg-surface-dark">
      <Image
        src={image}
        alt=""
        fill
        sizes="100vw"
        placeholder="blur"
        blurDataURL={BLUR_DARK}
        quality={80}
        className="object-cover"
      />
      <div className="absolute inset-0 bg-black/40" />

      <div className="relative z-10 flex h-full flex-col items-center justify-center text-center text-foreground-inverse px-6">
        <Display level="lg" as="h2" className="text-foreground-inverse">
          {title}
        </Display>
        <p className="mt-6 max-w-[448px] text-[14px] leading-relaxed text-foreground-inverse/90 md:text-[15px]">
          {body}
        </p>
        {ctaHref && ctaLabel && (
          <Link href={ctaHref} className="mt-10">
            <Button
              size="lg"
              variant="outline"
              className="bg-transparent text-foreground-inverse border-foreground-inverse hover:bg-foreground-inverse hover:text-foreground-primary px-12"
            >
              {ctaLabel}
            </Button>
          </Link>
        )}
      </div>
    </section>
  );
}
