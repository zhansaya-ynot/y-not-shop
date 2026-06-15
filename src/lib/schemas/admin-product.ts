import { z } from 'zod';

export const ProductCreateSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(200).optional(), // auto-generated if absent
  // description and materials are rich-text (TipTap) fields — stored as HTML,
  // so even modest copy expands to far more characters than the visible text
  // (paragraphs, bold, lists, tables all add markup). The limits are generous
  // to stop a normal edit from 400-ing and silently discarding the whole save.
  // The DB columns are unbounded `text`, so these caps are purely a sanity
  // guard against pathological payloads.
  description: z.string().min(1).max(50000),
  priceCents: z.number().int().positive(),
  materials: z.string().max(50000).default(''),
  care: z.string().max(10000).default(''),
  sizing: z.string().max(10000).default(''),
  weightGrams: z.number().int().positive().optional(),
  hsCode: z
    .string()
    .regex(/^\d{4,10}$/)
    .optional(),
  countryOfOriginCode: z.string().length(2).optional(),
  preOrder: z.boolean().default(false),
  /** True for accessories / one-size pieces — disables size variant
   *  enforcement on the storefront. Optional in the create payload (defaults
   *  to false at the DB layer). */
  isOneSize: z.boolean().optional(),
  /** Optional URL or storage path for the size guide image shown in the
   *  PDP modal. Empty string is normalised to null at the service layer. */
  sizeGuideImage: z.string().nullable().optional(),
  /** Homepage collection groupings — drives the per-collection landing
   *  pages. A product may belong to several at once. Empty array = not
   *  featured in any collection page. */
  homeCollections: z
    .array(z.enum(['NEW_COLLECTION', 'TIMELESS', 'NEW_ARRIVALS']))
    .optional(),
});

export const ProductUpdateSchema = ProductCreateSchema.partial().extend({
  categoryIds: z.array(z.string().min(1)).optional(),
  /** Curated "Complete the look" suggestions — up to 5 other product
   *  ids, in display order. Undefined = no change; [] = clear. */
  relatedProductIds: z.array(z.string().min(1)).max(5).optional(),
});

export const ProductImagesAddSchema = z.object({
  items: z
    .array(
      z.object({
        url: z.string().url(),
        alt: z.string().max(200).optional(),
      }),
    )
    .min(1),
});

export const ProductImagesReorderSchema = z.object({
  order: z.array(z.string().min(1)).min(1),
});

export const ProductImageColourSchema = z.object({
  imageId: z.string().min(1),
  /** Empty string / null clears the colour tag. */
  colour: z.string().max(120).nullable(),
});

export const ProductSizesUpdateSchema = z.object({
  sizes: z
    .array(
      z.object({
        size: z.enum(['S', 'M', 'L']),
        stock: z.number().int().min(0),
      }),
    )
    .min(1),
});

export const ProductColoursUpdateSchema = z.object({
  colours: z.array(
    z.object({
      name: z.string().min(1).max(50),
      hex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    }),
  ),
});

export const ProductStatusChangeSchema = z.object({
  to: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']),
});

export type ProductCreateInput = z.infer<typeof ProductCreateSchema>;
export type ProductUpdateInput = z.infer<typeof ProductUpdateSchema>;
export type ProductSizesUpdateInput = z.infer<typeof ProductSizesUpdateSchema>;
export type ProductColoursUpdateInput = z.infer<typeof ProductColoursUpdateSchema>;
