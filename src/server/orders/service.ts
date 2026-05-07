import * as React from 'react';
import type { OrderStatus, Prisma } from '@prisma/client';
import { prisma } from '@/server/db/client';
import { sendTemplatedEmail } from '@/server/email/send';
import { getEmailService } from '@/server/email';
import type { EmailService } from '@/server/email';
import { OrderCancelled } from '@/emails/order-cancelled';
import { assertTransition } from './state-machine';

/**
 * Move an Order to a new status. Validated against the state machine in
 * {@link assertTransition}. Writes an `OrderStatusEvent` row in the same
 * transaction. Same-state calls are a no-op (no event written).
 */
export async function updateStatus(
  orderId: string,
  to: OrderStatus,
  note?: string,
): Promise<void> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error(`Order ${orderId} not found`);
  if (order.status === to) return;
  assertTransition(order.status, to);
  await prisma.$transaction([
    prisma.order.update({ where: { id: orderId }, data: { status: to } }),
    prisma.orderStatusEvent.create({
      data: { orderId, status: to, note: note ?? null },
    }),
  ]);
}

export interface CancelOrderDeps {
  /**
   * Refund the order in full via Stripe. Defaults to the real
   * `RefundService.refundFull` once Group L lands; tests inject a mock.
   * Optional because Group L (Task 68) hasn't been merged yet — production
   * call sites pass the real implementation explicitly.
   */
  refundFull?: (orderId: string, reason: string) => Promise<void>;
  /** Override the email transport; defaults to `getEmailService()`. */
  emailService?: EmailService;
}

const CANCELLABLE: OrderStatus[] = ['NEW', 'PROCESSING', 'PARTIALLY_SHIPPED'];

/**
 * Admin cancel: terminate an order pre-despatch.
 *
 * - Marks every un-shipped Shipment `cancelledAt = now`.
 * - Restocks every OrderItem (reverses Phase 4's checkout decrement).
 * - Transitions Order → CANCELLED + OrderStatusEvent (`admin:<actorId>: <reason>`).
 * - Refunds the captured Payment in full (best-effort; deps-injected so the
 *   site test can pass before Group L exists).
 * - Sends an OrderCancelled email if the customer has a usable address.
 *
 * Throws if the order isn't in a cancellable status. Once SHIPPED, use the
 * returns flow instead — recall is irreversible.
 */
export async function cancelOrder(
  orderId: string,
  reason: string,
  actorId: string,
  deps: CancelOrderDeps = {},
): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, shipments: true, user: true, payment: true },
  });
  if (!order) throw new Error(`Order ${orderId} not found`);
  if (!CANCELLABLE.includes(order.status)) {
    throw new Error(
      `Cannot cancel order ${order.orderNumber} in status ${order.status}`,
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.shipment.updateMany({
      where: { orderId, shippedAt: null, cancelledAt: null },
      data: { cancelledAt: new Date() },
    });
    for (const item of order.items) {
      if (!item.productId) continue;
      await tx.productSize.update({
        where: { productId_size: { productId: item.productId, size: item.size } },
        data: { stock: { increment: item.quantity } },
      });
    }
    await tx.order.update({ where: { id: orderId }, data: { status: 'CANCELLED' } });
    await tx.orderStatusEvent.create({
      data: { orderId, status: 'CANCELLED', note: `admin:${actorId}: ${reason}` },
    });
  });

  if (order.payment && order.payment.status === 'CAPTURED' && deps.refundFull) {
    await deps.refundFull(order.id, 'admin_cancel');
  }

  const recipient = order.user?.email ?? null;
  if (recipient) {
    const emailService = deps.emailService ?? getEmailService();
    await sendTemplatedEmail({
      service: emailService,
      to: recipient,
      subject: `Your order ${order.orderNumber} has been cancelled`,
      component: React.createElement(OrderCancelled, {
        orderNumber: order.orderNumber,
        customerName: order.shipFirstName,
        refundAmountCents: order.totalCents,
        refundEtaDays: 3,
        reasonShort: reason,
      }),
    });
  }
}

export interface ListForAdminOpts {
  status?: OrderStatus;
  carrier?: 'ROYAL_MAIL' | 'DHL';
  country?: string;
  search?: string;
  cursor?: string;
  limit?: number;
}

/**
 * Paginated admin order list. Cursor-based on `Order.id`; sorted newest first.
 *
 * Filters compose with AND. The `search` filter is a case-insensitive
 * substring match across order number, customer surname, and tracking number.
 * Default limit is 50.
 */
export async function listForAdmin(opts: ListForAdminOpts) {
  const where: Prisma.OrderWhereInput = {};
  if (opts.status) where.status = opts.status;
  if (opts.carrier) where.carrier = opts.carrier;
  if (opts.country) where.shipCountry = opts.country;
  if (opts.search) {
    where.OR = [
      { orderNumber: { contains: opts.search, mode: 'insensitive' } },
      { shipLastName: { contains: opts.search, mode: 'insensitive' } },
      { trackingNumber: { contains: opts.search, mode: 'insensitive' } },
    ];
  }
  return prisma.order.findMany({
    where,
    take: opts.limit ?? 50,
    skip: opts.cursor ? 1 : 0,
    cursor: opts.cursor ? { id: opts.cursor } : undefined,
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { email: true, name: true } },
      shipments: { select: { id: true, trackingNumber: true, carrier: true } },
    },
  });
}

/**
 * Full order detail for the admin order screen. Eager-loads the bits the
 * Phase 5 admin pages render: items (with product weight for label preview),
 * every shipment with its events, payment, status history, refund events,
 * and returns.
 */
export async function getForAdmin(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: { include: { product: { select: { weightGrams: true } } } },
      shipments: { include: { events: { orderBy: { occurredAt: 'asc' } } } },
      payment: true,
      events: { orderBy: { createdAt: 'asc' } },
      refundEvents: { orderBy: { createdAt: 'asc' } },
      returns: {
        orderBy: { createdAt: 'desc' },
        include: { items: { include: { orderItem: true } } },
      },
      user: { select: { id: true, email: true, name: true } },
    },
  });
}

export type AdminOrderSummary = Awaited<ReturnType<typeof listForAdmin>>[number];
export type AdminOrderDetail = Awaited<ReturnType<typeof getForAdmin>>;
