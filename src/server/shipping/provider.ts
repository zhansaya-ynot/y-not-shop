/**
 * @fileoverview Shipping provider abstractions.
 *
 * The Phase 4 mock providers ({@link MockDhlProvider}, {@link RoyalMailFreeProvider})
 * implement the *legacy* `quote()` shape — they multiplex over the seeded
 * `ShippingMethod` rows for checkout rate display. Phase 5 introduces a
 * separate, carrier-direct surface — `getRate` / `landedCost` /
 * `createShipment` — used by the new {@link DhlExpressProvider} and
 * {@link RoyalMailClickDropProvider} clients.
 *
 * To avoid a tangled rewrite both surfaces share the same interface; every
 * method is `?` optional and callers must guard the ones they need. Spec §11
 * refers to the existing path as `RegionalRateFallback`; the rename is
 * deferred to Group H.
 */

// ---------------------------------------------------------------------------
// Phase 4 — multi-quote interface used by `MockDhlProvider`,
// `RoyalMailFreeProvider`, and `CompositeProvider` in `zones.ts`.
// ---------------------------------------------------------------------------

export interface ShippingRateRequest {
  origin: { country: 'GB' };
  destination: {
    countryCode: string; // ISO-3166 alpha-2
    postcode?: string;
  };
  items: Array<{
    productId: string;
    quantity: number;
    weightGrams: number;
    unitPriceCents: number;
    hsCode?: string;
    countryOfOriginCode?: string;
  }>;
  subtotalCents: number;
}

export interface ShippingRateQuote {
  methodId: string;
  name: string;
  carrier: 'ROYAL_MAIL' | 'DHL';
  baseRateCents: number;
  dutiesCents: number;
  totalCents: number;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
}

// ---------------------------------------------------------------------------
// Phase 5 — direct carrier-API shape.
// ---------------------------------------------------------------------------

/** A single shipping option returned by a carrier-direct rate query. */
export interface ShippingQuote {
  name: string;
  baseRateCents: number;
  currency: 'GBP';
  estimatedDaysMin: number;
  estimatedDaysMax: number;
}

/** Input for a direct rate query against a single carrier (no DB lookups). */
export interface GetRateInput {
  destinationCountry: string;
  destinationPostcode: string;
  weightGrams: number;
  declaredValueCents: number;
}

/** Per-item duty + tax breakdown returned by a landed-cost query. */
export interface LandedCostBreakdownLine {
  productSlug: string;
  hsCode: string | null;
  dutyCents: number;
  taxCents: number;
}

export interface LandedCostQuote {
  dutyCents: number;
  taxCents: number;
  currency: 'GBP';
  breakdown: LandedCostBreakdownLine[];
}

export interface LandedCostInput {
  destinationCountry: string;
  items: Array<{
    productSlug: string;
    hsCode: string | null;
    weightGrams: number;
    unitPriceCents: number;
    quantity: number;
    countryOfOriginCode: string | null;
  }>;
}

/**
 * Outgoing shipment creation input — a normalised bag of fields the carrier
 * SDK shapes into its native payload.
 */
export interface CreateShipmentInput {
  orderRef: string;
  recipient: ShipmentParty;
  items: Array<{
    productSlug: string;
    name: string;
    sku: string;
    quantity: number;
    unitPriceCents: number;
    weightGrams: number;
    hsCode: string | null;
    countryOfOriginCode: string | null;
  }>;
  weightGrams: number;
  subtotalCents: number;
  declaredValueCents: number;
  isInternational: boolean;
  /** DHL product code override. Defaults to 'P' (Express Worldwide) — only
   *  valid for international. Set to 'N' (Domestic Express) for GB→GB and
   *  GB→Northern Ireland. */
  productCode?: string;
}

export interface ShipmentParty {
  fullName: string;
  companyName?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  postalCode: string;
  countryCode: string;
  email?: string;
  phone?: string;
}

export interface CreateShipmentResult {
  trackingNumber: string;
  labelPdfBytes: Buffer;
  customsInvoicePdfBytes?: Buffer;
}

/**
 * Phase 5 carrier-direct provider — used by {@link DhlExpressProvider} and
 * {@link RoyalMailClickDropProvider}. Implementations call the carrier API
 * directly; no database lookups happen inside.
 */
export interface ShippingRateProvider {
  /** Carrier-direct rate query. */
  getRate(input: GetRateInput): Promise<ShippingQuote>;

  /** Optional landed-cost (duty + tax) query — DHL only. */
  landedCost?(input: LandedCostInput): Promise<LandedCostQuote>;
}

/**
 * Phase 4 multi-quote interface — composes DB-seeded `ShippingMethod` rows
 * into checkout rate cards. Implemented by {@link MockDhlProvider},
 * {@link RoyalMailFreeProvider}, and the `CompositeProvider` in `zones.ts`.
 *
 * Spec §11 refers to this path as `RegionalRateFallback`; the rename is
 * deferred to Group H.
 */
export interface MultiQuoteShippingProvider {
  quote(req: ShippingRateRequest): Promise<ShippingRateQuote[]>;
}
