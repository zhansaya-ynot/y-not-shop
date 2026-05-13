import * as React from 'react';
import { prisma } from '@/server/db/client';
import { parseHomeEditorial, HOME_EDITORIAL_FALLBACK } from '@/lib/cms/home-editorial';
import { EditorialForm } from './_components/editorial-form';

export const dynamic = 'force-dynamic';

export default async function AdminHomeEditorialPage(): Promise<React.ReactElement> {
  const policy = await prisma.sitePolicy.findUnique({
    where: { id: 'singleton' },
    select: { homeEditorialJson: true },
  });
  const initial = policy?.homeEditorialJson
    ? parseHomeEditorial(policy.homeEditorialJson)
    : HOME_EDITORIAL_FALLBACK;

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-semibold mb-2">Home — Timeless block</h2>
      <p className="text-sm text-neutral-600 mb-6">
        Full-width editorial section under Browse Collections on the homepage.
        Sets the title, supporting text, background image and CTA button.
      </p>
      <EditorialForm initial={initial} />
    </div>
  );
}
