import { prisma } from '@/server/db/client';
import { withAudit } from '../audit';
import { ensureUniqueSlug } from './slug-service';
import { slugify } from '@/lib/slug';
import { assertProductTransition } from './product-status';
import type { ProductStatus } from '@prisma/client';
import type {
  ProductCreateInput,
  ProductUpdateInput,
  ProductSizesUpdateInput,
  ProductColoursUpdateInput,
} from '@/lib/schemas/admin-product';

export interface CreateProductOptions {
  input: ProductCreateInput;
  actorId: string;
  ip?: string;
  ua?: string;
}

export async function createProduct(opts: CreateProductOptions) {
  const { input, actorId, ip, ua } = opts;
  const baseSlug = input.slug ?? slugify(input.name);
  const slug = await ensureUniqueSlug('product', baseSlug);

  return withAudit(
    {
      actorId,
      entityType: 'product',
      entityId: 'pending',
      action: 'product.create',
      ip,
      ua,
    },
    async () => {
      const product = await prisma.product.create({
        data: {
          name: input.name,
          slug,
          description: input.description,
          priceCents: input.priceCents,
          materials: input.materials ?? '',
          care: input.care ?? '',
          sizing: input.sizing ?? '',
          weightGrams: input.weightGrams,
          hsCode: input.hsCode,
          countryOfOriginCode: input.countryOfOriginCode,
          preOrder: input.preOrder,
          isOneSize: input.isOneSize,
          sizeGuideImage: input.sizeGuideImage,
          status: 'DRAFT',
        },
      });
      return product;
    },
  );
}

export interface UpdateProductOptions {
  id: string;
  input: ProductUpdateInput;
  actorId: string;
  ip?: string;
  ua?: string;
}

export async function updateProduct(opts: UpdateProductOptions) {
  const { id, input, actorId, ip, ua } = opts;
  const before = await prisma.product.findUnique({ where: { id } });
  if (!before) throw new Error(`Product ${id} not found`);
  // If slug explicitly given and changed, validate uniqueness; otherwise leave as-is.
  let slug = before.slug;
  if (input.slug && input.slug !== before.slug) {
    slug = await ensureUniqueSlug('product', input.slug, id);
  }

  return withAudit(
    { actorId, entityType: 'product', entityId: id, action: 'product.update', before, ip, ua },
    async () =>
      prisma.$transaction(async (tx) => {
        const updated = await tx.product.update({
          where: { id },
          data: {
            name: input.name,
            slug,
            description: input.description,
            priceCents: input.priceCents,
            materials: input.materials,
            care: input.care,
            sizing: input.sizing,
            weightGrams: input.weightGrams,
            hsCode: input.hsCode,
            countryOfOriginCode: input.countryOfOriginCode,
            preOrder: input.preOrder,
            isOneSize: input.isOneSize,
            sizeGuideImage: input.sizeGuideImage,
          },
        });
        // Re-link categories when explicitly provided. We treat undefined as
        // "no change" and an empty array as "remove all" — caller's intent
        // must be unambiguous.
        if (input.categoryIds !== undefined) {
          await tx.productCategory.deleteMany({ where: { productId: id } });
          if (input.categoryIds.length > 0) {
            await tx.productCategory.createMany({
              data: input.categoryIds.map((categoryId) => ({
                productId: id,
                categoryId,
              })),
            });
          }
        }
        return updated;
      }),
  );
}

export interface ChangeProductStatusOptions {
  id: string;
  to: ProductStatus;
  actorId: string;
  ip?: string;
  ua?: string;
}

export async function changeProductStatus(opts: ChangeProductStatusOptions) {
  const { id, to, actorId, ip, ua } = opts;
  const before = await prisma.product.findUnique({ where: { id } });
  if (!before) throw new Error(`Product ${id} not found`);
  assertProductTransition(before.status, to);

  const action =
    to === 'PUBLISHED'
      ? 'product.publish'
      : to === 'ARCHIVED'
        ? 'product.archive'
        : 'product.unpublish';

  return withAudit(
    { actorId, entityType: 'product', entityId: id, action, before, ip, ua },
    async () =>
      prisma.product.update({
        where: { id },
        data: {
          status: to,
          publishedAt:
            to === 'PUBLISHED' && before.publishedAt === null
              ? new Date()
              : before.publishedAt,
        },
      }),
  );
}

