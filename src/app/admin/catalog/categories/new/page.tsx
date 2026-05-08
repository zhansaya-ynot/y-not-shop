import * as React from 'react';
import Link from 'next/link';
import { CategoryCreateForm } from './_components/category-create-form';

export const dynamic = 'force-dynamic';

export default function AdminCategoryNewPage(): React.ReactElement {
  return (
    <div className="max-w-2xl">
      <div className="mb-6 text-sm">
        <Link href="/admin/catalog/categories" className="text-neutral-600 underline">
          ← Back to categories
        </Link>
      </div>
      <h2 className="text-2xl font-semibold mb-6">New category</h2>
      <CategoryCreateForm />
    </div>
  );
}
