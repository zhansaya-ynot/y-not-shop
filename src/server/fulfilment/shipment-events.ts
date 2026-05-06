import type { Carrier, Shipment } from '@prisma/client';
import { prisma } from '@/server/db/client';
import { enqueueEmailJob } from '@/server/email/jobs';
import { updateStatus } from '@/server/orders/service';

/**
 * Customer-facing tracking URL builder. Carrier-specific deep-links so the
 * `OrderShipped` email's CTA goes straight to the carrier's tracking page.
 */
export function buildTrackingUrl(
  carrier: Carrier,
  trackingNumber: string,
): string {
  if (carrier === 'DHL') {
    return `https://www.dhl.com/track?trackingNumber=${encodeURIComponent(trackingNumber)}`;
  }
  // Royal Mail's public tracking URL accepts the tracking number directly.
  return `https://www.royalmail.com/track-your-item#/tracking-results/${encodeURIComponent(trackingNumber)}`;
}

/**
 * Build the EmailJob payload for an OrderShipped email and enqueue it. Uses
 * a stable `dedupKey` so re-running the admin "resend tracking email" flow
 * (or a flaky retry) won't duplicate the customer's inbox.
 *
 * Returns true if a fresh job was created, false if the dedup key matched a
 * pre-existing PENDING/SENT row.
 */
export async function enqueueOrderShippedEmail(opts: {
  shipment: Shipment;
  /** When true, bypass the dedup gate (used by admin "resend"). */
  force?: boolean;
}): Promise<boolean> {
  const { shipment, force = false } = opts;
  if (!shipment.trackingNumber) return false;

  const order = await prisma.order.findUnique({
    where: { id: shipment.orderId },
    include: {
      user: { select: { email: true } },
      items: true,
    },
  });
  if (!order || !order.user?.email) return false;

  const itemsForShipment = order.items.filter(
    (i) => i.shipmentId === shipment.id,
  );
  const itemsCount = itemsForShipment.length || order.items.length;

  // For admin-driven resends, append a timestamp to break dedup; the operator
  // chose to re-fire deliberately.
  const dedupKey = force
    ? `OrderShipped:${shipment.id}:${Date.now()}`
    : `OrderShipped:${shipment.id}`;

  const before = await prisma.emailJob.count({
    where: {
      template: 'OrderShipped',
      cancelReason: dedupKey,
      status: { in: ['PENDING', 'SENT'] },
    },
  });

  await enqueueEmailJob({
    template: 'OrderShipped',
    recipientEmail: order.user.email,
    payload: {
      orderNumber: order.orderNumber,
      customerName: order.shipFirstName,
      carrier: shipment.carrier,
      trackingNumber: shipment.trackingNumber,
      trackingUrl: buildTrackingUrl(shipment.carrier, shipment.trackingNumber),
      itemsCount,
      ...(order.estimatedDeliveryDate
        ? { estimatedDelivery: order.estimatedDeliveryDate.toDateString() }
        : {}),
    },
    dispatchAt: new Date(),
    dedupKey,
  });
  return before === 0;
}

/**
 * Enqueue the OrderDelivered email for a shipment that just landed at the
 * customer's door. Mirrors enqueueOrderShippedEmail's dedup pattern.
 */
export async function enqueueOrderDeliveredEmail(opts: {
  shipment: Shipment;
}): Promise<boolean> {
  const { shipment } = opts;
  const order = await prisma.order.findUnique({
    where: { id: shipment.orderId },
    include: {
      user: { select: { email: true } },
    },
  });
  if (!order || !order.user?.email) return false;

  await enqueueEmailJob({
    template: 'OrderDelivered',
    recipientEmail: order.user.email,
    payload: {
      orderNumber: order.orderNumber,
      customerName: order.shipFirstName,
    },
    dispatchAt: new Date(),
    dedupKey: `OrderDelivered:${shipment.id}`,
  });
  return true;
}

