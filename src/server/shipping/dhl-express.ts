import type {
  CreateShipmentInput,
  CreateShipmentResult,
  GetRateInput,
  LandedCostInput,
  LandedCostQuote,
  ShippingQuote,
  ShippingRateProvider,
} from './provider';

const ORIGIN = { country: 'GB', postcode: 'SW7 5QG', city: 'London' } as const;
const DHL_BASE_PROD = 'https://express.api.dhl.com/mydhlapi';
const DHL_BASE_TEST = 'https://express.api.dhl.com/mydhlapi/test';

export interface DhlExpressConfig {
  apiKey: string;
  apiSecret: string;
  accountNumber: string;
  /**
   * MyDHL API base URL. Pass `'test'` for the Customer Integration Testing
   * sandbox at developer.dhl.com (default credentials there only work against
   * `/mydhlapi/test`); pass `'prod'` (or omit) once Production Access has been
   * granted. Override with a full URL string for self-hosted gateways.
   */
  baseUrl?: 'prod' | 'test' | string;
  fetcher?: typeof fetch;
}

interface DhlPriceEntry {
  currencyType?: string;
  priceCurrency?: string;
  price?: number;
}

interface DhlProduct {
  productCode?: string;
  productName?: string;
  totalPrice?: DhlPriceEntry[];
  deliveryCapabilities?: { totalTransitDays?: string };
  landedCost?: { totalDutyAmount?: number; totalTaxAmount?: number; currency?: string };
  items?: DhlLandedCostItem[];
}

interface DhlLandedCostItem {
  partNumber?: string;
  commodityCode?: string;
  dutyAmount?: number;
  taxAmount?: number;
}

interface DhlShipmentResponse {
  shipmentTrackingNumber?: string;
  documents?: Array<{ typeCode?: string; content?: string }>;
}

const SHIPPER_CONTACT = {
  fullName: 'YNOT London Despatch',
  companyName: 'YNOT London',
  email: 'hello@ynotlondon.com',
  phone: '+44 20 0000 0000',
} as const;

const SHIPPER_ADDRESS = {
  postalCode: ORIGIN.postcode,
  cityName: ORIGIN.city,
  countryCode: ORIGIN.country,
  addressLine1: '13 Elvaston Place',
  addressLine2: 'Flat 1',
} as const;

/**
 * Live MyDHL API client — used for international rates, landed cost, and
 * shipment creation. Authentication is HTTP Basic with `apiKey:apiSecret`.
 *
 * Tests inject `cfg.fetcher` (a `vi.fn()` returning a stubbed Response shape).
 * Production passes nothing — the global `fetch` is used.
 *
 * Spec §4 (stack), §12 (failure handling — caller is responsible for catching
 * thrown errors and falling back to {@link MockDhlProvider}).
 */
export class DhlExpressProvider implements ShippingRateProvider {
  private readonly fetcher: typeof fetch;
  private readonly base: string;

  constructor(private readonly cfg: DhlExpressConfig) {
    this.fetcher = cfg.fetcher ?? fetch;
    if (!cfg.baseUrl || cfg.baseUrl === 'prod') this.base = DHL_BASE_PROD;
    else if (cfg.baseUrl === 'test') this.base = DHL_BASE_TEST;
    else this.base = cfg.baseUrl;
  }

