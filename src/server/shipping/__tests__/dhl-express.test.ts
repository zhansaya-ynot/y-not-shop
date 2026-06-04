import { describe, expect, it, vi } from 'vitest';
import { DhlExpressProvider } from '../dhl-express';
import type { CreateShipmentInput, LandedCostInput } from '../provider';

describe('DhlExpressProvider.getRate', () => {
  it('calls MyDHL rates endpoint and returns parsed quote', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        products: [
          {
            productCode: 'P',
            productName: 'EXPRESS WORLDWIDE',
            totalPrice: [{ currencyType: 'BILLC', priceCurrency: 'GBP', price: 45.5 }],
            deliveryCapabilities: { totalTransitDays: '2' },
          },
        ],
      }),
      text: async () => '',
    });
    const p = new DhlExpressProvider({
      apiKey: 'k',
      apiSecret: 's',
      accountNumber: '230200799',
      fetcher: fetchMock as unknown as typeof fetch,
    });
    const r = await p.getRate({
      destinationCountry: 'DE',
      destinationPostcode: '10115',
      weightGrams: 800,
      declaredValueCents: 20000,
    });
    expect(r.baseRateCents).toBe(4550);
    expect(r.currency).toBe('GBP');
    expect(r.estimatedDaysMin).toBe(2);
    expect(r.estimatedDaysMax).toBe(2);
    expect(r.name).toContain('DHL');
    expect(fetchMock).toHaveBeenCalledOnce();

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://express.api.dhl.com/mydhlapi/rates');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Basic ${Buffer.from('k:s').toString('base64')}`);
    expect(headers['Content-Type']).toBe('application/json');
    const body = JSON.parse(init.body as string);
    expect(body.accounts[0].number).toBe('230200799');
    expect(body.customerDetails.shipperDetails.countryCode).toBe('GB');
    expect(body.customerDetails.receiverDetails.countryCode).toBe('DE');
    expect(body.isCustomsDeclarable).toBe(true);
  });

  it('falls back to first totalPrice entry when no BILLC currency', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        products: [
          {
            totalPrice: [{ currencyType: 'PULCL', priceCurrency: 'GBP', price: 30 }],
            deliveryCapabilities: { totalTransitDays: '3' },
          },
        ],
      }),
      text: async () => '',
    });
    const p = new DhlExpressProvider({
      apiKey: 'k',
      apiSecret: 's',
      accountNumber: 'a',
      fetcher: fetchMock as unknown as typeof fetch,
    });
    const r = await p.getRate({
      destinationCountry: 'GB',
      destinationPostcode: 'SW7 5QG',
      weightGrams: 500,
      declaredValueCents: 10000,
    });
    expect(r.baseRateCents).toBe(3000);
    const [, init] = fetchMock.mock.calls[0]!;
    expect(JSON.parse(init.body as string).isCustomsDeclarable).toBe(false);
  });

  it('throws on non-2xx including the DHL provider name + status', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => 'service unavailable',
    });
    const p = new DhlExpressProvider({
      apiKey: 'k',
      apiSecret: 's',
      accountNumber: 'x',
      fetcher: fetchMock as unknown as typeof fetch,
    });
    await expect(
      p.getRate({
        destinationCountry: 'DE',
        destinationPostcode: '10115',
        weightGrams: 1,
        declaredValueCents: 1,
      }),
    ).rejects.toThrow(/DHL.*503/);
  });

  it('throws when products array is empty', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ products: [] }),
      text: async () => '',
    });
    const p = new DhlExpressProvider({
      apiKey: 'k',
      apiSecret: 's',
      accountNumber: 'x',
      fetcher: fetchMock as unknown as typeof fetch,
    });
    await expect(
      p.getRate({
        destinationCountry: 'DE',
        destinationPostcode: '10115',
        weightGrams: 1,
        declaredValueCents: 1,
      }),
    ).rejects.toThrow(/no products/i);
  });
});