/**
 * Apply a manual tracking-status override.
 *
 * - `IN_TRANSIT` (or first-time event with `shippedAt = null`): sets
 *   `Shipment.shippedAt = now`, appends a ShipmentEvent, enqueues the
 *   `OrderShipped` email, and walks the parent Order forward
 *   (NEW/PROCESSING → SHIPPED, or PARTIALLY_SHIPPED if siblings remain).
 * - `DELIVERED`: sets `deliveredAt = now`, appends a ShipmentEvent, walks
 *   the order to PARTIALLY_DELIVERED / DELIVERED based on siblings.
 * - `OUT_FOR_DELIVERY` / `EXCEPTION`: ShipmentEvent only.
 *
 * Idempotent: re-applying the same status doesn't bump shippedAt /
 * deliveredAt (those are only set when null) and the dedup-keyed email
 * enqueue swallows duplicates.
 */
export async function applyManualShipmentStatus(
  shipmentId: string,
  status: 'IN_TRANSIT' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'EXCEPTION',
  actorId: string,
): Promise<void> {
  const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId } });
  if (!shipment) throw new Error(`Shipment ${shipmentId} not found`);

  const now = new Date();
  const data: { shippedAt?: Date; deliveredAt?: Date } = {};
  if (status === 'IN_TRANSIT' && !shipment.shippedAt) {
    data.shippedAt = now;
  }
  if (status === 'DELIVERED') {
    if (!shipment.shippedAt) data.shippedAt = now;
    if (!shipment.deliveredAt) data.deliveredAt = now;
  }

  if (Object.keys(data).length > 0) {
    await prisma.shipment.update({ where: { id: shipmentId }, data });
  }
  await prisma.shipmentEvent.create({
    data: {
      shipmentId,
      status,
      description: `admin:${actorId}`,
      occurredAt: now,
    },
  });

  // Re-read so downstream sees the updated row.
  const fresh = await prisma.shipment.findUniqueOrThrow({ where: { id: shipmentId } });

  if (status === 'IN_TRANSIT' || (status === 'DELIVERED' && !shipment.shippedAt)) {
    await enqueueOrderShippedEmail({ shipment: fresh });
    await reconcileShipped(fresh.orderId);
  }
  if (status === 'DELIVERED') {
    // Send delivered email only the first time deliveredAt was set this call —
    // re-firing DELIVERED on an already-delivered shipment is a no-op.
    if (!shipment.deliveredAt) {
      await enqueueOrderDeliveredEmail({ shipment: fresh });
    }
    await reconcileDelivered(fresh.orderId);
  }
}

async function reconcileShipped(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { shipments: true },
  });
  if (!order) return;
  const active = order.shipments.filter((s) => !s.cancelledAt);
  if (active.length === 0) return;
  const shipped = active.filter((s) => s.shippedAt);

  // Walk NEW → PROCESSING first so we can then take PROCESSING →
  // SHIPPED/PARTIALLY_SHIPPED in this same reconciliation pass (the state
  // machine forbids skipping PROCESSING).
  let current = order.status;
  if (current === 'NEW' && shipped.length > 0) {
    await updateStatus(orderId, 'PROCESSING', 'admin: label generated');
    current = 'PROCESSING';
  }

  if (shipped.length === active.length) {
    if (current === 'PROCESSING' || current === 'PARTIALLY_SHIPPED') {
      await updateStatus(orderId, 'SHIPPED', 'admin: all shipments despatched');
    }
  } else if (shipped.length > 0) {
    if (current === 'PROCESSING') {
      await updateStatus(orderId, 'PARTIALLY_SHIPPED', 'admin: partial despatch');
    }
  }
}

async function reconcileDelivered(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { shipments: true },
  });
  if (!order) return;
  const active = order.shipments.filter((s) => !s.cancelledAt);
  if (active.length === 0) return;
  const delivered = active.filter((s) => s.deliveredAt);
  if (delivered.length === active.length) {
    if (order.status !== 'DELIVERED') {
      await updateStatus(orderId, 'DELIVERED', 'admin: all shipments delivered');
    }
  } else if (delivered.length > 0) {
    if (order.status === 'SHIPPED' || order.status === 'PARTIALLY_SHIPPED') {
      await updateStatus(orderId, 'PARTIALLY_DELIVERED', 'admin: partial delivery');
    }
  }
}
