import { z } from 'zod';

/**
 * Admin category schemas. Mirrors the Phase 1 Category model: a name, an
 * optional explicit slug (auto-generated when absent), an optional parentId
 * for tree placement, and a free-text description that defaults to empty so
 * the form can omit the field entirely.
 */
export const CategoryCreateSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).optional(),
  parentId: z.string().min(1).nullable().optional(),
  description: z.string().max(5000).default(''),
  /** Optional URL/storage path for the category banner — surfaced on the
   *  homepage Shop-by-Category grid. */
  bannerImage: z.string().nullable().optional(),
});

export const CategoryUpdateSchema = CategoryCreateSchema.partial();

export type CategoryCreateInput = z.infer<typeof CategoryCreateSchema>;
export type CategoryUpdateInput = z.infer<typeof CategoryUpdateSchema>;
