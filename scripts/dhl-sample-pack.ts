import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { DhlExpressProvider } from '../src/server/shipping/dhl-express';
import type { CreateShipmentInput, CreateShipmentResult } from '../src/server/shipping/provider';

interface SamplePack {
  label: string;
  destinationKind: 'Domestic' | 'Northern Ireland' | 'EU' | 'ROW';
  input: CreateShipmentInput;
}

const SAMPLES: SamplePack[] = [
  {
    label: 'GB-GB-Domestic',
    destinationKind: 'Domestic',
    input: {
      orderRef: 'SAMPLE-GB-001',
      recipient: {
        fullName: 'John Smith',
        companyName: 'YNOT Sample GB',
        addressLine1: '1 Piccadilly Plaza',
        city: 'Manchester',
        postalCode: 'M1 4DN',
        countryCode: 'GB',
        email: 'sample-gb@ynotlondon.com',
        phone: '+44 161 000 0001',
      },
      items: [
        {
          productSlug: 'vera-jacket',
          name: 'Vera Leather Jacket',
          sku: 'VERA-M-IVORY',
          quantity: 1,
          unitPriceCents: 79500,
          weightGrams: 1100,
          hsCode: '4203.10.00',
          countryOfOriginCode: 'GB',
        },
      ],
      weightGrams: 1100,
      subtotalCents: 79500,
      declaredValueCents: 79500,
      isInternational: false,
      productCode: 'N',
    },
  },
  {
    label: 'GB-GB-NorthernIreland',
    destinationKind: 'Northern Ireland',
    input: {
      orderRef: 'SAMPLE-NI-001',
      recipient: {
        fullName: 'Mary O Brien',
        companyName: 'YNOT Sample NI',
        addressLine1: '10 Donegall Square',
        city: 'Belfast',
        postalCode: 'BT1 5GB',
        countryCode: 'GB',
        email: 'sample-ni@ynotlondon.com',
        phone: '+44 28 9000 0001',
      },
      items: [
        {
          productSlug: 'vera-jacket',
          name: 'Vera Leather Jacket',
          sku: 'VERA-M-BROWN',
          quantity: 1,
          unitPriceCents: 79500,
          weightGrams: 1100,
          hsCode: '4203.10.00',
          countryOfOriginCode: 'GB',
        },
      ],
      weightGrams: 1100,
      subtotalCents: 79500,
      declaredValueCents: 79500,
      // GB→NI under Windsor Framework still requires customs declaration via
      // MyDHL API — see gb-dhlis-windsor-framework PDF in Barbara's email.
      isInternational: true,
      // Product code "3" = Domestic Express (Northern Ireland) per DHL Service
      // Breakdown Full - RESTv2(NI).docx (Windsor Framework).
      productCode: '3',
    },
  },
  {
    label: 'GB-DE-EU',
    destinationKind: 'EU',
    input: {
      orderRef: 'SAMPLE-EU-001',
      recipient: {
        fullName: 'Hans Mueller',
        companyName: 'YNOT Sample EU',
        addressLine1: 'Friedrichstrasse 100',
        city: 'Berlin',
        postalCode: '10117',
        countryCode: 'DE',
        email: 'sample-eu@ynotlondon.com',
        phone: '+49 30 0000 0001',
      },
      items: [
        {
          productSlug: 'vera-jacket',
          name: 'Vera Leather Jacket',
          sku: 'VERA-S-IVORY',
          quantity: 1,
          unitPriceCents: 79500,
          weightGrams: 1100,
          hsCode: '4203.10.00',
          countryOfOriginCode: 'GB',
        },
      ],
      weightGrams: 1100,
      subtotalCents: 79500,
      declaredValueCents: 79500,
      isInternational: true,
    },
  },
  {
    label: 'GB-US-ROW',
    destinationKind: 'ROW',
    input: {
      orderRef: 'SAMPLE-ROW-001',
      recipient: {
        fullName: 'Jane Doe',
        companyName: 'YNOT Sample US',
        addressLine1: '350 5th Avenue',
        addressLine2: 'Suite 1000',
        city: 'New York',
        postalCode: '10118',
        countryCode: 'US',
        email: 'sample-us@ynotlondon.com',
        phone: '+1 212 000 0001',
      },
      items: [
        {
          productSlug: 'vera-jacket',
          name: 'Vera Leather Jacket',
          sku: 'VERA-L-BROWN',
          quantity: 1,
          unitPriceCents: 79500,
          weightGrams: 1100,
          hsCode: '4203.10.00',
          countryOfOriginCode: 'GB',
        },
      ],
      weightGrams: 1100,
      subtotalCents: 79500,
      declaredValueCents: 79500,
      isInternational: true,
    },
  },
];

interface RunResult {
  label: string;
  destinationKind: SamplePack['destinationKind'];
  orderRef: string;
  ok: boolean;
  trackingNumber?: string;
  labelPath?: string;
  invoicePath?: string;
  error?: string;
}

async function main(): Promise<void> {
  const apiKey = process.env.DHL_API_KEY;
  const apiSecret = process.env.DHL_API_SECRET;
  const accountNumber = process.env.DHL_ACCOUNT_NUMBER;
  if (!apiKey || !apiSecret || !accountNumber) {
    console.error('Missing DHL_API_KEY / DHL_API_SECRET / DHL_ACCOUNT_NUMBER in env');
    process.exit(1);
  }

  // Always sandbox for the sample pack — even if .env points to prod.
  const dhl = new DhlExpressProvider({
    apiKey,
    apiSecret,
    accountNumber,
    baseUrl: 'test',
  });

  const outDir = join(process.cwd(), 'dhl-sample-pack');
  mkdirSync(outDir, { recursive: true });

  const results: RunResult[] = [];

  for (const sample of SAMPLES) {
    process.stdout.write(`[${sample.label}] creating shipment… `);
    try {
      const result: CreateShipmentResult = await dhl.createShipment(sample.input);
      const labelPath = join(outDir, `${sample.label}.label.pdf`);
      writeFileSync(labelPath, result.labelPdfBytes);
      let invoicePath: string | undefined;
      if (result.customsInvoicePdfBytes) {
        invoicePath = join(outDir, `${sample.label}.invoice.pdf`);
        writeFileSync(invoicePath, result.customsInvoicePdfBytes);
      }
      console.log(`OK ${result.trackingNumber}`);
      results.push({
        label: sample.label,
        destinationKind: sample.destinationKind,
        orderRef: sample.input.orderRef,
        ok: true,
        trackingNumber: result.trackingNumber,
        labelPath,
        ...(invoicePath ? { invoicePath } : {}),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`FAIL ${msg.slice(0, 200)}`);
      results.push({
        label: sample.label,
        destinationKind: sample.destinationKind,
        orderRef: sample.input.orderRef,
        ok: false,
        error: msg,
      });
    }
  }

  console.log('\n=== Sample Pack Summary ===');
  for (const r of results) {
    if (r.ok) {
      console.log(`✅ ${r.destinationKind.padEnd(20)} ${r.trackingNumber}  ref=${r.orderRef}`);
    } else {
      console.log(`❌ ${r.destinationKind.padEnd(20)} ${r.orderRef}: ${r.error?.slice(0, 160)}`);
    }
  }
  console.log(`\nLabels saved to: ${outDir}`);

  const summaryPath = join(outDir, 'summary.json');
  writeFileSync(summaryPath, JSON.stringify(results, null, 2));
  console.log(`Summary: ${summaryPath}`);

  const allOk = results.every((r) => r.ok);
  process.exit(allOk ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