  private headers(): HeadersInit {
    const auth = Buffer.from(`${this.cfg.apiKey}:${this.cfg.apiSecret}`).toString('base64');
    return {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  async getRate(input: GetRateInput): Promise<ShippingQuote> {
    const plannedAt = new Date(Date.now() + 86_400_000).toISOString().slice(0, 19) + ' GMT+00:00';
    const body = {
      customerDetails: {
        shipperDetails: {
          postalCode: ORIGIN.postcode,
          cityName: ORIGIN.city,
          countryCode: ORIGIN.country,
        },
        receiverDetails: {
          postalCode: input.destinationPostcode,
          countryCode: input.destinationCountry,
          cityName: '',
        },
      },
      accounts: [{ typeCode: 'shipper', number: this.cfg.accountNumber }],
      productCode: 'P',
      payerCountryCode: ORIGIN.country,
      plannedShippingDateAndTime: plannedAt,
      unitOfMeasurement: 'metric',
      isCustomsDeclarable: input.destinationCountry !== ORIGIN.country,
      monetaryAmount: [
        { typeCode: 'declaredValue', value: input.declaredValueCents / 100, currency: 'GBP' },
      ],
      packages: [
        {
          weight: input.weightGrams / 1000,
          dimensions: { length: 30, width: 25, height: 5 },
        },
      ],
    };

    const resp = await this.fetcher(`${this.base}/rates`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`DHL Express rate API ${resp.status}: ${err}`);
    }

    const data = (await resp.json()) as { products?: DhlProduct[] };
    const product = data.products?.[0];
    if (!product) throw new Error('DHL Express rate API returned no products');

    const totalPrice =
      product.totalPrice?.find((p) => p.currencyType === 'BILLC') ?? product.totalPrice?.[0];
    if (!totalPrice || totalPrice.price === undefined) {
      throw new Error('DHL Express rate API returned no totalPrice');
    }

    const days = parseInt(product.deliveryCapabilities?.totalTransitDays ?? '3', 10);
    return {
      name: 'DHL Express Worldwide',
      baseRateCents: Math.round(totalPrice.price * 100),
      currency: 'GBP',
      estimatedDaysMin: days,
      estimatedDaysMax: days,
    };
  }

  async landedCost(input: LandedCostInput): Promise<LandedCostQuote> {
    const body = {
      customerDetails: {
        shipperDetails: {
          postalCode: ORIGIN.postcode,
          cityName: ORIGIN.city,
          countryCode: ORIGIN.country,
        },
        receiverDetails: {
          countryCode: input.destinationCountry,
          postalCode: '00000',
          cityName: '',
        },
      },
      accounts: [{ typeCode: 'shipper', number: this.cfg.accountNumber }],
      productCode: 'P',
      unitOfMeasurement: 'metric',
      currencyCode: 'GBP',
      isCustomsDeclarable: true,
      items: input.items.map((i, idx) => ({
        number: idx + 1,
        name: i.productSlug,
        manufacturerCountry: i.countryOfOriginCode ?? 'GB',
        partNumber: i.productSlug,
        quantity: i.quantity,
        quantityType: 'pcs',
        unitPrice: i.unitPriceCents / 100,
        unitPriceCurrency: 'GBP',
        customsValue: (i.unitPriceCents * i.quantity) / 100,
        customsValueCurrency: 'GBP',
        commodityCode: i.hsCode ?? '6217.10.00',
        weight: { netValue: i.weightGrams / 1000, grossValue: i.weightGrams / 1000 },
      })),
    };

    const resp = await this.fetcher(`${this.base}/landed-cost`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`DHL Express landed-cost API ${resp.status}: ${err}`);
    }
    const data = (await resp.json()) as { products?: DhlProduct[] };
    const product = data.products?.[0];
    if (!product?.landedCost) {
      throw new Error('DHL Express landed-cost returned no landedCost block');
    }
    return {
      dutyCents: Math.round((product.landedCost.totalDutyAmount ?? 0) * 100),
      taxCents: Math.round((product.landedCost.totalTaxAmount ?? 0) * 100),
      currency: 'GBP',
      breakdown: (product.items ?? []).map((it) => ({
        productSlug: it.partNumber ?? '',
        hsCode: it.commodityCode ?? null,
        dutyCents: Math.round((it.dutyAmount ?? 0) * 100),
        taxCents: Math.round((it.taxAmount ?? 0) * 100),
      })),
    };
  }

