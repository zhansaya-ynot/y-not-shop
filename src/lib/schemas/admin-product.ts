import { z } from 'zod';

export const ProductCreateSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(200).optional(), // auto-generated if absent
  description: z.string().min(1).max(5000),
  priceCents: z.number().int().positive(),
  materials: z.string().max(2000).default(''),
  care: z.string().max(2000).default(''),
  sizing: z.string().max(2000).default(''),
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
});

export const ProductUpdateSchema = ProductCreateSchema.partial().extend({
  categoryIds: z.array(z.string().min(1)).optional(),
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

export const ProductSizesUpdateSchema = z.object({
  sizes: z
    .array(
      z.object({
        size: z.enum(['XS', 'S', 'M', 'L', 'XL']),
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
