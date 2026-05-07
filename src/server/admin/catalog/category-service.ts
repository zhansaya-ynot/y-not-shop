import { prisma } from '@/server/db/client';
import { withAudit } from '../audit';
import { ensureUniqueSlug } from './slug-service';
import { slugify } from '@/lib/slug';
import type { CategoryCreateInput, CategoryUpdateInput } from '@/lib/schemas/admin-category';

export interface CreateCategoryOptions {
  input: CategoryCreateInput;
  actorId: string;
  ip?: string;
  ua?: string;
}

export async function createCategory(opts: CreateCategoryOptions) {
  const { input, actorId, ip, ua } = opts;
  const baseSlug = input.slug ?? slugify(input.name);
  const slug = await ensureUniqueSlug('category', baseSlug);

  return withAudit(
    {
      actorId,
      entityType: 'category',
      entityId: 'pending',
      action: 'category.create',
      ip,
      ua,
    },
    async () =>
      prisma.category.create({
        data: {
          name: input.name,
          slug,
          description: input.description ?? '',
          parentId: input.parentId ?? null,
          bannerImage: input.bannerImage ?? null,
        },
      }),
  );
}

export interface UpdateCategoryOptions {
  id: string;
  input: CategoryUpdateInput;
  actorId: string;
  ip?: string;
  ua?: string;
}

/**
 * Updates editable fields. If the caller supplies a `parentId` that differs
 * from the current value, the change is routed through the cycle-prevention
 * check just like an explicit `moveCategory` call so admins can't sneak a
 * cycle in through the back door.
 */
export async function updateCategory(opts: UpdateCategoryOptions) {
  const { id, input, actorId, ip, ua } = opts;
  const before = await prisma.category.findUnique({ where: { id } });
  if (!before) throw new Error(`Category ${id} not found`);

  const parentChanged =
    input.parentId !== undefined && (input.parentId ?? null) !== before.parentId;
  if (parentChanged) {
    await assertNoCycle(id, input.parentId ?? null);
  }

  let slug = before.slug;
  if (input.slug && input.slug !== before.slug) {
    slug = await ensureUniqueSlug('category', input.slug, id);
  }

  return withAudit(
    { actorId, entityType: 'category', entityId: id, action: 'category.update', before, ip, ua },
    async () =>
      prisma.category.update({
        where: { id },
        data: {
          name: input.name,
          slug,
          description: input.description,
          // parentId is only mutated when explicitly provided so that
          // `partial()` callers don't accidentally flatten the tree.
          ...(input.parentId !== undefined ? { parentId: input.parentId ?? null } : {}),
          ...(input.bannerImage !== undefined ? { bannerImage: input.bannerImage } : {}),
        },
      }),
  );
}

export interface ArchiveCategoryOptions {
  id: string;
  actorId: string;
  ip?: string;
  ua?: string;
}

export async function archiveCategory(opts: ArchiveCategoryOptions) {
  const { id, actorId, ip, ua } = opts;
  const before = await prisma.category.findUnique({ where: { id } });
  if (!before) throw new Error(`Category ${id} not found`);

  return withAudit(
    { actorId, entityType: 'category', entityId: id, action: 'category.archive', before, ip, ua },
    async () =>
      prisma.category.update({
        where: { id },
        data: { deletedAt: new Date() },
      }),
  );
}

export interface MoveCategoryOptions {
  id: string;
  parentId: string | null;
  actorId: string;
  ip?: string;
  ua?: string;
}

export async function moveCategory(opts: MoveCategoryOptions) {
  const { id, parentId, actorId, ip, ua } = opts;
  const before = await prisma.category.findUnique({ where: { id } });
  if (!before) throw new Error(`Category ${id} not found`);
  await assertNoCycle(id, parentId);

  return withAudit(
    { actorId, entityType: 'category', entityId: id, action: 'category.move', before, ip, ua },
    async () =>
      prisma.category.update({
        where: { id },
        data: { parentId },
      }),
  );
}

/**
 * Returns true when `ancestorId` appears anywhere in the parent chain of
 * `candidateId` (inclusive). Walks up via parentId links and tracks visited
 * nodes in a Set so a corrupt cycle in existing data terminates rather than
 * looping forever.
 */
async function isDescendant(ancestorId: string, candidateId: string): Promise<boolean> {
  let cursor: string | null = candidateId;
  const seen = new Set<string>();
  while (cursor) {
    if (seen.has(cursor)) return false;
    seen.add(cursor);
    if (cursor === ancestorId) return true;
    const row: { parentId: string | null } | null = await prisma.category.findUnique({
      where: { id: cursor },
      select: { parentId: true },
    });
    cursor = row?.parentId ?? null;
  }
  return false;
}

async function assertNoCycle(id: string, newParentId: string | null): Promise<void> {
  if (newParentId === null) return;
  if (newParentId === id) {
    throw new Error('Category move would create a cycle (cannot be its own parent)');
  }
  if (await isDescendant(id, newParentId)) {
    throw new Error('Category move would create a cycle (parent is a descendant)');
  }
}
