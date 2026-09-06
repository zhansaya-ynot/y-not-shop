import { z } from 'zod';

/**
 * Admin hero block schemas. The HeroBlock model holds a single fullscreen
 * splash card on the homepage; only one row may be active at a time, an
 * invariant enforced by `activateHero` (and a partial unique index).
 *
 * `videoUrl` is only meaningful when `kind === 'VIDEO'`. The `mobile*`
 * variants hold the portrait (9:16) crops; leaving them unset makes the
 * storefront fall back to the landscape asset on phones too.
 * We accept either
 * key on create — server-side `activateHero` is responsible for the
 * exclusivity flip; create + update never touch `isActive` so admins can't
 * accidentally publish drafts.
 */
export const HeroCreateSchema = z
  .object({
    kind: z.enum(['IMAGE', 'VIDEO']).default('IMAGE'),
    imageUrl: z.string().url(),
    videoUrl: z.string().url().optional(),
    mobileImageUrl: z.string().url().optional(),
    mobileVideoUrl: z.string().url().optional(),
    eyebrow: z.string().min(1).max(120),
    ctaLabel: z.string().min(1).max(60),
    ctaHref: z.string().min(1).max(500),
    scheduledFor: z.coerce.date().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.kind === 'VIDEO' && !data.videoUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['videoUrl'],
        message: 'videoUrl is required when kind is VIDEO',
      });
    }
  });

export const HeroUpdateSchema = z
  .object({
    kind: z.enum(['IMAGE', 'VIDEO']).optional(),
    imageUrl: z.string().url().optional(),
    videoUrl: z.string().url().nullable().optional(),
    mobileImageUrl: z.string().url().nullable().optional(),
    mobileVideoUrl: z.string().url().nullable().optional(),
    eyebrow: z.string().min(1).max(120).optional(),
    ctaLabel: z.string().min(1).max(60).optional(),
    ctaHref: z.string().min(1).max(500).optional(),
    scheduledFor: z.coerce.date().nullable().optional(),
  });

export type HeroCreateInput = z.infer<typeof HeroCreateSchema>;
export type HeroUpdateInput = z.infer<typeof HeroUpdateSchema>;
