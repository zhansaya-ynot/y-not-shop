import * as React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/server/db/client';
import { CategoryEditForm } from './_components/category-edit-form';

export const dynamic = 'force-dynamic';

interface Ctx {
  params: Promise<{ id: string }>;
}

export default async function AdminCategoryEditPage({
  params,
}: Ctx): Promise<React.ReactElement> {
  const { id } = await params;
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category || category.deletedAt) notFound();

  return (
    <div className="max-w-2xl">
      <div className="mb-6 text-sm">
        <Link href="/admin/catalog/categories" className="text-neutral-600 underline">
          ← Back to categories
        </Link>
      </div>
      <h2 className="text-2xl font-semibold mb-6">{category.name}</h2>
      <CategoryEditForm
        categoryId={category.id}
        initial={{
          name: category.name,
          slug: category.slug,
          description: category.description,
          bannerImage: category.bannerImage,
        }}
      />
    </div>
  );
}
