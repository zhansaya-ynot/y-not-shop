import type { Prisma } from '@prisma/client';
import { prisma } from '@/server/db/client';
import type {
  TryCreateShipmentDeps,
  TryCreateShipmentResult,
} from '@/server/fulfilment/service';

/**
 * Subset of Prisma client needed by {@link assignItemToBatch} — accepts both
 * the top-level `prisma` and a tx client so callers (cart `addItem`, checkout)
 * can run the lookup inside their own transaction.
 */
type AssignBatchClient =
  | Pick<Prisma.TransactionClient, 'preorderBatch'>
  | typeof prisma;

/**
 * Find the active {@link PreorderBatch} a preorder line should join.
 *
 * Eligibility (spec §9.2):
 * - `productId` matches the cart/order item
 * - `status` ∈ { `PENDING`, `IN_PRODUCTION` } — `SHIPPING` and `COMPLETED`
 *   are closed for new assignments
 * - earliest `estimatedShipFrom` wins (so the customer gets the soonest
 *   despatch slot)
 *
 * Returns `null` when no active batch exists for the product. Callers (cart
 * `addItem` + checkout `createOrderAndPaymentIntent`) treat `null` as
 * "either don't allow preorder for this product, or hold the item with a
 * dangling `preorderBatchId = null`" — that decision is upstream.
 */
export async function assignItemToBatch(
  productId: string,
  client: AssignBatchClient = prisma,
): Promise<string | null> {
  const batch = await client.preorderBatch.findFirst({
    where: {
      productId,
      status: { in: ['PENDING', 'IN_PRODUCTION'] },
    },
    orderBy: { estimatedShipFrom: 'asc' },
    select: { id: true },
  });
  if (batch) return batch.id;

  // No active batch yet — create a default PENDING one so the order has a
  // home. Operator can later edit the dates / capacity in /admin (TODO Group
  // M). Without this auto-create, every preorder line lands with
  // preorderBatchId=null, the shipment splitter drops it, and the order
  // shows "No shipments yet" forever even after payment.
  const now = new Date();
  const ship = new Date(now);
  ship.setDate(ship.getDate() + 28); // 4-week default lead time
  const created = await client.preorderBatch.create({
    data: {
      name: `Auto batch ${now.toISOString().slice(0, 10)}`,
      productId,
      status: 'PENDING',
      estimatedShipFrom: ship,
      estimatedShipTo: new Date(ship.getTime() + 14 * 86_400_000), // +2 weeks window
    },
    select: { id: true },
  });
  return created.id;
}

export interface ReleaseBatchForShippingDeps {
  /**
   * Inject `tryCreateShipment` from `@/server/fulfilment/service` (Group H).
   * Deps-injected so this module doesn't pull the carrier providers into the
   * preorder unit tests, and so a CLI / cron caller can substitute a dry-run
   * stub.
   */
  tryCreateShipment: (
    shipmentId: string,
    deps: TryCreateShipmentDeps,
  ) => Promise<TryCreateShipmentResult>;
  shipmentDeps: TryCreateShipmentDeps;
}

export interface ReleaseBatchForShippingResult {
  batchId: string;
  shipmentIds: string[];
  /** Per-shipment outcome from `tryCreateShipment`. */
  results: Array<{ shipmentId: string; result: TryCreateShipmentResult }>;
}

/**
 * Mark a {@link PreorderBatch} as `SHIPPING` and kick off label creation for
 * every Shipment that holds at least one OrderItem assigned to the batch.
 *
 * Idempotent w.r.t. shipments that have already been labelled —
 * `tryCreateShipment` short-circuits when `labelGeneratedAt` is set.
 *
 * Per-shipment failures are captured in the returned `results` array; this
 * function never throws on a single carrier failure (the alert pipeline
 * inside `tryCreateShipment` handles operator notification on give-up).
 */
export async function releaseBatchForShipping(
  batchId: string,
  deps: ReleaseBatchForShippingDeps,
): Promise<ReleaseBatchForShippingResult> {
  const batch = await prisma.preorderBatch.findUnique({
    where: { id: batchId },
  });
  if (!batch) throw new Error(`PreorderBatch ${batchId} not found`);
  if (batch.status === 'COMPLETED') {
    throw new Error(`PreorderBatch ${batchId} is already COMPLETED`);
  }

  await prisma.preorderBatch.update({
    where: { id: batchId },
    data: { status: 'SHIPPING' },
  });

  const items = await prisma.orderItem.findMany({
    where: { preorderBatchId: batchId, shipmentId: { not: null } },
    select: { shipmentId: true },
  });
  const shipmentIds = Array.from(
    new Set(items.map((i) => i.shipmentId).filter((s): s is string => !!s)),
  );

  const results: ReleaseBatchForShippingResult['results'] = [];
  for (const shipmentId of shipmentIds) {
    const result = await deps.tryCreateShipment(shipmentId, deps.shipmentDeps);
    results.push({ shipmentId, result });
  }

  return { batchId, shipmentIds, results };
}
