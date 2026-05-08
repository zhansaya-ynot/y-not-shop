import { z } from 'zod';

/**
 * Admin static page schemas (about, contact, FAQ, terms…). The body is
 * stored as TipTap-rendered HTML in `bodyMarkdown` (column rename
 * deferred). `extras` carries page-specific structured content that
 * doesn't fit a flat body — value callouts, pull quotes, info grids.
 * The shape is intentionally permissive at the API layer (any JSON);
 * the storefront renderer validates per-slug against
 * `@/lib/cms/page-extras`.
 */
export const StaticPageCreateSchema = z.object({
  slug: z.string().min(1).max(200).optional(),
  title: z.string().min(1).max(200),
  bodyMarkdown: z.string().max(100_000).default(''),
  metaTitle: z.string().max(200).default(''),
  metaDescription: z.string().max(500).default(''),
  /** Optional URL/storage path for the wide hero banner above the page
   *  title. Empty string is treated as null at the service layer. */
  heroImage: z.string().nullable().optional(),
  /** Page-specific structured content. Stored verbatim in StaticPage.extras. */
  extras: z.unknown().optional(),
});

export const StaticPageUpdateSchema = StaticPageCreateSchema.partial();

export type StaticPageCreateInput = z.input<typeof StaticPageCreateSchema>;
export type StaticPageUpdateInput = z.input<typeof StaticPageUpdateSchema>;
