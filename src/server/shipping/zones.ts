import { env } from '@/server/env';
import { MockDhlProvider } from './mock-dhl';
import { DhlExpressProvider } from './dhl-express';
import { DhlExpressMultiQuoteProvider } from './dhl-express-multi-quote';
import { RoyalMailFreeProvider } from './royal-mail';
import type {
  MultiQuoteShippingProvider,
  ShippingRateRequest,
  ShippingRateQuote,
} from './provider';

class CompositeProvider implements MultiQuoteShippingProvider {
  constructor(private readonly providers: MultiQuoteShippingProvider[]) {}
  async quote(req: ShippingRateRequest): Promise<ShippingRateQuote[]> {
    const results = await Promise.all(this.providers.map((p) => p.quote(req)));
    return results.flat();
  }
}

export function getShippingProvider(): MultiQuoteShippingProvider {
  switch (env.SHIPPING_PROVIDER) {
    case 'mock':
      return new CompositeProvider([new RoyalMailFreeProvider(), new MockDhlProvider()]);
    case 'dhl': {
      // Real MyDHL pricing — wraps the carrier-direct DhlExpressProvider in the
      // multi-quote adapter so the storefront keeps its existing rate-card
      // flow. Falls back internally to MockDhlProvider on carrier errors so
      // checkout never blocks on a transient outage.
      const haveCreds = Boolean(env.DHL_API_KEY && env.DHL_API_SECRET && env.DHL_ACCOUNT_NUMBER);
      const dhl = haveCreds
        ? new DhlExpressMultiQuoteProvider(
            new DhlExpressProvider({
              apiKey: env.DHL_API_KEY!,
              apiSecret: env.DHL_API_SECRET!,
              accountNumber: env.DHL_ACCOUNT_NUMBER!,
              baseUrl: env.DHL_API_ENV ?? 'prod',
            }),
          )
        : new MockDhlProvider();
      return new CompositeProvider([new RoyalMailFreeProvider(), dhl]);
    }
  }
}
