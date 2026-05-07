import type { Prisma, UserRole, OrderStatus } from '@prisma/client';
import { prisma } from '@/server/db/client';

/**
 * Order statuses that are NOT counted toward lifetime spend or order counts.
 * Cancelled / failed payments / unpaid pendings inflate the figures
 * misleadingly — we only count revenue we actually captured.
 */
const NON_REVENUE_STATUSES: OrderStatus[] = [
  'CANCELLED',
  'PAYMENT_FAILED',
  'PENDING_PAYMENT',
];

export interface ListCustomersOpts {
  search?: string;
  role?: UserRole;
  hideGuests?: boolean;
  cursor?: string;
  limit?: number;
}

export interface AdminCustomerSummary {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  isGuest: boolean;
  createdAt: Date;
  ordersCount: number;
  lifetimeSpendCents: number;
  lastOrderAt: Date | null;
}

/**
 * Paginated admin customer list. Cursor-based on `User.id`; sorted newest-first.
 *
 * `lifetimeSpendCents` and `ordersCount` exclude cancelled / failed-payment /
 * pending-payment orders so the figures reflect actual captured revenue.
 * `lastOrderAt` reflects the newest order regardless of status (operationally
 * useful — "did this customer buy recently, even if they cancelled?").
 *
 * Soft-deleted users (deletedAt != null) are filtered out.
 */
export async function listCustomersForAdmin(
  opts: ListCustomersOpts,
): Promise<AdminCustomerSummary[]> {
  const where: Prisma.UserWhereInput = { deletedAt: null };
  if (opts.role) where.role = opts.role;
  if (opts.hideGuests) where.isGuest = false;
  if (opts.search) {
    where.OR = [
      { email: { contains: opts.search, mode: 'insensitive' } },
      { name: { contains: opts.search, mode: 'insensitive' } },
    ];
  }

  const users = await prisma.user.findMany({
    where,
    take: opts.limit ?? 50,
    skip: opts.cursor ? 1 : 0,
    cursor: opts.cursor ? { id: opts.cursor } : undefined,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isGuest: true,
      createdAt: true,
    },
  });

  if (users.length === 0) return [];

  const userIds = users.map((u) => u.id);

  // Two parallel aggregations: one for revenue (filtered) and one for "last
  // order" (any status). Keeps each query indexed by [userId, createdAt].
  const [revenueAgg, lastOrders] = await Promise.all([
    prisma.order.groupBy({
      by: ['userId'],
      where: {
        userId: { in: userIds },
        status: { notIn: NON_REVENUE_STATUSES },
      },
      _sum: { totalCents: true },
      _count: { _all: true },
    }),
    prisma.order.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds } },
      _max: { createdAt: true },
    }),
  ]);

  const revenueByUser = new Map<string, { sum: number; count: number }>();
  for (const r of revenueAgg) {
    if (!r.userId) continue;
    revenueByUser.set(r.userId, {
      sum: r._sum.totalCents ?? 0,
      count: r._count._all,
    });
  }
  const lastOrderByUser = new Map<string, Date>();
  for (const r of lastOrders) {
    if (!r.userId || !r._max.createdAt) continue;
    lastOrderByUser.set(r.userId, r._max.createdAt);
  }

  return users.map((u) => {
    const rev = revenueByUser.get(u.id);
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      isGuest: u.isGuest,
      createdAt: u.createdAt,
      ordersCount: rev?.count ?? 0,
      lifetimeSpendCents: rev?.sum ?? 0,
      lastOrderAt: lastOrderByUser.get(u.id) ?? null,
    };
  });
}

export interface AdminCustomerOrder {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  totalCents: number;
  createdAt: Date;
}

export interface AdminCustomerAddress {
  line1: string;
  line2: string | null;
  city: string;
  postcode: string;
  country: string;
  firstName: string;
  lastName: string;
}

export interface AdminCustomerDetail {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  isGuest: boolean;
  createdAt: Date;
  ordersCount: number;
  lifetimeSpendCents: number;
  averageOrderValueCents: number;
  returnsCount: number;
  orders: AdminCustomerOrder[];
  addresses: AdminCustomerAddress[];
}

/**
 * Full customer detail for /admin/customers/[id]: profile + revenue stats +
 * complete order history + de-duplicated shipping addresses extracted from
 * orders (User.addresses isn't always populated for guest checkouts).
 *
 * Returns null when the user doesn't exist or is soft-deleted.
 */
export async function getCustomerForAdmin(
  userId: string,
): Promise<AdminCustomerDetail | null> {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isGuest: true,
      createdAt: true,
    },
  });
  if (!user) return null;

  const orders = await prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      totalCents: true,
      createdAt: true,
      shipFirstName: true,
      shipLastName: true,
      shipLine1: true,
      shipLine2: true,
      shipCity: true,
      shipPostcode: true,
      shipCountry: true,
    },
  });

  const revenueOrders = orders.filter(
    (o) => !NON_REVENUE_STATUSES.includes(o.status),
  );
  const lifetimeSpendCents = revenueOrders.reduce(
    (acc, o) => acc + o.totalCents,
    0,
  );
  const ordersCount = revenueOrders.length;
  const averageOrderValueCents =
    ordersCount > 0 ? Math.round(lifetimeSpendCents / ordersCount) : 0;

  const returnsCount = await prisma.return.count({
    where: { order: { userId } },
  });

  // Dedupe addresses by lowercase line1 + postcode key.
  const seen = new Set<string>();
  const addresses: AdminCustomerAddress[] = [];
  for (const o of orders) {
    const key = `${o.shipLine1.toLowerCase()}|${o.shipPostcode.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    addresses.push({
      firstName: o.shipFirstName,
      lastName: o.shipLastName,
      line1: o.shipLine1,
      line2: o.shipLine2 ?? null,
      city: o.shipCity,
      postcode: o.shipPostcode,
      country: o.shipCountry,
    });
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isGuest: user.isGuest,
    createdAt: user.createdAt,
    ordersCount,
    lifetimeSpendCents,
    averageOrderValueCents,
    returnsCount,
    orders: orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      totalCents: o.totalCents,
      createdAt: o.createdAt,
    })),
    addresses,
  };
}
