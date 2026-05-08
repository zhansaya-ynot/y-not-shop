import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db/client';
import { withAudit } from '../audit';
import { ensureUniqueSlug } from '../catalog/slug-service';
import { slugify } from '@/lib/slug';
import type {
  StaticPageCreateInput,
  StaticPageUpdateInput,
} from '@/lib/schemas/admin-staticpage';

export interface CreateStaticPageOptions {
  input: StaticPageCreateInput;
  actorId: string;
  ip?: string;
  ua?: string;
}

export async function createStaticPage(opts: CreateStaticPageOptions) {
  const { input, actorId, ip, ua } = opts;
  const baseSlug = input.slug ?? slugify(input.title);
  const slug = await ensureUniqueSlug('staticpage', baseSlug);
  return withAudit(
    {
      actorId,
      entityType: 'staticpage',
      entityId: 'pending',
      action: 'staticpage.create',
      ip,
      ua,
    },
    async () =>
      prisma.staticPage.create({
        data: {
          slug,
          title: input.title,
          bodyMarkdown: input.bodyMarkdown ?? '',
          metaTitle: input.metaTitle ?? '',
          metaDescription: input.metaDescription ?? '',
          heroImage: input.heroImage ?? null,
          extras:
            input.extras === undefined
              ? Prisma.JsonNull
              : (input.extras as Prisma.InputJsonValue),
        },
      }),
  );
}

export interface UpdateStaticPageOptions {
  id: string;
  input: StaticPageUpdateInput;
  actorId: string;
  ip?: string;
  ua?: string;
}

export async function updateStaticPage(opts: UpdateStaticPageOptions) {
  const { id, input, actorId, ip, ua } = opts;
  const before = await prisma.staticPage.findUnique({ where: { id } });
  if (!before) throw new Error(`StaticPage ${id} not found`);

  let slug = before.slug;
  if (input.slug && input.slug !== before.slug) {
    slug = await ensureUniqueSlug('staticpage', input.slug, id);
  }

  return withAudit(
    {
      actorId,
      entityType: 'staticpage',
      entityId: id,
      action: 'staticpage.update',
      before,
      ip,
      ua,
    },
    async () =>
      prisma.staticPage.update({
        where: { id },
        data: {
          slug,
          title: input.title,
          bodyMarkdown: input.bodyMarkdown,
          metaTitle: input.metaTitle,
          metaDescription: input.metaDescription,
          ...(input.heroImage !== undefined ? { heroImage: input.heroImage } : {}),
          // Json column quirk: undefined = "don't touch", null sentinel
          // = "set to SQL NULL", any other value = stored verbatim.
          ...(input.extras !== undefined
            ? { extras: input.extras as Prisma.InputJsonValue }
            : {}),
        },
      }),
  );
}

export interface DeleteStaticPageOptions {
  id: string;
  actorId: string;
  ip?: string;
  ua?: string;
}

export async function deleteStaticPage(opts: DeleteStaticPageOptions) {
  const { id, actorId, ip, ua } = opts;
  const before = await prisma.staticPage.findUnique({ where: { id } });
  if (!before) throw new Error(`StaticPage ${id} not found`);
  return withAudit(
    {
      actorId,
      entityType: 'staticpage',
      entityId: id,
      action: 'staticpage.delete',
      before,
      ip,
      ua,
    },
    async () => prisma.staticPage.delete({ where: { id } }),
  );
}
