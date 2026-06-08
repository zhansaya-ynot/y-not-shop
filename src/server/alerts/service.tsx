import type { Shipment } from '@prisma/client';
import { prisma } from '../db/client';
import { env } from '../env';
import { getEmailService } from '../email';
import { sendTemplatedEmail } from '../email/send';
import { AdminAlertLabelFailure } from '@/emails/admin-alert-label-failure';
import { AdminAlertTrackingStale } from '@/emails/admin-alert-tracking-stale';
import { AdminAlertNewOrder } from '@/emails/admin-alert-new-order';

/** No `to:` recipient configured — caller is a no-op. */
function alertRecipient(): string | null {
  return env.ALERT_EMAIL ?? null;
}

/**
 * Recipients for new-order admin notifications. Reads `ADMIN_ORDER_RECIPIENTS`
 * (comma-separated list), falling back to `ALERT_EMAIL` when unset so the
 * single-recipient case still works without a new env var.
 *
 * Trims whitespace and drops empty entries so trailing commas are tolerated.
 */
function newOrderRecipients(): string[] {
  const raw = env.ADMIN_ORDER_RECIPIENTS ?? env.ALERT_EMAIL ?? '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Notify the operator that a Shipment has exhausted its label-creation
 * retries. Called from {@link tryCreateShipment} (Group H, Task 50) once
 * `attemptCount` hits {@link shouldGiveUp}.
 *
 * Spec §12.
 */
export async function sendLabelFailureAlert(shipment: Shipment): Promise<void> {
  const to = alertRecipient();
  if (!to) return;

  const order = await prisma.order.findUnique({ where: { id: shipment.orderId } });
  if (!order) return;

  await sendTemplatedEmail({
    service: getEmailService(),
    to,
    subject: `[YNOT alert] Label failed for order ${order.orderNumber}`,
    component: (
      <AdminAlertLabelFailure
        orderNumber={order.orderNumber}
        shipmentId={shipment.id}
        errorMessage={shipment.lastAttemptError ?? 'unknown'}
        adminUrl={`${env.NEXT_PUBLIC_SITE_URL}/admin/orders/${order.id}/ship`}
      />
    ),
  });
}

/**
 * Notify the operator that the tracking-sync cron has been failing for an
 * extended window. Called from the Group N `sync-tracking` job once the
 * consecutive-failure threshold is crossed. Spec §12.
 */
export async function sendTrackingStaleAlert(
  affectedCount: number,
  oldestStaleSinceHours: number,
): Promise<void> {
  const to = alertRecipient();
  if (!to) return;

  await sendTemplatedEmail({
    service: getEmailService(),
    to,
    subject: `[YNOT alert] Tracking sync stale (${affectedCount} orders)`,
    component: (
      <AdminAlertTrackingStale
        affectedCount={affectedCount}
        oldestStaleSinceHours={oldestStaleSinceHours}
        adminUrl={`${env.NEXT_PUBLIC_SITE_URL}/admin/orders?filter=needs-tracking-update`}
      />
    ),
  });
}

/**
 * Notify the operator(s) that a new paid order has come in. Mirrors the
 * legacy WordPress "New Order #N" admin email so Y Not Fashion keeps the
 * same operational workflow.
 *
 * Called from the Stripe webhook after `payment_intent.succeeded` has flipped
 * the order to NEW. Errors are swallowed by the caller so a transient Resend
 * failure can't roll back a successful payment.
 */
export async function sendNewOrderAlert(orderId: string): Promise<void> {
  const recipients = newOrderRecipients();
  if (recipients.length === 0) return;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, user: true },
  });
  if (!order) return;

  const customerEmail = order.user?.email ?? '';
  const items = order.items.map((i) => ({
    name: i.productName,
    size: i.size,
    qty: i.quantity,
    priceCents: i.unitPriceCents,
    isPreorder: i.isPreorder,
  }));

  const service = getEmailService();
  const subject = `[YNOT LONDON]: New order ${order.orderNumber}`;
  // Send a separate email per recipient so a single bounce doesn't suppress
  // delivery for the others. Loop sequentially to keep ordering predictable
  // in logs; the volume here is 2-3 admins per order, so concurrency isn't
  // worth the complication.
  for (const to of recipients) {
    await sendTemplatedEmail({
      service,
      to,
      subject,
      component: (
        <AdminAlertNewOrder
          orderNumber={order.orderNumber}
          customerName={`${order.shipFirstName} ${order.shipLastName}`.trim()}
          customerEmail={customerEmail}
          customerPhone={order.shipPhone}
          subtotalCents={order.subtotalCents}
          shippingCents={order.shippingCents}
          discountCents={order.discountCents}
          totalCents={order.totalCents}
          currency="GBP"
          items={items}
          shippingAddress={{
            line1: order.shipLine1,
            ...(order.shipLine2 ? { line2: order.shipLine2 } : {}),
            city: order.shipCity,
            postcode: order.shipPostcode,
            country: order.shipCountry,
          }}
          adminUrl={`${env.NEXT_PUBLIC_SITE_URL}/admin/orders/${order.id}`}
        />
      ),
    });
  }
}
