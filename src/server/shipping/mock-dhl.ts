import { prisma } from '@/server/db/client';
import type {
  MultiQuoteShippingProvider,
  ShippingRateRequest,
  ShippingRateQuote,
} from './provider';

const EU_27 = ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE'];
const EFTA = ['NO','CH','IS','LI'];

type Region = 'EU' | 'US' | 'CA' | 'AU' | 'JP' | 'ROW';

const RATE_TABLE: Record<Region, { shippingCents: number; dutyRate: number }> = {
  EU:  { shippingCents: 2495, dutyRate: 0.20 },
  US:  { shippingCents: 3495, dutyRate: 0.00 },
  CA:  { shippingCents: 3495, dutyRate: 0.13 },
  AU:  { shippingCents: 4495, dutyRate: 0.10 },
  JP:  { shippingCents: 4495, dutyRate: 0.10 },
  ROW: { shippingCents: 4995, dutyRate: 0.00 },
};

export function resolveRegion(cc: string): Region {
  const upper = cc.toUpperCase();
  if (upper === 'GB') throw new Error('resolveRegion called with GB');
  if ([...EU_27, ...EFTA].includes(upper)) return 'EU';
  if (upper === 'US') return 'US';
  if (upper === 'CA') return 'CA';
  if (upper === 'AU') return 'AU';
  if (upper === 'JP') return 'JP';
  return 'ROW';
}

export class MockDhlProvider implements MultiQuoteShippingProvider {
  async quote(req: ShippingRateRequest): Promise<ShippingRateQuote[]> {
    if (req.destination.countryCode === 'GB') return [];
    const region = resolveRegion(req.destination.countryCode);
    const row = RATE_TABLE[region];
    const dutiesCents = Math.round(req.subtotalCents * row.dutyRate);
    // Find the DHL method whose zone covers the destination country. The
    // production seed uses explicit ISO-2 codes (UK, EU, Worldwide); test
    // fixtures still use a single wildcard zone (`countries: ['*']`). Match
    // either by trying the destination ISO first, then falling back to the
    // wildcard so both layouts work.
    const upper = req.destination.countryCode.toUpperCase();
    const method =
      (await prisma.shippingMethod.findFirst({
        where: {
          carrier: 'DHL',
          isActive: true,
          zone: { isActive: true, countries: { has: upper } },
        },
      })) ??
      (await prisma.shippingMethod.findFirst({
        where: {
          carrier: 'DHL',
          isActive: true,
          zone: { isActive: true, countries: { has: '*' } },
        },
      }));
    if (!method) return [];
    return [{
      methodId: method.id,
      name: 'DHL Express Worldwide (DDP)',
      carrier: 'DHL',
      baseRateCents: row.shippingCents,
      dutiesCents,
      totalCents: row.shippingCents + dutiesCents,
      estimatedDaysMin: method.estimatedDaysMin,
      estimatedDaysMax: method.estimatedDaysMax,
    }];
  }
}
