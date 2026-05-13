import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db/client';
import { withAudit } from '../audit';
import type { SitePolicyUpdateInput } from '@/lib/schemas/admin-sitepolicy';

export interface UpdateSitePolicyOptions {
  input: SitePolicyUpdateInput;
  actorId: string;
  ip?: string;
  ua?: string;
}

const SINGLETON_ID = 'singleton';

/**
 * Upserts the SitePolicy singleton (`id = 'singleton'`). Schema defaults
 * fill in values on first insert; on subsequent calls only the explicit
 * fields are written so partial PATCH from the admin form leaves the rest
 * intact. The `before` snapshot we hand to `withAudit` is the row prior to
 * the upsert (or null when the row didn't yet exist).
 */
export async function updateSitePolicy(opts: UpdateSitePolicyOptions) {
  const { input, actorId, ip, ua } = opts;
  const before = await prisma.sitePolicy.findUnique({ where: { id: SINGLETON_ID } });

  return withAudit(
    {
      actorId,
      entityType: 'sitepolicy',
      entityId: SINGLETON_ID,
      action: 'sitepolicy.update',
      before,
      ip,
      ua,
    },
    async () =>
      prisma.sitePolicy.upsert({
        where: { id: SINGLETON_ID },
        create: {
          id: SINGLETON_ID,
          ...(input.defaultCurrency !== undefined ? { defaultCurrency: input.defaultCurrency } : {}),
          ...(input.defaultCarrier !== undefined ? { defaultCarrier: input.defaultCarrier } : {}),
          ...(input.freeShipThresholdCents !== undefined
            ? { freeShipThresholdCents: input.freeShipThresholdCents }
            : {}),
          ...(input.contactEmail !== undefined ? { contactEmail: input.contactEmail } : {}),
          ...(input.whatsappNumber !== undefined ? { whatsappNumber: input.whatsappNumber } : {}),
          ...(input.whatsappMessage !== undefined ? { whatsappMessage: input.whatsappMessage } : {}),
          ...(input.authSignInImage !== undefined ? { authSignInImage: input.authSignInImage } : {}),
          ...(input.authRegisterImage !== undefined ? { authRegisterImage: input.authRegisterImage } : {}),
          ...(input.brandStatementPrimary !== undefined ? { brandStatementPrimary: input.brandStatementPrimary } : {}),
          ...(input.brandStatementSecondary !== undefined ? { brandStatementSecondary: input.brandStatementSecondary } : {}),
          ...(input.brandStatementTertiary !== undefined ? { brandStatementTertiary: input.brandStatementTertiary } : {}),
          ...(input.footerJson !== undefined
            ? { footerJson: input.footerJson as Prisma.InputJsonValue }
            : {}),
          ...(input.homeEditorialJson !== undefined
            ? { homeEditorialJson: input.homeEditorialJson as Prisma.InputJsonValue }
            : {}),
        },
        update: {
          ...(input.defaultCurrency !== undefined ? { defaultCurrency: input.defaultCurrency } : {}),
          ...(input.defaultCarrier !== undefined ? { defaultCarrier: input.defaultCarrier } : {}),
          ...(input.freeShipThresholdCents !== undefined
            ? { freeShipThresholdCents: input.freeShipThresholdCents }
            : {}),
          ...(input.contactEmail !== undefined ? { contactEmail: input.contactEmail } : {}),
          ...(input.whatsappNumber !== undefined ? { whatsappNumber: input.whatsappNumber } : {}),
          ...(input.whatsappMessage !== undefined ? { whatsappMessage: input.whatsappMessage } : {}),
          ...(input.authSignInImage !== undefined ? { authSignInImage: input.authSignInImage } : {}),
          ...(input.authRegisterImage !== undefined ? { authRegisterImage: input.authRegisterImage } : {}),
          ...(input.brandStatementPrimary !== undefined ? { brandStatementPrimary: input.brandStatementPrimary } : {}),
          ...(input.brandStatementSecondary !== undefined ? { brandStatementSecondary: input.brandStatementSecondary } : {}),
          ...(input.brandStatementTertiary !== undefined ? { brandStatementTertiary: input.brandStatementTertiary } : {}),
          ...(input.footerJson !== undefined
            ? { footerJson: input.footerJson as Prisma.InputJsonValue }
            : {}),
          ...(input.homeEditorialJson !== undefined
            ? { homeEditorialJson: input.homeEditorialJson as Prisma.InputJsonValue }
            : {}),
        },
      }),
  );
}
