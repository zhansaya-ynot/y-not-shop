import { prisma } from '@/server/db/client';
import type { DhlExpressProvider } from './dhl-express';
import { MockDhlProvider } from './mock-dhl';
import type {
  MultiQuoteShippingProvider,
  ShippingRateQuote,
  ShippingRateRequest,
} from './provider';

/**
 * Wraps the carrier-direct {@link DhlExpressProvider} (single-rate `getRate`)
 * so the storefront's checkout rate-card flow (which expects an array of
 * `ShippingRateQuote`) gets live MyDHL pricing instead of the fixed
 * {@link MockDhlProvider} table.
 *
 * Falls back to the mock provider when:
 * - destination is GB (DHL Express domestic isn't priced through this app)
 * - DHL returns an error / network issue (so checkout never blocks because of
 *   a transient carrier outage)
 */
export class DhlExpressMultiQuoteProvider implements MultiQuoteShippingProvider {
  private readonly fallback = new MockDhlProvider();

  constructor(private readonly carrier: Pick<DhlExpressProvider, 'getRate'>) {}

  async quote(req: ShippingRateRequest): Promise<ShippingRateQuote[]> {
    if (req.destination.countryCode === 'GB') return [];

    // Match an active DHL method whose zone covers the destination — same
    // lookup MockDhlProvider uses, so admin zone edits drive both providers.
    const method = await prisma.shippingMethod.findFirst({
      where: {
        carrier: 'DHL',
        isActive: true,
        zone: {
          isActive: true,
          countries: { has: req.destination.countryCode.toUpperCase() },
        },
      },
    });
    if (!method) return [];

    try {
      const rate = await this.carrier.getRate({
        destinationCountry: req.destination.countryCode.toUpperCase(),
        destinationPostcode: req.destination.postcode ?? '00000',
        weightGrams: totalWeight(req),
        declaredValueCents: req.subtotalCents,
      });
      return [{
        methodId: method.id,
        name: rate.name,
        carrier: 'DHL',
        baseRateCents: rate.baseRateCents,
        dutiesCents: 0,
        totalCents: rate.baseRateCents,
        estimatedDaysMin: rate.estimatedDaysMin ?? method.estimatedDaysMin,
        estimatedDaysMax: rate.estimatedDaysMax ?? method.estimatedDaysMax,
      }];
    } catch (e) {
      // Don't block checkout on a carrier outage — fall back to fixed rates.
      console.error('[shipping] DHL live rate failed, falling back to mock:', e);
      return this.fallback.quote(req);
    }
  }
}

function totalWeight(req: ShippingRateRequest): number {
  return req.items.reduce((sum, i) => sum + i.weightGrams * i.quantity, 0);
}
