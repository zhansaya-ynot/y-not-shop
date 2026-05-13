import { z } from 'zod';
import { cache } from 'react';
import { prisma } from '@/server/db/client';

/**
 * 'Timeless Collection' editorial block on the homepage. Stored as a
 * single JSON blob on the SitePolicy singleton so the operator edits
 * everything in one form. Validates defensively at read time and falls
 * back to bundled copy if the JSON is missing/malformed.
 */

export const HomeEditorialContentSchema = z.object({
  title: z.string().max(120).default(''),
  body: z.string().max(600).default(''),
  imageUrl: z.string().max(800).default(''),
  ctaHref: z.string().max(400).default(''),
  ctaLabel: z.string().max(60).default(''),
});

export type HomeEditorialContent = z.infer<typeof HomeEditorialContentSchema>;

export const HOME_EDITORIAL_FALLBACK: HomeEditorialContent = {
  title: 'Timeless Collection',
  body: 'Signature silhouettes that anchor the collection, crafted with ease and refinement for continual wear.',
  imageUrl: '/cms/timeless.jpg',
  ctaHref: '/collection/jackets',
  ctaLabel: 'Explore',
};

export function parseHomeEditorial(raw: unknown): HomeEditorialContent {
  if (!raw || typeof raw !== 'object') return HOME_EDITORIAL_FALLBACK;
  const result = HomeEditorialContentSchema.safeParse(raw);
  return result.success ? result.data : HOME_EDITORIAL_FALLBACK;
}

/**
 * Server-side getter cached per-request via React.cache. Single query
 * even if the homepage renders multiple components needing this content.
 */
export const getHomeEditorial = cache(async (): Promise<HomeEditorialContent> => {
  const policy = await prisma.sitePolicy.findUnique({
    where: { id: 'singleton' },
    select: { homeEditorialJson: true },
  });
  return parseHomeEditorial(policy?.homeEditorialJson ?? null);
});
