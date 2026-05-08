import { z } from "zod";

export const SeoMetaSchema = z.object({
  title: z.string(),
  description: z.string(),
});

export const CategorySchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  /** Portrait/square image for the homepage Shop-by-Category card. */
  bannerImage: z.string().nullable(),
  /** Wide/landscape image for the /collection/<slug> page hero. Optional;
   *  components fall back to bannerImage when absent. */
  heroImage: z.string().nullable().optional(),
  sortOrder: z.number().int(),
  meta: SeoMetaSchema,
});

export type Category = z.infer<typeof CategorySchema>;
