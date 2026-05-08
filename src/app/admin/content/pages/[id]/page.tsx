import * as React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/server/db/client';
import { MarkdownEditor } from './_components/markdown-editor';

export const dynamic = 'force-dynamic';

interface Ctx {
  params: Promise<{ id: string }>;
}

export default async function AdminStaticPageDetailPage({
  params,
}: Ctx): Promise<React.ReactElement> {
  const { id } = await params;
  const page = await prisma.staticPage.findUnique({ where: { id } });
  if (!page) notFound();

  return (
    <div className="max-w-6xl">
      <div className="mb-6 text-sm">
        <Link href="/admin/content/pages" className="text-neutral-600 underline">
          ← Back to pages
        </Link>
      </div>
      <h2 className="text-2xl font-semibold mb-6">Edit page</h2>
      <MarkdownEditor
        id={page.id}
        initial={{
          title: page.title,
          slug: page.slug,
          bodyMarkdown: page.bodyMarkdown,
          metaTitle: page.metaTitle,
          metaDescription: page.metaDescription,
          heroImage: page.heroImage,
        }}
      />
    </div>
  );
}
