import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/server/db/client';

export const dynamic = 'force-dynamic';

interface Ctx {
  params: Promise<{ slug: string }>;
}

/**
 * Stable redirect for the sidebar — `/admin/content/pages/by-slug/our-story`
 * resolves to the cuid-based detail route. Lets nav-sections.ts hard-code
 * slug-based links without knowing every page's database id.
 *
 * 404s if the slug doesn't exist yet so a typo in nav-sections fails
 * loudly instead of silently redirecting somewhere unexpected.
 */
export default async function ResolvePageBySlug({ params }: Ctx): Promise<never> {
  const { slug } = await params;
  const page = await prisma.staticPage.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!page) notFound();
  redirect(`/admin/content/pages/${page.id}`);
}
