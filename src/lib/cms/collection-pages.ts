import { z } from 'zod';
import { cache } from 'react';
import type { HomeCollection } from '@prisma/client';
import { prisma } from '@/server/db/client';

/**
 * The three homepage collection landing pages. Each maps 1:1 to a
 * Product.homeCollection enum value and has its own editable title +
 * intro copy stored on SitePolicy.collectionPagesJson.
 */
export const COLLECTION_SLUGS = ['new-collection', 'timeless', 'new-arrivals'] as const;
export type CollectionSlug = (typeof COLLECTION_SLUGS)[number];

/** URL slug → Prisma HomeCollection enum value. */
export const SLUG_TO_COLLECTION: Record<CollectionSlug, HomeCollection> = {
  'new-collection': 'NEW_COLLECTION',
  timeless: 'TIMELESS',
  'new-arrivals': 'NEW_ARRIVALS',
};

export function isCollectionSlug(value: string): value is CollectionSlug {
  return (COLLECTION_SLUGS as readonly string[]).includes(value);
}

const CollectionPageSchema = z.object({
  title: z.string().max(120).default(''),
  intro: z.string().max(600).default(''),
});

export const CollectionPagesSchema = z.object({
  'new-collection': CollectionPageSchema,
  timeless: CollectionPageSchema,
  'new-arrivals': CollectionPageSchema,
});

export type CollectionPageContent = z.infer<typeof CollectionPageSchema>;
export type CollectionPagesContent = z.infer<typeof CollectionPagesSchema>;

export const COLLECTION_PAGES_FALLBACK: CollectionPagesContent = {
  'new-collection': {
    title: 'New Collection',
    intro: 'The latest pieces from the YNOT atelier — designed in London, made to last.',
  },
  timeless: {
    title: 'Timeless',
    intro: 'Signature silhouettes that anchor the wardrobe, season after season.',
  },
  'new-arrivals': {
    title: 'New Arrivals',
    intro: 'Just landed — the freshest additions to the collection.',
  },
};

export function parseCollectionPages(raw: unknown): CollectionPagesContent {
  if (!raw || typeof raw !== 'object') return COLLECTION_PAGES_FALLBACK;
  const result = CollectionPagesSchema.safeParse(raw);
  return result.success ? result.data : COLLECTION_PAGES_FALLBACK;
}

/**
 * Server-side getter, request-deduplicated via React.cache. Returns the
 * full set; callers pick the slug they need.
 */
export const getCollectionPages = cache(async (): Promise<CollectionPagesContent> => {
  const policy = await prisma.sitePolicy.findUnique({
    where: { id: 'singleton' },
    select: { collectionPagesJson: true },
  });
  return parseCollectionPages(policy?.collectionPagesJson ?? null);
});
