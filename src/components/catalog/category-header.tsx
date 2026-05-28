import * as React from "react";
import Image from "next/image";
import { Display } from "@/components/ui/typography";
import { BLUR_DARK } from "@/lib/image-placeholders";

export interface CategoryHeaderProps {
  title: string;
  bannerImage?: string | null;
}

export function CategoryHeader({ title, bannerImage }: CategoryHeaderProps) {
  if (bannerImage) {
    return (
      <header className="relative h-[40vh] min-h-[280px] w-full overflow-hidden bg-surface-dark">
        <Image
          src={bannerImage}
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
        <div className="absolute inset-0 bg-black/30" />
        <div className="relative z-10 flex h-full flex-col items-center justify-center text-center px-6">
          {/* White title, smaller size, no subtitle — Display defaults to
              dark text so the inverse colour must be set explicitly. */}
          <Display level="md" as="h1" className="text-foreground-inverse">
            {title}
          </Display>
        </div>
      </header>
    );
  }
  return (
    <header className="border-b border-border-light py-12 text-center">
      <Display level="md" as="h1">
        {title}
      </Display>
    </header>
  );
}
