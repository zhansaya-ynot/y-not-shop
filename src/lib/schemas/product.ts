import { z } from "zod";

export const SizeSchema = z.enum(["S", "M", "L"]);
export type Size = z.infer<typeof SizeSchema>;

export const ProductDetailsSchema = z.object({
  materials: z.string(),
  care: z.string(),
  sizing: z.string(),
});

export const ColourOptionSchema = z.object({
  name: z.string().min(1),
  hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});
export type ColourOption = z.infer<typeof ColourOptionSchema>;

export const ProductSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  /** Price in minor units (pence for GBP). 89500 = £895.00 */
  price: z.number().int().nonnegative(),
  currency: z.literal("GBP"),
  description: z.string(),
  images: z.array(z.string()),
  /** Per-image colour tags, parallel to `images`. `colour: null` means the
   *  image shows for every colour. Optional for backwards-compat; the PDP
   *  gallery uses it to swap photos when the customer changes colour. */
  imageVariants: z
    .array(z.object({ url: z.string(), colour: z.string().nullable() }))
    .optional(),
  /** Default/primary colour name (kept for backwards-compat with existing carts). */
  colour: z.string().optional(),
  /** Optional colour swatches; when present the PDP renders a ColourPicker. */
  colourOptions: z.array(ColourOptionSchema).optional(),
  sizes: z.array(SizeSchema),
  categorySlugs: z.array(z.string()),
  /** Aggregate stock per size, summed across all colours. Kept for cards and
   *  any consumer that doesn't care about colour. */
  stock: z.partialRecord(SizeSchema, z.number().int().nonnegative()),
  /** Stock per colour → size. Key is the ColourOption.name; the no-colour
   *  variant uses "". The PDP uses this so size availability follows the
   *  selected colour. */
  stockByColour: z
    .record(z.string(), z.partialRecord(SizeSchema, z.number().int().nonnegative()))
    .optional(),
  preOrder: z.boolean(),
  /** True when the product has no size variants (sold as 'one size'). The
   *  storefront skips the size picker and the cart records ONE_SIZE.
   *  Optional for backwards-compat with older fixtures; treat undefined
   *  as false. */
  isOneSize: z.boolean().optional(),
  /** URL/storage key for the uploaded size guide image — shown in a modal
   *  triggered from the PDP "Size guide" link. */
  sizeGuideImage: z.string().nullable().optional(),
  details: ProductDetailsSchema,
});

export type Product = z.infer<typeof ProductSchema>;
