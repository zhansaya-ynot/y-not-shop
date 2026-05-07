import * as React from "react";
import Link from "next/link";
import {
  getOverviewKpis,
  getRecentOrders,
  getTopProducts,
} from "@/server/dashboard/service";

export const dynamic = "force-dynamic";

/**
 * Operations dashboard. Real-time KPIs replace the previous tile snapshot.
 *
 * Top tiles: today/week/month revenue, orders today, orders week, average
 * order value (this month), outstanding shipments. Below: recent orders
 * (last 10) and top products this month (top 5 by revenue).
 *
 * All Prisma queries fan out in parallel via Promise.all in the loaders.
 * Page is `force-dynamic` because the KPIs must reflect new orders the
 * moment they land — no ISR window.
 */

function formatGbp(cents: number): string {
  return `£${(cents / 100).toFixed(2)}`;
}

function nowSnapshot(): Date {
  return new Date();
}

const STATUS_BADGE: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-800 border-blue-200",
  PROCESSING: "bg-blue-100 text-blue-800 border-blue-200",
  PARTIALLY_SHIPPED: "bg-blue-100 text-blue-800 border-blue-200",
  SHIPPED: "bg-purple-100 text-purple-800 border-purple-200",
  PARTIALLY_DELIVERED: "bg-purple-100 text-purple-800 border-purple-200",
  DELIVERED: "bg-green-100 text-green-800 border-green-200",
  PENDING_PAYMENT: "bg-yellow-100 text-yellow-800 border-yellow-200",
  PAYMENT_FAILED: "bg-red-100 text-red-800 border-red-200",
  RETURNED: "bg-neutral-200 text-neutral-700 border-neutral-300",
  CANCELLED: "bg-neutral-200 text-neutral-700 border-neutral-300",
};

export default async function AdminDashboard() {
  const now = nowSnapshot();
  const [kpis, recent, top] = await Promise.all([
    getOverviewKpis(now),
    getRecentOrders(10),
    getTopProducts(now, 5),
  ]);

  const tiles: Array<{
    label: string;
    value: string;
    href?: string;
    tone?: "warn";
  }> = [
    { label: "Revenue today", value: formatGbp(kpis.revenueTodayCents) },
    { label: "Revenue this week", value: formatGbp(kpis.revenueWeekCents) },
    { label: "Revenue this month", value: formatGbp(kpis.revenueMonthCents) },
    { label: "Orders today", value: kpis.ordersToday.toString() },
    { label: "Orders this week", value: kpis.ordersWeek.toString() },
    {
      label: "Avg order value (month)",
      value: formatGbp(kpis.averageOrderValueMonthCents),
    },
    {
      label: "Outstanding shipments",
      value: kpis.outstandingShipments.toString(),
      // Filter for orders that still need a label printed.
      href: "/admin/orders?status=NEW",
      tone: kpis.outstandingShipments > 0 ? "warn" : undefined,
    },
  ];

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-semibold">Dashboard</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {tiles.map((t) => {
          const inner = (
            <div
              className={
                "rounded-lg border p-5 bg-white h-full " +
                (t.tone === "warn"
                  ? "border-amber-300"
                  : "border-neutral-200") +
                (t.href ? " hover:shadow transition-shadow" : "")
              }
            >
              <div className="text-[11px] uppercase tracking-widest text-neutral-500">
                {t.label}
              </div>
              <div
                className={
                  "mt-2 text-2xl font-semibold " +
                  (t.tone === "warn"
                    ? "text-amber-600"
                    : "text-neutral-900")
                }
              >
                {t.value}
              </div>
            </div>
          );
          return t.href ? (
            <Link key={t.label} href={t.href} className="block">
              {inner}
            </Link>
          ) : (
            <div key={t.label}>{inner}</div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white border border-neutral-200 rounded-lg p-5">
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="font-semibold">Recent orders</h3>
            <Link
              href="/admin/orders"
              className="text-xs underline text-neutral-500"
            >
              All orders →
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="text-sm text-neutral-500">No orders yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-neutral-500 uppercase">
                <tr>
                  <th className="text-left py-1">Order</th>
                  <th className="text-left py-1">Customer</th>
                  <th className="text-left py-1">Status</th>
                  <th className="text-right py-1">Total</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.id} className="border-t border-neutral-100">
                    <td className="py-1.5 font-mono text-xs">
                      <Link
                        href={`/admin/orders/${r.id}`}
                        className="underline"
                      >
                        {r.orderNumber}
                      </Link>
                    </td>
                    <td className="py-1.5 text-neutral-700">
                      {r.customerName || "—"}
                    </td>
                    <td className="py-1.5">
                      <span
                        className={`inline-block px-1.5 py-0.5 text-[10px] uppercase tracking-wider rounded border ${
                          STATUS_BADGE[r.status] ?? STATUS_BADGE.NEW
                        }`}
                      >
                        {r.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="py-1.5 text-right">
                      {formatGbp(r.totalCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="bg-white border border-neutral-200 rounded-lg p-5">
          <h3 className="font-semibold mb-3">Top products this month</h3>
          {top.length === 0 ? (
            <p className="text-sm text-neutral-500">
              No sales this month yet.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-neutral-500 uppercase">
                <tr>
                  <th className="text-left py-1">Product</th>
                  <th className="text-right py-1">Units</th>
                  <th className="text-right py-1">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {top.map((p) => (
                  <tr
                    key={p.productId}
                    className="border-t border-neutral-100"
                  >
                    <td className="py-1.5">
                      <Link
                        href={`/admin/catalog/products/${p.productId}`}
                        className="underline"
                      >
                        {p.productName}
                      </Link>
                    </td>
                    <td className="py-1.5 text-right">{p.units}</td>
                    <td className="py-1.5 text-right">
                      {formatGbp(p.revenueCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
