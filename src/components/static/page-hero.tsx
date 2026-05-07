import * as React from "react";
import Image from "next/image";
import { Display, Eyebrow } from "@/components/ui/typography";
import { BLUR_DARK } from "@/lib/image-placeholders";

export interface PageHeroProps {
  eyebrow?: string;
  title: string;
  description?: string;
  image?: string;
}

export function PageHero({ eyebrow, title, description, image }: PageHeroProps) {
  if (image) {
    return (
      <header className="relative h-[50vh] min-h-[360px] w-full overflow-hidden bg-surface-dark">
        <Image
          src={image}
          alt=""
          fill
          priority
          fetchPriority="high"
          sizes="100vw"
          placeholder="blur"
          blurDataURL={BLUR_DARK}
          quality={80}
          className="object-cover"
        />
        <div className="absolute inset-0 bg-black/35" />
        <div className="relative z-10 flex h-full flex-col items-center justify-center text-center text-foreground-inverse px-6">
          {eyebrow && <Eyebrow className="text-foreground-inverse mb-4">{eyebrow}</Eyebrow>}
          <Display level="lg" as="h1">{title}</Display>
          {description && (
            <p className="mt-4 max-w-[448px] text-[14px] leading-relaxed">{description}</p>
          )}
        </div>
      </header>
    );
  }
  return (
    <header className="border-b border-border-light py-16 text-center">
      {eyebrow && <Eyebrow className="mb-3">{eyebrow}</Eyebrow>}
      <Display level="lg" as="h1">{title}</Display>
      {description && (
        <p className="mt-4 mx-auto max-w-[640px] text-[14px] text-foreground-secondary">{description}</p>
      )}
    </header>
  );
}
