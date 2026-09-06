import { prisma } from '@/server/db/client';
import { withAudit } from '../audit';
import type { HeroCreateInput, HeroUpdateInput } from '@/lib/schemas/admin-hero';

export interface CreateHeroOptions {
  input: HeroCreateInput;
  actorId: string;
  ip?: string;
  ua?: string;
}

/**
 * Always inserts with `isActive=false`. Promotion is a separate explicit
 * step so accidental re-imports don't clobber the live hero.
 */
export async function createHero(opts: CreateHeroOptions) {
  const { input, actorId, ip, ua } = opts;
  return withAudit(
    {
      actorId,
      entityType: 'hero',
      entityId: 'pending',
      action: 'hero.create',
      ip,
      ua,
    },
    async () =>
      prisma.heroBlock.create({
        data: {
          kind: input.kind,
          imageUrl: input.imageUrl,
          videoUrl: input.videoUrl ?? null,
          mobileImageUrl: input.mobileImageUrl ?? null,
          mobileVideoUrl: input.mobileVideoUrl ?? null,
          eyebrow: input.eyebrow,
          ctaLabel: input.ctaLabel,
          ctaHref: input.ctaHref,
          scheduledFor: input.scheduledFor ?? null,
          isActive: false,
        },
      }),
  );
}

export interface UpdateHeroOptions {
  id: string;
  input: HeroUpdateInput;
  actorId: string;
  ip?: string;
  ua?: string;
}

/**
 * Patches editable fields. Deliberately omits `isActive` from the data
 * payload so a stray client field can't usurp the activation rule.
 */
export async function updateHero(opts: UpdateHeroOptions) {
  const { id, input, actorId, ip, ua } = opts;
  const before = await prisma.heroBlock.findUnique({ where: { id } });
  if (!before) throw new Error(`Hero ${id} not found`);
  return withAudit(
    { actorId, entityType: 'hero', entityId: id, action: 'hero.update', before, ip, ua },
    async () =>
      prisma.heroBlock.update({
        where: { id },
        data: {
          kind: input.kind,
          imageUrl: input.imageUrl,
          videoUrl: input.videoUrl,
          mobileImageUrl: input.mobileImageUrl,
          mobileVideoUrl: input.mobileVideoUrl,
          eyebrow: input.eyebrow,
          ctaLabel: input.ctaLabel,
          ctaHref: input.ctaHref,
          scheduledFor: input.scheduledFor,
        },
      }),
  );
}

export interface ActivateHeroOptions {
  id: string;
  actorId: string;
  ip?: string;
  ua?: string;
}

/**
 * Atomically deactivates every other hero and activates the chosen one.
 * Idempotent: if the target is already active, returns the row without
 * writing an audit entry. The two writes share a transaction so a partial
 * failure can't leave two rows active.
 */
export async function activateHero(opts: ActivateHeroOptions) {
  const { id, actorId, ip, ua } = opts;
  const before = await prisma.heroBlock.findUnique({ where: { id } });
  if (!before) throw new Error(`Hero ${id} not found`);
  if (before.isActive) return before;

  return withAudit(
    { actorId, entityType: 'hero', entityId: id, action: 'hero.activate', before, ip, ua },
    async () => {
      const [, activated] = await prisma.$transaction([
        prisma.heroBlock.updateMany({
          where: { isActive: true, id: { not: id } },
          data: { isActive: false },
        }),
        prisma.heroBlock.update({ where: { id }, data: { isActive: true } }),
      ]);
      return activated;
    },
  );
}

export interface DeleteHeroOptions {
  id: string;
  actorId: string;
  ip?: string;
  ua?: string;
}

export async function deleteHero(opts: DeleteHeroOptions) {
  const { id, actorId, ip, ua } = opts;
  const before = await prisma.heroBlock.findUnique({ where: { id } });
  if (!before) throw new Error(`Hero ${id} not found`);
  return withAudit(
    { actorId, entityType: 'hero', entityId: id, action: 'hero.delete', before, ip, ua },
    async () => prisma.heroBlock.delete({ where: { id } }),
  );
}
