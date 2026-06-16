import * as React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/server/db/client';
import { ProductDetailsForm } from './_components/product-details-form';
import { StatusActions } from './_components/status-actions';
import { ImageUploader } from './_components/image-uploader';
import { ImageGridReorder } from './_components/image-grid-reorder';
import { StockEditor } from './_components/stock-editor';
import { ColourEditor } from './_components/colour-editor';
import { CategoryMultiselect } from './_components/category-multiselect';
import { RelatedProductsPicker } from './_components/related-products-picker';

export const dynamic = 'force-dynamic';

interface Ctx {
  params: Promise<{ id: string }>;
}

const STATUS_BADGE = {
  DRAFT: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  PUBLISHED: 'bg-green-100 text-green-800 border-green-200',
  ARCHIVED: 'bg-neutral-200 text-neutral-700 border-neutral-300',
} as const;

export default async function AdminProductDetailPage({
  params,
}: Ctx): Promise<React.ReactElement> {
  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      images: { orderBy: { sortOrder: 'asc' } },
      sizes: true,
      colours: { orderBy: { sortOrder: 'asc' } },
      categories: { include: { category: true } },
      relatedProducts: { orderBy: { sortOrder: 'asc' } },
    },
  });
  if (!product) notFound();

  const allCategories = await prisma.category.findMany({
    where: { deletedAt: null },
    orderBy: [{ parentId: 'asc' }, { sortOrder: 'asc' }],
    select: { id: true, name: true, slug: true, parentId: true },
  });

  // Every other product is a candidate for the "Complete the look" picker.
  const relatedRows = await prisma.product.findMany({
    where: { deletedAt: null, id: { not: id } },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      images: { orderBy: { sortOrder: 'asc' }, take: 1, select: { url: true } },
    },
  });
  const relatedOptions = relatedRows.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    // Only PUBLISHED products appear in the storefront "Complete the look"
    // section, so the picker flags everything else — otherwise an operator
    // picks 5 and sees only the published ones render.
    published: p.status === 'PUBLISHED',
    image: p.images[0]?.url ?? null,
  }));

  return (
    <div className="max-w-4xl">
      <div className="mb-6 text-sm">
        <Link href="/admin/catalog/products" className="text-neutral-600 underline">
          ← Back to products
        </Link>
      </div>

      <header className="flex items-start justify-between mb-8 pb-6 border-b border-neutral-200">
        <div>
          <h2 className="text-2xl font-semibold mb-2">{product.name}</h2>
          <div className="flex items-center gap-3 text-sm">
            <span className="font-mono text-xs text-neutral-600">{product.slug}</span>
            <span
              className={`inline-block px-2 py-0.5 text-xs rounded border ${STATUS_BADGE[product.status]}`}
            >
              {product.status}
            </span>
          </div>
        </div>
        <StatusActions
          productId={product.id}
          productName={product.name}
          status={product.status}
        />
      </header>

      <section className="mb-10">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-700 mb-4">
          Images
        </h3>
        <ImageUploader productId={product.id} />
        <ImageGridReorder
          productId={product.id}
          images={product.images.map((i) => ({
            id: i.id,
            url: i.url,
            alt: i.alt,
            sortOrder: i.sortOrder,
            colour: i.colour,
          }))}
          colours={product.colours.map((c) => c.name)}
        />
      </section>

      <section className="mb-10">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-700 mb-4">
          Details
        </h3>
        <ProductDetailsForm
          productId={product.id}
          initial={{
            name: product.name,
            slug: product.slug,
            description: product.description,
            priceCents: product.priceCents,
            materials: product.materials,
            care: product.care,
            sizing: product.sizing,
            weightGrams: product.weightGrams,
            hsCode: product.hsCode,
            countryOfOriginCode: product.countryOfOriginCode,
            preOrder: product.preOrder,
            isOneSize: product.isOneSize,
            sizeGuideImage: product.sizeGuideImage,
            homeCollections: product.homeCollections,
          }}
        />
      </section>

      <section className="mb-10">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-700 mb-4">
          Stock
        </h3>
        <StockEditor
          productId={product.id}
          initial={product.sizes.map((s) => ({ size: s.size, stock: s.stock }))}
          isOneSize={product.isOneSize}
        />
      </section>

      <section className="mb-10">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-700 mb-4">
          Colours
        </h3>
        <ColourEditor
          productId={product.id}
          initial={product.colours.map((c) => ({ name: c.name, hex: c.hex }))}
        />
      </section>

      <section className="mb-10">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-700 mb-4">
          Categories
        </h3>
        <CategoryMultiselect
          productId={product.id}
          categories={allCategories}
          selectedIds={product.categories.map((pc) => pc.categoryId)}
        />
      </section>

      <section className="mb-10">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-700 mb-1">
          Complete the look
        </h3>
        <p className="text-xs text-neutral-500 mb-4">
          Up to 5 products suggested on this product&apos;s page. Leave empty
          to fall back to automatic recommendations.
        </p>
        <RelatedProductsPicker
          productId={product.id}
          options={relatedOptions}
          selectedIds={product.relatedProducts.map((r) => r.relatedId)}
        />
      </section>
    </div>
  );
}
