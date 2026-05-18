import * as React from 'react';
import { prisma } from '@/server/db/client';
import {
  parseCollectionPages,
  COLLECTION_PAGES_FALLBACK,
} from '@/lib/cms/collection-pages';
import { CollectionPagesForm } from './_components/collection-pages-form';

export const dynamic = 'force-dynamic';

export default async function AdminCollectionPagesPage(): Promise<React.ReactElement> {
  const policy = await prisma.sitePolicy.findUnique({
    where: { id: 'singleton' },
    select: { collectionPagesJson: true },
  });
  const initial = policy?.collectionPagesJson
    ? parseCollectionPages(policy.collectionPagesJson)
    : COLLECTION_PAGES_FALLBACK;

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-semibold mb-2">Collection pages</h2>
      <p className="text-sm text-neutral-600 mb-6">
        Title and intro text for the three collection landing pages. Which
        products show on each page is set per-product under Catalog →
        Products → <em>Homepage collection</em>.
      </p>
      <CollectionPagesForm initial={initial} />
    </div>
  );
}
