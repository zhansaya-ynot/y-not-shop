import * as React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/server/db/client';
import { CategoryEditForm } from './_components/category-edit-form';

export const dynamic = 'force-dynamic';

interface Ctx {
  params: Promise<{ id: string }>;
}

interface OptionRow {
  id: string;
  name: string;
  parentId: string | null;
  depth: number;
}

/**
 * Builds a depth-tagged select list (root first, children indented under
 * their parent) AND collects the set of ids that are illegal as a parent
 * for `selfId` — namely `selfId` itself plus every descendant. The form
 * uses the illegal set to render an inline warning before the user even
 * submits.
 */
function buildOptionsAndIllegal(
  cats: { id: string; name: string; parentId: string | null }[],
  selfId: string,
): { options: OptionRow[]; illegal: Set<string> } {
  const childrenByParent = new Map<string | null, { id: string; name: string }[]>();
  for (const c of cats) {
    const list = childrenByParent.get(c.parentId) ?? [];
    list.push({ id: c.id, name: c.name });
    childrenByParent.set(c.parentId, list);
  }

  const options: OptionRow[] = [];
  function walk(parentId: string | null, depth: number): void {
    const kids = childrenByParent.get(parentId) ?? [];
    for (const k of kids) {
      options.push({ id: k.id, name: k.name, parentId, depth });
      walk(k.id, depth + 1);
    }
  }
  walk(null, 0);

  const illegal = new Set<string>([selfId]);
  function collectDescendants(id: string): void {
    for (const k of childrenByParent.get(id) ?? []) {
      if (illegal.has(k.id)) continue;
      illegal.add(k.id);
      collectDescendants(k.id);
    }
  }
  collectDescendants(selfId);

  return { options, illegal };
}

export default async function AdminCategoryEditPage({
  params,
}: Ctx): Promise<React.ReactElement> {
  const { id } = await params;
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category || category.deletedAt) notFound();

  const cats = await prisma.category.findMany({
    where: { deletedAt: null },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, parentId: true },
  });
  const { options, illegal } = buildOptionsAndIllegal(cats, id);

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
          parentId: category.parentId,
          bannerImage: category.bannerImage,
        }}
        parentOptions={options}
        illegalParentIds={Array.from(illegal)}
      />
    </div>
  );
}
