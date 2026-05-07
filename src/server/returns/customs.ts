import { prisma } from '@/server/db/client';
import { buildCustomsDeclaration } from '@/lib/pdf/customs';
import { env } from '@/server/env';
import type { LabelStorage } from '@/server/fulfilment/label-storage';

const DEFAULT_ITEM_WEIGHT_GRAMS = 500;

/**
 * YNOT London returns address — destination on the customs declaration that
 * accompanies an international return. Mirrors the warehouse details used by
 * the Royal Mail return label flow.
 */
export const RETURN_ADDRESS = {
  name: 'YNOT London (Returns)',
  line1: '13 Elvaston Place, Flat 1',
  city: 'London',
  postcode: 'SW7 5QG',
  country: 'GB',
} as const;

export interface BuildAndStoreCustomsDeclarationDeps {
  storage: Pick<LabelStorage, 'put'>;
}

/**
 * Render the CN23 customs declaration PDF for a non-UK return, persist it via
 * {@link LabelStorage}, and update `Return.customsPdfKey` on the row.
 *
 * Returns the storage key so callers can pull the PDF bytes back for email
 * attachment without re-rendering. Spec §7.3 / §8.4.
 *
 * Pre-conditions:
 * - The Return row already exists (created inside `createReturn`'s tx).
 * - Each ReturnItem references an OrderItem on the Order (validated upstream).
 */
export async function buildAndStoreCustomsDeclaration(
  returnId: string,
  deps: BuildAndStoreCustomsDeclarationDeps,
): Promise<string> {
  const ret = await prisma.return.findUnique({
    where: { id: returnId },
    include: {
      items: { include: { orderItem: { include: { product: true } } } },
      order: true,
    },
  });
  if (!ret) throw new Error(`Return ${returnId} not found`);

  const pdfBytes = await buildCustomsDeclaration({
    returnNumber: ret.returnNumber,
    orderNumber: ret.order.orderNumber,
    fromAddress: {
      name: `${ret.order.shipFirstName} ${ret.order.shipLastName}`.trim(),
      line1: ret.order.shipLine1,
      city: ret.order.shipCity,
      postcode: ret.order.shipPostcode,
      country: ret.order.shipCountry,
      phone: ret.order.shipPhone,
    },
    toAddress: {
      line1: RETURN_ADDRESS.line1,
      city: RETURN_ADDRESS.city,
      postcode: RETURN_ADDRESS.postcode,
      country: RETURN_ADDRESS.country,
      phone: env.YNOT_RETURNS_PHONE ?? null,
    },
    eori: env.YNOT_EORI ?? null,
    vat: env.YNOT_VAT ?? null,
    currency: ret.order.currency,
    items: ret.items.map((ri) => ({
      name: ri.orderItem.productName,
      quantity: ri.quantity,
      valueCents: ri.orderItem.unitPriceCents,
      hsCode: ri.orderItem.product?.hsCode ?? null,
      countryOfOrigin: ri.orderItem.product?.countryOfOriginCode ?? null,
      weightGrams: ri.orderItem.product?.weightGrams ?? DEFAULT_ITEM_WEIGHT_GRAMS,
    })),
  });

  const key = await deps.storage.put(`return-${ret.id}-customs`, pdfBytes);
  await prisma.return.update({
    where: { id: ret.id },
    data: { customsPdfKey: key },
  });
  return key;
}
