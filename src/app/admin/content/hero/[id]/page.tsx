import * as React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/server/db/client';
import { HeroEditForm } from './_components/hero-edit-form';
import { ActivateButton } from '../_components/activate-button';

export const dynamic = 'force-dynamic';

interface Ctx {
  params: Promise<{ id: string }>;
}

export default async function AdminHeroDetailPage({
  params,
}: Ctx): Promise<React.ReactElement> {
  const { id } = await params;
  const hero = await prisma.heroBlock.findUnique({ where: { id } });
  if (!hero) notFound();

  return (
    <div className="max-w-2xl">
      <div className="mb-6 text-sm">
        <Link href="/admin/content/hero" className="text-neutral-600 underline">
          ← Back to hero blocks
        </Link>
      </div>

      <header className="flex items-start justify-between mb-8 pb-6 border-b border-neutral-200">
        <div>
          <h2 className="text-2xl font-semibold mb-2">Edit hero block</h2>
          <div className="text-xs font-mono text-neutral-600">{hero.id}</div>
        </div>
        {hero.isActive ? (
          <span className="inline-block px-2 py-0.5 text-xs rounded border bg-green-100 text-green-800 border-green-200">
            Active
          </span>
        ) : (
          <ActivateButton id={hero.id} />
        )}
      </header>

      <HeroEditForm
        id={hero.id}
        initial={{
          kind: hero.kind,
          imageUrl: hero.imageUrl,
          mobileImageUrl: hero.mobileImageUrl,
          videoUrl: hero.videoUrl,
          mobileVideoUrl: hero.mobileVideoUrl,
          eyebrow: hero.eyebrow,
          ctaLabel: hero.ctaLabel,
          ctaHref: hero.ctaHref,
        }}
      />
    </div>
  );
}
