import { z } from 'zod';

/**
 * Admin site policy schema. SitePolicy is a singleton row (`id =
 * 'singleton'`) — `updateSitePolicy` upserts it so the form never has to
 * worry about whether the row exists.
 */
export const SitePolicyUpdateSchema = z.object({
  defaultCurrency: z.enum(['GBP']).optional(),
  defaultCarrier: z.enum(['ROYAL_MAIL', 'DHL']).optional(),
  freeShipThresholdCents: z.number().int().min(0).optional(),
  contactEmail: z.string().email().optional(),
  whatsappNumber: z.string().max(40).optional(),
  /** URL/storage path for the side image on /sign-in. */
  authSignInImage: z.string().nullable().optional(),
  /** URL/storage path for the side image on /register. */
  authRegisterImage: z.string().nullable().optional(),
});

export type SitePolicyUpdateInput = z.infer<typeof SitePolicyUpdateSchema>;
