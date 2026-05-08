import { z } from 'zod';
import { cache } from 'react';
import { prisma } from '@/server/db/client';

/**
 * Footer content stored in `SitePolicy.footerJson`. The schema lives
 * separately from page-extras so admin/content/settings can lean on it
 * without dragging in unrelated page-specific schemas.
 */

export const FooterLinkSchema = z.object({
  label: z.string().max(120).default(''),
  href: z.string().max(400).default(''),
});

export const FooterColumnSchema = z.object({
  title: z.string().max(120).default(''),
  links: z.array(FooterLinkSchema).max(20).default([]),
});

export const FooterContentSchema = z.object({
  columns: z.array(FooterColumnSchema).max(8).default([]),
  /** Instagram (or other social) URL — stored as full https URL. Empty = hide the icon. */
  instagramUrl: z.string().max(400).default(''),
  copyright: z
    .string()
    .max(400)
    .default('© {year} YNOT London. All rights reserved.'),
  tagline: z.string().max(400).default('Designed in London · Made in London & Istanbul'),
});

export type FooterLink = z.infer<typeof FooterLinkSchema>;
export type FooterColumn = z.infer<typeof FooterColumnSchema>;
export type FooterContent = z.infer<typeof FooterContentSchema>;

export const FOOTER_FALLBACK: FooterContent = {
  columns: [
    {
      title: 'About',
      links: [
        { label: 'Our Story', href: '/our-story' },
        { label: 'Contact', href: '/contact' },
      ],
    },
    {
      title: 'Customer Care',
      links: [
        { label: 'Shipping and Returns', href: '/shipping-returns' },
        { label: 'Initiate a Return', href: '/initiate-return' },
        { label: 'Privacy Policy', href: '/privacy' },
      ],
    },
    {
      title: 'Product',
      links: [
        { label: 'Product Care', href: '/product-care' },
        { label: 'General Sizing', href: '/sizing' },
        { label: 'Sustainability', href: '/sustainability' },
      ],
    },
  ],
  instagramUrl: 'https://instagram.com/ynotlondon',
  copyright: '© {year} YNOT London. All rights reserved.',
  tagline: 'Designed in London · Made in London & Istanbul',
};

export function parseFooterContent(raw: unknown): FooterContent {
  if (!raw || typeof raw !== 'object') return FOOTER_FALLBACK;
  const result = FooterContentSchema.safeParse(raw);
  return result.success ? result.data : FOOTER_FALLBACK;
}

/**
 * Server-side getter cached per-request via React.cache so multiple
 * <SiteFooter /> renders in the same request only hit the DB once.
 * `force-dynamic` pages still re-fetch on every request, which is fine
 * — operator footer edits land within ~1 page load.
 */
export const getFooterContent = cache(async (): Promise<FooterContent> => {
  const policy = await prisma.sitePolicy.findUnique({
    where: { id: 'singleton' },
    select: { footerJson: true },
  });
  return parseFooterContent(policy?.footerJson ?? null);
});
