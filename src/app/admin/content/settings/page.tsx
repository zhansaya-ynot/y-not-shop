import * as React from 'react';
import { prisma } from '@/server/db/client';
import { SitePolicyForm } from './_components/site-policy-form';

export const dynamic = 'force-dynamic';

const SINGLETON_ID = 'singleton';

const DEFAULTS = {
  defaultCurrency: 'GBP' as const,
  defaultCarrier: 'ROYAL_MAIL' as const,
  freeShipThresholdCents: 20000,
  contactEmail: 'hello@ynot.london',
  whatsappNumber: '',
  authSignInImage: '/cms/auth/sign-in.jpg' as string | null,
  authRegisterImage: '/cms/auth/register.jpg' as string | null,
  brandStatementPrimary:
    'Urban outerwear designed to move with you, for any occasion — from street to statement.',
  brandStatementSecondary: 'Why not.',
  brandStatementTertiary: 'A way of living.',
};

export default async function AdminSettingsPage(): Promise<React.ReactElement> {
  const policy = await prisma.sitePolicy.findUnique({ where: { id: SINGLETON_ID } });

  // The singleton row is created on first save (the service upserts), so on
  // a fresh DB we hand the form Prisma's schema-level defaults.
  const initial = policy
    ? {
        defaultCurrency: policy.defaultCurrency,
        defaultCarrier: policy.defaultCarrier,
        freeShipThresholdCents: policy.freeShipThresholdCents,
        contactEmail: policy.contactEmail,
        whatsappNumber: policy.whatsappNumber,
        authSignInImage: policy.authSignInImage,
        authRegisterImage: policy.authRegisterImage,
        brandStatementPrimary: policy.brandStatementPrimary,
        brandStatementSecondary: policy.brandStatementSecondary,
        brandStatementTertiary: policy.brandStatementTertiary,
      }
    : DEFAULTS;

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-semibold mb-2">Site settings</h2>
      <p className="text-sm text-neutral-600 mb-6">
        Storefront-wide policy: currency, default carrier, free-shipping threshold
        and contact channels.
      </p>
      <SitePolicyForm initial={initial} />
    </div>
  );
}