export interface SetProductSizesOptions {
  productId: string;
  sizes: ProductSizesUpdateInput['sizes'];
  actorId: string;
  ip?: string;
  ua?: string;
}

export async function setProductSizes(opts: SetProductSizesOptions) {
  const { productId, sizes, actorId, ip, ua } = opts;
  const before = await prisma.productSize.findMany({ where: { productId } });
  return withAudit(
    {
      actorId,
      entityType: 'product',
      entityId: productId,
      action: 'product.stock.update',
      before,
      ip,
      ua,
    },
    async () => {
      for (const s of sizes) {
        await prisma.productSize.upsert({
          where: { productId_size: { productId, size: s.size } },
          create: { productId, size: s.size, stock: s.stock },
          update: { stock: s.stock },
        });
      }
      return prisma.productSize.findMany({ where: { productId } });
    },
  );
}

export interface SetProductColoursOptions {
  productId: string;
  colours: ProductColoursUpdateInput['colours'];
  actorId: string;
  ip?: string;
  ua?: string;
}

export async function setProductColours(opts: SetProductColoursOptions) {
  const { productId, colours, actorId, ip, ua } = opts;
  const before = await prisma.colourOption.findMany({ where: { productId } });
  return withAudit(
    {
      actorId,
      entityType: 'product',
      entityId: productId,
      action: 'product.colours.update',
      before,
      ip,
      ua,
    },
    async () =>
      prisma.$transaction(async (tx) => {
        await tx.colourOption.deleteMany({ where: { productId } });
        if (colours.length > 0) {
          await tx.colourOption.createMany({
            data: colours.map((c, i) => ({
              productId,
              name: c.name,
              hex: c.hex,
              sortOrder: i,
            })),
          });
        }
        return tx.colourOption.findMany({ where: { productId } });
      }),
  );
}

export interface AddProductImagesOptions {
  productId: string;
  items: Array<{ url: string; alt?: string }>;
  actorId: string;
  ip?: string;
  ua?: string;
}

export async function addProductImages(opts: AddProductImagesOptions) {
  const { productId, items, actorId, ip, ua } = opts;
  return withAudit(
    {
      actorId,
      entityType: 'product',
      entityId: productId,
      action: 'product.images.add',
      ip,
      ua,
    },
    async () =>
      prisma.$transaction(async (tx) => {
        const max = await tx.productImage.aggregate({
          where: { productId },
          _max: { sortOrder: true },
        });
        const start =
          max._max.sortOrder !== null && max._max.sortOrder !== undefined
            ? max._max.sortOrder + 1
            : 0;
        const created: Awaited<ReturnType<typeof tx.productImage.create>>[] = [];
        for (let i = 0; i < items.length; i++) {
          const img = await tx.productImage.create({
            data: {
              productId,
              url: items[i].url,
              alt: items[i].alt ?? '',
              sortOrder: start + i,
            },
          });
          created.push(img);
        }
        return created;
      }),
  );
}

export interface RemoveProductImageOptions {
  productId: string;
  imageId: string;
  actorId: string;
  ip?: string;
  ua?: string;
}

export async function removeProductImage(opts: RemoveProductImageOptions) {
  const { productId, imageId, actorId, ip, ua } = opts;
  const before = await prisma.productImage.findUnique({ where: { id: imageId } });
  if (!before || before.productId !== productId) {
    throw new Error('Image not found on product');
  }
  return withAudit(
    {
      actorId,
      entityType: 'product',
      entityId: productId,
      action: 'product.images.delete',
      before,
      ip,
      ua,
    },
    async () => prisma.productImage.delete({ where: { id: imageId } }),
  );
}

export interface ReorderProductImagesOptions {
  productId: string;
  order: string[];
  actorId: string;
  ip?: string;
  ua?: string;
}

export async function reorderProductImages(opts: ReorderProductImagesOptions) {
  const { productId, order, actorId, ip, ua } = opts;
  return withAudit(
    {
      actorId,
      entityType: 'product',
      entityId: productId,
      action: 'product.images.reorder',
      ip,
      ua,
    },
    async () =>
      prisma.$transaction(async (tx) => {
        for (let i = 0; i < order.length; i++) {
          await tx.productImage.update({ where: { id: order[i] }, data: { sortOrder: i } });
        }
        return tx.productImage.findMany({
          where: { productId },
          orderBy: { sortOrder: 'asc' },
        });
      }),
  );
}