describe('DhlExpressProvider.landedCost', () => {
  const sampleInput: LandedCostInput = {
    destinationCountry: 'DE',
    items: [
      {
        productSlug: 'silk-scarf',
        hsCode: '6201',
        weightGrams: 800,
        unitPriceCents: 20000,
        quantity: 1,
        countryOfOriginCode: 'CN',
      },
    ],
  };

  it('calls landed-cost endpoint and parses dutyCents/taxCents', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        products: [
          {
            landedCost: { totalDutyAmount: 12.5, totalTaxAmount: 7.5, currency: 'GBP' },
            items: [],
          },
        ],
      }),
      text: async () => '',
    });
    const p = new DhlExpressProvider({
      apiKey: 'k',
      apiSecret: 's',
      accountNumber: 'a',
      fetcher: fetchMock as unknown as typeof fetch,
    });
    const q = await p.landedCost(sampleInput);
    expect(q.dutyCents).toBe(1250);
    expect(q.taxCents).toBe(750);
    expect(q.currency).toBe('GBP');
    expect(q.breakdown).toEqual([]);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://express.api.dhl.com/mydhlapi/landed-cost');
    const body = JSON.parse(init.body as string);
    expect(body.isCustomsDeclarable).toBe(true);
    expect(body.items[0].partNumber).toBe('silk-scarf');
    expect(body.items[0].commodityCode).toBe('6201');
    expect(body.items[0].manufacturerCountry).toBe('CN');
    expect(body.items[0].customsValue).toBe(200);
  });

  it('parses per-item breakdown', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        products: [
          {
            landedCost: { totalDutyAmount: 20, totalTaxAmount: 10 },
            items: [
              { partNumber: 'silk-scarf', commodityCode: '6201', dutyAmount: 20, taxAmount: 10 },
            ],
          },
        ],
      }),
      text: async () => '',
    });
    const p = new DhlExpressProvider({
      apiKey: 'k',
      apiSecret: 's',
      accountNumber: 'a',
      fetcher: fetchMock as unknown as typeof fetch,
    });
    const q = await p.landedCost(sampleInput);
    expect(q.breakdown).toEqual([
      { productSlug: 'silk-scarf', hsCode: '6201', dutyCents: 2000, taxCents: 1000 },
    ]);
  });

  it('throws on non-2xx', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      text: async () => 'bad gateway',
    });
    const p = new DhlExpressProvider({
      apiKey: 'k',
      apiSecret: 's',
      accountNumber: 'a',
      fetcher: fetchMock as unknown as typeof fetch,
    });
    await expect(p.landedCost(sampleInput)).rejects.toThrow(/DHL.*landed-cost.*502/);
  });

  it('falls back to GB origin and default HS code when not supplied', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ products: [{ landedCost: {} }] }),
      text: async () => '',
    });
    const p = new DhlExpressProvider({
      apiKey: 'k',
      apiSecret: 's',
      accountNumber: 'a',
      fetcher: fetchMock as unknown as typeof fetch,
    });
    await p.landedCost({
      destinationCountry: 'US',
      items: [
        {
          productSlug: 'belt',
          hsCode: null,
          weightGrams: 200,
          unitPriceCents: 5000,
          quantity: 3,
          countryOfOriginCode: null,
        },
      ],
    });
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(body.items[0].manufacturerCountry).toBe('GB');
    expect(body.items[0].commodityCode).toBe('6217.10.00');
    expect(body.items[0].customsValue).toBe(150); // 5000c * 3 / 100
  });
});

