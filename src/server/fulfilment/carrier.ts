import { prisma } from '../db/client';
import type { LabelStorage } from './label-storage';
import type { DhlExpressProvider } from '../shipping/dhl-express';
import {
  type RoyalMailClickDropProvider,
  RoyalMailLabelApiUnavailableError,
} from '../shipping/royal-mail-click-drop';
import type {
  CreateShipmentInput,
  ShipmentParty,
} from '../shipping/provider';
import type { Order, OrderItem, Product } from '@prisma/client';

const DEFAULT_ITEM_WEIGHT_GRAMS = 500;

export interface CarrierServiceDeps {
  dhl: Pick<DhlExpressProvider, 'createShipment'>;
  rm: Pick<RoyalMailClickDropProvider, 'createShipment' | 'getLabel'>;
  storage: LabelStorage;
}

export interface CreateShipmentForOrderResult {
  trackingNumber: string;
  labelKey: string;
}

type ItemWithProduct = OrderItem & { product: Product | null };

function recipientFromOrder(order: Order): ShipmentParty {
  return {
    fullName: `${order.shipFirstName} ${order.shipLastName}`.trim(),
    addressLine1: order.shipLine1,
    ...(order.shipLine2 ? { addressLine2: order.shipLine2 } : {}),
    city: order.shipCity,
    postalCode: order.shipPostcode,
    countryCode: order.shipCountry,
    phone: order.shipPhone,
  };
}

function itemWeightGrams(it: ItemWithProduct): number {
  return it.product?.weightGrams ?? DEFAULT_ITEM_WEIGHT_GRAMS;
}

function buildCarrierInput(
  order: Order,
  items: ItemWithProduct[],
  isInternational: boolean,
): CreateShipmentInput {
  const subtotalCents = items.reduce((s, i) => s + i.unitPriceCents * i.quantity, 0);
  const weightGrams = items.reduce((s, i) => s + itemWeightGrams(i) * i.quantity, 0);
  return {
    orderRef: order.orderNumber,
    recipient: recipientFromOrder(order),
    items: items.map((i) => ({
      productSlug: i.productSlug,
      name: i.productName,
      sku: i.productSlug,
      quantity: i.quantity,
      unitPriceCents: i.unitPriceCents,
      weightGrams: itemWeightGrams(i),
      hsCode: i.product?.hsCode ?? null,
      countryOfOriginCode: i.product?.countryOfOriginCode ?? null,
    })),
    weightGrams,
    subtotalCents,
    declaredValueCents: subtotalCents,
    isInternational,
  };
}

/**
 * Generate a carrier label for a single Shipment, persist tracking + label
 * storage key, and append a `label_created` ShipmentEvent.
 *
 * Idempotent: if `Shipment.labelGeneratedAt` is already set the existing
 * tracking + key are returned without recontacting the carrier.
 *
 * Failure handling lives one layer up in `tryCreateShipment` (Task 50) — this
 * function lets exceptions propagate so the caller can apply the retry/backoff
 * + alert policy (spec §12).
 */
export async function createShipmentForOrder(
  shipmentId: string,
  deps: CarrierServiceDeps,
): Promise<CreateShipmentForOrderResult> {
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    include: { order: true, items: { include: { product: true } } },
  });
  if (!shipment) {
    throw new Error(`Shipment ${shipmentId} not found`);
  }
  if (shipment.labelGeneratedAt) {
    return {
      trackingNumber: shipment.trackingNumber!,
      labelKey: shipment.labelStorageKey!,
    };
  }

  const isInternational = shipment.order.shipCountry !== 'GB';
  const carrierInput = buildCarrierInput(shipment.order, shipment.items, isInternational);

  let trackingNumber: string;
  let labelBytes: Buffer;

  if (shipment.carrier === 'DHL') {
    const result = await deps.dhl.createShipment(carrierInput);
    trackingNumber = result.trackingNumber;
    labelBytes = result.labelPdfBytes;
    if (result.customsInvoicePdfBytes) {
      await deps.storage.put(`${shipment.id}-customs`, result.customsInvoicePdfBytes);
    }
  } else {
    const result = await deps.rm.createShipment(carrierInput);
    trackingNumber = result.trackingNumber;
    try {
      labelBytes = await deps.rm.getLabel(result.rmOrderId);
    } catch (err) {
      if (err instanceof RoyalMailLabelApiUnavailableError) {
        // Basic Click & Drop tier — no programmatic label access. Save the
        // RM order id (in the trackingNumber column for now; nothing else on
        // Shipment is meant for it) so the operator can find it in the C&D
        // dashboard, then re-throw so tryCreateShipment records the
        // manual-print instruction in lastAttemptError.
        await prisma.shipment.update({
          where: { id: shipmentId },
          data: { trackingNumber: result.rmOrderId },
        });
      }
      throw err;
    }
  }

  const labelKey = await deps.storage.put(shipment.id, labelBytes);

  await prisma.$transaction([
    prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        trackingNumber,
        labelStorageKey: labelKey,
        labelGeneratedAt: new Date(),
      },
    }),
    prisma.shipmentEvent.create({
      data: {
        shipmentId,
        status: 'label_created',
        occurredAt: new Date(),
      },
    }),
  ]);

  return { trackingNumber, labelKey };
}
