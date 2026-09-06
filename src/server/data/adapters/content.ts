import type {
  HeroBlock as ZodHero,
  Lookbook as ZodLookbook,
  StaticPage as ZodStaticPage,
} from "@/lib/schemas";
import type {
  HeroBlock as PrismaHero,
  LookbookImage as PrismaLookbookImage,
  StaticPage as PrismaStaticPage,
} from "@prisma/client";

export function toHero(row: PrismaHero): ZodHero {
  return {
    kind: row.kind === "VIDEO" ? "video" : "image",
    image: row.imageUrl,
    videoUrl: row.videoUrl,
    // Phones get the portrait crop when one exists; otherwise they keep
    // showing the landscape asset, which is what happened before the
    // mobile columns were added.
    mobileImage: row.mobileImageUrl ?? row.imageUrl,
    mobileVideo: row.mobileVideoUrl ?? row.videoUrl,
    eyebrow: row.eyebrow,
    ctaLabel: row.ctaLabel,
    ctaHref: row.ctaHref,
  };
}

export function toLookbook(rows: PrismaLookbookImage[]): ZodLookbook {
  return {
    images: [...rows]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((r) => ({ src: r.src, alt: r.alt, productSlug: r.productSlug })),
  };
}

export function toStaticPage(row: PrismaStaticPage): ZodStaticPage {
  return {
    slug: row.slug,
    title: row.title,
    bodyMarkdown: row.bodyMarkdown,
    meta: {
      title: row.metaTitle,
      description: row.metaDescription,
    },
  };
}
