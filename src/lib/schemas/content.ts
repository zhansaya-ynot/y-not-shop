import { z } from "zod";
import { SeoMetaSchema } from "./category";

export const HeroBlockSchema = z.object({
  kind: z.enum(["image", "video"]),
  /** Landscape (16:9) asset, rendered from the `md` breakpoint up. */
  image: z.string(),
  videoUrl: z.string().nullable(),
  /**
   * Portrait (9:16) asset for phones. Never null — `toHero` resolves the
   * fallback to the landscape asset, so the storefront can render both
   * without repeating the `??` at every call site.
   */
  mobileImage: z.string(),
  mobileVideo: z.string().nullable(),
  eyebrow: z.string(),
  ctaLabel: z.string(),
  ctaHref: z.string(),
});
export type HeroBlock = z.infer<typeof HeroBlockSchema>;

export const AnnouncementBlockSchema = z.object({
  messages: z.array(z.string().min(1)).min(1),
});
export type AnnouncementBlock = z.infer<typeof AnnouncementBlockSchema>;

export const LookbookImageSchema = z.object({
  src: z.string(),
  alt: z.string(),
  /** Optional product link */
  productSlug: z.string().nullable(),
});
export type LookbookImage = z.infer<typeof LookbookImageSchema>;

export const LookbookSchema = z.object({
  images: z.array(LookbookImageSchema),
});
export type Lookbook = z.infer<typeof LookbookSchema>;

export const StaticPageSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  bodyMarkdown: z.string(),
  meta: SeoMetaSchema,
});
export type StaticPage = z.infer<typeof StaticPageSchema>;
