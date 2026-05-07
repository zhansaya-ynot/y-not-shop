import type { OrderStatus } from '@prisma/client';
import { prisma } from '@/server/db/client';

/**
 * Order statuses that count toward revenue. Cancelled / failed-payment /
 * pending-payment are deliberately excluded so the operator's tiles match
 * the money actually captured.
 */
const REVENUE_STATUSES: OrderStatus[] = [
  'NEW',
  'PROCESSING',
  'PARTIALLY_SHIPPED',
  'SHIPPED',
  'PARTIALLY_DELIVERED',
  'DELIVERED',
  'RETURNED',
];

/**
 * UTC start-of-day for the date `at` falls in. We deliberately treat the
 * day boundary as UTC — the shop is GMT/BST so this is approximate, but
 * it removes ambiguity at server boot and keeps the tiles deterministic.
 */
function startOfUtcDay(at: Date): Date {
  return new Date(
    Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()),
  );
}

/** UTC start-of-week (Monday). */
function startOfUtcWeek(at: Date): Date {
  const day = startOfUtcDay(at);
  // getUTCDay: 0=Sun, 1=Mon, ..., 6=Sat. Convert so Monday is 0.
  const offset = (day.getUTCDay() + 6) % 7;
  day.setUTCDate(day.getUTCDate() - offset);
  return day;
}

/** UTC start-of-month. */
function startOfUtcMonth(at: Date): Date {
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1));
}

export interface OverviewKpis {
  revenueTodayCents: number;
  revenueWeekCents: number;
  revenueMonthCents: number;
  ordersToday: number;
  ordersWeek: number;
  averageOrderValueMonthCents: number;
  outstandingShipments: number;
}

/**
 * Compute the seven KPI tiles displayed at the top of /admin. All revenue
 * figures exclude cancelled / failed / unpaid orders. AOV is monthly so it
 * doesn't whiplash on a slow morning.
 */
export async function getOverviewKpis(now: Date = new Date()): Promise<OverviewKpis> {
  const todayStart = startOfUtcDay(now);
  const weekStart = startOfUtcWeek(now);
  const monthStart = startOfUtcMonth(now);

  const [today, week, month, ordersTodayCount, ordersWeekCount, outstandingShipments] =
    await Promise.all([
      prisma.order.aggregate({
        where: {
          createdAt: { gte: todayStart },
          status: { in: REVENUE_STATUSES },
        },
        _sum: { totalCents: true },
        _count: { _all: true },
      }),
      prisma.order.aggregate({
        where: {
          createdAt: { gte: weekStart },
          status: { in: REVENUE_STATUSES },
        },
        _sum: { totalCents: true },
        _count: { _all: true },
      }),
      prisma.order.aggregate({
        where: {
          createdAt: { gte: monthStart },
          status: { in: REVENUE_STATUSES },
        },
        _sum: { totalCents: true },
        _count: { _all: true },
      }),
      prisma.order.count({
        where: {
          createdAt: { gte: todayStart },
          status: { in: REVENUE_STATUSES },
        },
      }),
      prisma.order.count({
        where: {
          createdAt: { gte: weekStart },
          status: { in: REVENUE_STATUSES },
        },
      }),
      // "Paid order, no label yet" — operator still needs to print + despatch.
      prisma.shipment.count({
        where: {
          labelGeneratedAt: null,
          cancelledAt: null,
          order: { status: { in: REVENUE_STATUSES } },
        },
      }),
    ]);

  const monthSum = month._sum.totalCents ?? 0;
  const monthCount = month._count._all;
  const aov = monthCount > 0 ? Math.round(monthSum / monthCount) : 0;

  return {
    revenueTodayCents: today._sum.totalCents ?? 0,
    revenueWeekCents: week._sum.totalCents ?? 0,
    revenueMonthCents: monthSum,
    ordersToday: ordersTodayCount,
    ordersWeek: ordersWeekCount,
    averageOrderValueMonthCents: aov,
    outstandingShipments,
  };
}

export interface RecentOrderRow {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  totalCents: number;
  createdAt: Date;
  customerName: string;
}

/**
 * Last 10 orders for the dashboard "Recent orders" card. Includes
 * cancelled / failed orders deliberately so the operator can spot
 * suspicious activity.
 */
export async function getRecentOrders(limit = 10): Promise<RecentOrderRow[]> {
  const rows = await prisma.order.findMany({
    take: limit,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      totalCents: true,
      createdAt: true,
      shipFirstName: true,
      shipLastName: true,
    },
  });
  return rows.map((r) => ({
    id: r.id,
    orderNumber: r.orderNumber,
    status: r.status,
    totalCents: r.totalCents,
    createdAt: r.createdAt,
    customerName: `${r.shipFirstName} ${r.shipLastName}`.trim(),
  }));
}

export interface TopProductRow {
  productId: string;
  productName: string;
  units: number;
  revenueCents: number;
}

/**
 * Top 5 products by revenue this month. Operates on OrderItem rows whose
 * parent Order created this month and counts toward revenue.
 */
export async function getTopProducts(
  now: Date = new Date(),
  limit = 5,
): Promise<TopProductRow[]> {
  const monthStart = startOfUtcMonth(now);

  // Pull all relevant order items in one query, then aggregate in JS.
  // Volume is small (one month of items) and groupBy doesn't compose with
  // multiplication of unitPriceCents * quantity directly.
  const items = await prisma.orderItem.findMany({
    where: {
      productId: { not: null },
      order: {
        createdAt: { gte: monthStart },
        status: { in: REVENUE_STATUSES },
      },
    },
    select: {
      productId: true,
      productName: true,
      unitPriceCents: true,
      quantity: true,
    },
  });

  const byProduct = new Map<string, { name: string; units: number; revenueCents: number }>();
  for (const it of items) {
    if (!it.productId) continue;
    const cur = byProduct.get(it.productId) ?? {
      name: it.productName,
      units: 0,
      revenueCents: 0,
    };
    cur.units += it.quantity;
    cur.revenueCents += it.unitPriceCents * it.quantity;
    byProduct.set(it.productId, cur);
  }

  const ranked = Array.from(byProduct.entries())
    .map(([productId, v]) => ({
      productId,
      productName: v.name,
      units: v.units,
      revenueCents: v.revenueCents,
    }))
    .sort((a, b) => b.revenueCents - a.revenueCents)
    .slice(0, limit);

  return ranked;
}
