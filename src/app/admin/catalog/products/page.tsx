import * as React from 'react';
import Link from 'next/link';
import type { ProductStatus, Prisma } from '@prisma/client';
import { prisma } from '@/server/db/client';

export const dynamic = 'force-dynamic';

const STATUSES: ProductStatus[] = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];
const PAGE_SIZE = 24;

interface SP {
  searchParams: Promise<{
    status?: string;
    search?: string;
    page?: string;
  }>;
}

const STATUS_BADGE: Record<ProductStatus, string> = {
  DRAFT: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  PUBLISHED: 'bg-green-100 text-green-800 border-green-200',
  ARCHIVED: 'bg-neutral-200 text-neutral-700 border-neutral-300',
};

export default async function AdminProductsPage({ searchParams }: SP): Promise<React.ReactElement> {
  const sp = await searchParams;
  const statusFilter = STATUSES.includes(sp.status as ProductStatus)
    ? (sp.status as ProductStatus)
    : sp.status === 'all'
      ? undefined
      : undefined;
  const search = sp.search?.trim() || undefined;

  const where: Prisma.ProductWhereInput = {};
  if (statusFilter) where.status = statusFilter;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { slug: { contains: search, mode: 'insensitive' } },
    ];
  }

  const total = await prisma.product.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // Clamp the requested page into [1, totalPages] so a stale/hand-edited
  // ?page= can't render an empty list past the end.
  const requestedPage = Number.parseInt(sp.page ?? '1', 10);
  const page = Math.min(
    Math.max(1, Number.isNaN(requestedPage) ? 1 : requestedPage),
    totalPages,
  );

  const products = await prisma.product.findMany({
    where,
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    orderBy: { updatedAt: 'desc' },
    include: { images: { take: 1, orderBy: { sortOrder: 'asc' } } },
  });

  // Preserve the active status/search filters when moving between pages.
  function pageHref(p: number): string {
    const params = new URLSearchParams();
    if (sp.status) params.set('status', sp.status);
    if (search) params.set('search', search);
    if (p > 1) params.set('page', String(p));
    const qs = params.toString();
    return qs ? `/admin/catalog/products?${qs}` : '/admin/catalog/products';
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold">Products</h2>
        <Link
          href="/admin/catalog/products/new"
          className="px-4 py-2 bg-neutral-900 text-white text-xs uppercase tracking-wider rounded"
        >
          New product
        </Link>
      </div>

      <form method="get" className="flex flex-wrap gap-3 mb-4 items-end text-sm">
        <label className="flex flex-col">
          <span className="text-xs text-neutral-600 mb-1">Status</span>
          <select
            name="status"
            defaultValue={sp.status ?? ''}
            className="border border-neutral-300 rounded px-2 py-1 bg-white"
          >
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col flex-1 min-w-48">
          <span className="text-xs text-neutral-600 mb-1">Search</span>
          <input
            name="search"
            defaultValue={search ?? ''}
            placeholder="Name or slug"
            className="border border-neutral-300 rounded px-2 py-1 bg-white"
          />
        </label>
        <button
          type="submit"
          className="h-[34px] px-4 bg-neutral-900 text-white text-xs uppercase tracking-wider rounded"
        >
          Filter
        </button>
      </form>

      <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-600 text-xs uppercase">
            <tr>
              <th className="text-left px-3 py-2 w-16">Image</th>
              <th className="text-left px-3 py-2">Name</th>
              <th className="text-left px-3 py-2">Slug</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-right px-3 py-2">Price</th>
              <th className="text-left px-3 py-2">Updated</th>
              <th className="text-right px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-neutral-500">
                  No products match these filters.
                </td>
              </tr>
            )}
            {products.map((p) => (
              <tr key={p.id} className="border-t border-neutral-100 hover:bg-neutral-50">
                <td className="px-3 py-2">
                  {p.images[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.images[0].url}
                      alt={p.images[0].alt ?? ''}
                      className="w-12 h-12 object-cover rounded"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-neutral-100 rounded" aria-hidden />
                  )}
                </td>
                <td className="px-3 py-2 font-medium">{p.name}</td>
                <td className="px-3 py-2 font-mono text-xs text-neutral-600">{p.slug}</td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-block px-2 py-0.5 text-xs rounded border ${STATUS_BADGE[p.status]}`}
                  >
                    {p.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">£{(p.priceCents / 100).toFixed(2)}</td>
                <td className="px-3 py-2 text-xs text-neutral-600">
                  {new Date(p.updatedAt).toISOString().slice(0, 16).replace('T', ' ')}
                </td>
                <td className="px-3 py-2 text-right">
                  <Link
                    href={`/admin/catalog/products/${p.id}`}
                    className="text-neutral-900 underline text-xs"
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-neutral-600">
          {total === 0
            ? 'No products'
            : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total}`}
        </span>
        <div className="flex items-center gap-2">
          {page > 1 ? (
            <Link
              href={pageHref(page - 1)}
              className="px-3 py-1.5 rounded border border-neutral-300 bg-white hover:bg-neutral-50"
            >
              ← Prev
            </Link>
          ) : (
            <span className="px-3 py-1.5 rounded border border-neutral-200 text-neutral-300">
              ← Prev
            </span>
          )}
          <span className="text-neutral-600">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={pageHref(page + 1)}
              className="px-3 py-1.5 rounded border border-neutral-300 bg-white hover:bg-neutral-50"
            >
              Next →
            </Link>
          ) : (
            <span className="px-3 py-1.5 rounded border border-neutral-200 text-neutral-300">
              Next →
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