describe('DhlExpressProvider.createShipment', () => {
  const intlInput: CreateShipmentInput = {
    orderRef: 'YN-2026-00042',
    recipient: {
      fullName: 'Anna Schmidt',
      addressLine1: 'Friedrichstrasse 12',
      city: 'Berlin',
      postalCode: '10117',
      countryCode: 'DE',
      email: 'anna@example.com',
      phone: '+49 30 1234567',
    },
    items: [
      {
        productSlug: 'silk-scarf',
        name: 'Silk Scarf — Emerald',
        sku: 'SCRF-EM-01',
        quantity: 1,
        unitPriceCents: 24000,
        weightGrams: 80,
        hsCode: '6214.10',
        countryOfOriginCode: 'GB',
      },
    ],
    weightGrams: 80,
    subtotalCents: 24000,
    declaredValueCents: 24000,
    isInternational: true,
  };

  it('posts to /shipments and decodes label + invoice PDFs from base64', async () => {
    const labelPdf = Buffer.from('PDFLABEL').toString('base64');
    const invoicePdf = Buffer.from('PDFINVOICE').toString('base64');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        shipmentTrackingNumber: '1234567890',
        documents: [
          { typeCode: 'label', content: labelPdf },
          { typeCode: 'invoice', content: invoicePdf },
        ],
      }),
      text: async () => '',
    });
    const p = new DhlExpressProvider({
      apiKey: 'k',
      apiSecret: 's',
      accountNumber: '230200799',
      fetcher: fetchMock as unknown as typeof fetch,
    });

    const r = await p.createShipment(intlInput);
    expect(r.trackingNumber).toBe('1234567890');
    expect(r.labelPdfBytes.toString()).toBe('PDFLABEL');
    expect(r.customsInvoicePdfBytes?.toString()).toBe('PDFINVOICE');

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://express.api.dhl.com/mydhlapi/shipments');
    const body = JSON.parse(init.body as string);
    expect(body.accounts[0].number).toBe('230200799');
    expect(body.customerDetails.shipperDetails.contactInformation.companyName).toBe('YNOT London');
    expect(body.customerDetails.receiverDetails.contactInformation.fullName).toBe('Anna Schmidt');
    expect(body.customerDetails.receiverDetails.postalAddress.countryCode).toBe('DE');
    expect(body.content.isCustomsDeclarable).toBe(true);
    expect(body.content.exportDeclaration.lineItems[0].commodityCodes[0].value).toBe('6214.10');
    expect(body.content.unitOfMeasurement).toBe('metric');
    expect(body.customerReferences[0].value).toBe('YN-2026-00042');
    // Paperless Trade (WY) + DHL-generated invoice — required by DHL CFIT
    // (Lee 2026-06-02) for any customs-declarable shipment.
    expect(body.valueAddedServices).toEqual([{ serviceCode: 'WY' }]);
    const invoiceOpt = body.outputImageProperties.imageOptions.find(
      (o: { typeCode: string }) => o.typeCode === 'invoice',
    );
    expect(invoiceOpt.isRequested).toBe(true);
  });

  it('omits customs block + invoice PDF for domestic shipments', async () => {
    const labelPdf = Buffer.from('LBL').toString('base64');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        shipmentTrackingNumber: 'GB123',
        documents: [{ typeCode: 'label', content: labelPdf }],
      }),
      text: async () => '',
    });
    const p = new DhlExpressProvider({
      apiKey: 'k',
      apiSecret: 's',
      accountNumber: 'a',
      fetcher: fetchMock as unknown as typeof fetch,
    });
    const r = await p.createShipment({ ...intlInput, isInternational: false });
    expect(r.trackingNumber).toBe('GB123');
    expect(r.customsInvoicePdfBytes).toBeUndefined();

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(body.content.isCustomsDeclarable).toBe(false);
    expect(body.content.exportDeclaration).toBeUndefined();
    // Paperless Trade is only for customs-declarable shipments — domestic
    // payload must not include it.
    expect(body.valueAddedServices).toBeUndefined();
  });

  it('throws on non-2xx', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'internal',
    });
    const p = new DhlExpressProvider({
      apiKey: 'k',
      apiSecret: 's',
      accountNumber: 'a',
      fetcher: fetchMock as unknown as typeof fetch,
    });
    await expect(p.createShipment(intlInput)).rejects.toThrow(/DHL.*createShipment.*500/);
  });

  it('throws when label document is missing from response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ shipmentTrackingNumber: '999', documents: [] }),
      text: async () => '',
    });
    const p = new DhlExpressProvider({
      apiKey: 'k',
      apiSecret: 's',
      accountNumber: 'a',
      fetcher: fetchMock as unknown as typeof fetch,
    });
    await expect(p.createShipment(intlInput)).rejects.toThrow(/no label document/i);
  });
});