  async createShipment(input: CreateShipmentInput): Promise<CreateShipmentResult> {
    const plannedAt = new Date(Date.now() + 86_400_000).toISOString().slice(0, 19) + ' GMT+00:00';
    const exportDeclaration = input.isInternational
      ? {
          lineItems: input.items.map((it, idx) => ({
            number: idx + 1,
            description: it.name,
            price: it.unitPriceCents / 100,
            priceCurrency: 'GBP',
            quantity: { value: it.quantity, unitOfMeasurement: 'PCS' },
            commodityCodes: [
              { typeCode: 'outbound', value: it.hsCode ?? '6217.10.00' },
            ],
            exportReasonType: 'permanent',
            manufacturerCountry: it.countryOfOriginCode ?? 'GB',
            weight: {
              netValue: it.weightGrams / 1000,
              grossValue: it.weightGrams / 1000,
            },
          })),
          invoice: {
            number: input.orderRef,
            date: new Date().toISOString().slice(0, 10),
          },
          exportReason: 'sale',
        }
      : undefined;

    const body: Record<string, unknown> = {
      plannedShippingDateAndTime: plannedAt,
      productCode: 'P',
      accounts: [{ typeCode: 'shipper', number: this.cfg.accountNumber }],
      customerReferences: [{ value: input.orderRef, typeCode: 'CU' }],
      customerDetails: {
        shipperDetails: {
          postalAddress: SHIPPER_ADDRESS,
          contactInformation: SHIPPER_CONTACT,
        },
        receiverDetails: {
          postalAddress: {
            postalCode: input.recipient.postalCode,
            cityName: input.recipient.city,
            countryCode: input.recipient.countryCode,
            addressLine1: input.recipient.addressLine1,
            ...(input.recipient.addressLine2 ? { addressLine2: input.recipient.addressLine2 } : {}),
          },
          contactInformation: {
            fullName: input.recipient.fullName,
            companyName: input.recipient.companyName ?? input.recipient.fullName,
            email: input.recipient.email ?? '',
            phone: input.recipient.phone ?? '',
          },
        },
      },
      content: {
        unitOfMeasurement: 'metric',
        isCustomsDeclarable: input.isInternational,
        description: input.items.map((it) => it.name).join(', ').slice(0, 70),
        incoterm: input.isInternational ? 'DDP' : 'DAP',
        declaredValue: input.declaredValueCents / 100,
        declaredValueCurrency: 'GBP',
        packages: [
          {
            weight: input.weightGrams / 1000,
            dimensions: { length: 30, width: 25, height: 5 },
            customerReferences: [{ value: input.orderRef, typeCode: 'CU' }],
          },
        ],
        ...(exportDeclaration ? { exportDeclaration } : {}),
      },
      outputImageProperties: {
        printerDPI: 300,
        encodingFormat: 'pdf',
        imageOptions: [
          { typeCode: 'label', templateName: 'ECOM26_84_A4_001' },
          ...(input.isInternational
            ? [{ typeCode: 'invoice', templateName: 'COMMERCIAL_INVOICE_P_10' }]
            : []),
        ],
      },
    };

    const resp = await this.fetcher(`${this.base}/shipments`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`DHL Express createShipment ${resp.status}: ${err}`);
    }

    const data = (await resp.json()) as DhlShipmentResponse;
    const trackingNumber = data.shipmentTrackingNumber;
    if (!trackingNumber) {
      throw new Error('DHL Express createShipment returned no shipmentTrackingNumber');
    }
    const labelDoc = data.documents?.find((d) => d.typeCode === 'label');
    if (!labelDoc?.content) {
      throw new Error('DHL Express createShipment returned no label document');
    }
    const customsDoc = data.documents?.find((d) => d.typeCode === 'invoice');
    return {
      trackingNumber,
      labelPdfBytes: Buffer.from(labelDoc.content, 'base64'),
      customsInvoicePdfBytes: customsDoc?.content
        ? Buffer.from(customsDoc.content, 'base64')
        : undefined,
    };
  }
}
