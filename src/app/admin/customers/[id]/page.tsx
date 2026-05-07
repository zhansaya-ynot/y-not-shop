import * as React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { OrderStatus } from "@prisma/client";
import { getCustomerForAdmin } from "@/server/customers/service";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ id: string }>;
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

const ROLE_BADGE: Record<string, string> = {
  CUSTOMER: "bg-neutral-100 text-neutral-700 border-neutral-200",
  ADMIN: "bg-amber-100 text-amber-800 border-amber-200",
  OWNER: "bg-amber-100 text-amber-800 border-amber-200",
};

function formatGbp(cents: number): string {
  return `£${(cents / 100).toFixed(2)}`;
}

function statusBadgeClass(status: OrderStatus): string {
  return (
    STATUS_BADGE[status] ?? "bg-neutral-100 text-neutral-700 border-neutral-200"
  );
}

export default async function AdminCustomerDetail({ params }: Params) {
  const { id } = await params;
  const customer = await getCustomerForAdmin(id);
  if (!customer) notFound();

  const stats = [
    { label: "Total orders", value: customer.ordersCount.toString() },
    {
      label: "Lifetime spend",
      value: formatGbp(customer.lifetimeSpendCents),
    },
    {
      label: "Average order value",
      value: formatGbp(customer.averageOrderValueCents),
    },
    { label: "Returns", value: customer.returnsCount.toString() },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/customers"
          className="text-xs underline text-neutral-500"
        >
          ← All customers
        </Link>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          <h2 className="text-2xl font-semibold">
            {customer.name ?? customer.email}
          </h2>
          <span
            className={`inline-block px-2 py-0.5 text-xs rounded border ${
              ROLE_BADGE[customer.role] ?? ROLE_BADGE.CUSTOMER
            }`}
          >
            {customer.role}
          </span>
          {customer.isGuest && (
            <span className="inline-block px-2 py-0.5 text-xs rounded border bg-neutral-100 text-neutral-700 border-neutral-200">
              GUEST
            </span>
          )}
        </div>
        <div className="text-sm text-neutral-600 mt-1">{customer.email}</div>
        <div className="text-xs text-neutral-500 mt-0.5">
          Joined {new Date(customer.createdAt).toISOString().slice(0, 10)}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-white rounded-lg border border-neutral-200 p-4"
          >
            <div className="text-[11px] uppercase tracking-widest text-neutral-500">
              {s.label}
            </div>
            <div className="mt-1.5 text-2xl font-semibold">{s.value}</div>
          </div>
        ))}
      </div>

      <section className="bg-white border border-neutral-200 rounded-lg p-5">
        <h3 className="font-semibold mb-3">Order history</h3>
        {customer.orders.length === 0 ? (
          <p className="text-sm text-neutral-500">No orders yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-neutral-500 uppercase">
              <tr>
                <th className="text-left py-1">Order</th>
                <th className="text-left py-1">Date</th>
                <th className="text-left py-1">Status</th>
                <th className="text-right py-1">Total</th>
              </tr>
            </thead>
            <tbody>
              {customer.orders.map((o) => (
                <tr key={o.id} className="border-t border-neutral-100">
                  <td className="py-1.5 font-mono">
                    <Link
                      href={`/admin/orders/${o.id}`}
                      className="underline"
                    >
                      {o.orderNumber}
                    </Link>
                  </td>
                  <td className="py-1.5 text-xs text-neutral-600">
                    {new Date(o.createdAt).toISOString().slice(0, 10)}
                  </td>
                  <td className="py-1.5">
                    <span
                      className={`inline-block px-2 py-0.5 text-[10px] uppercase tracking-wider rounded border ${statusBadgeClass(o.status)}`}
                    >
                      {o.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="py-1.5 text-right">
                    {formatGbp(o.totalCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="bg-white border border-neutral-200 rounded-lg p-5">
        <h3 className="font-semibold mb-3">Address book</h3>
        {customer.addresses.length === 0 ? (
          <p className="text-sm text-neutral-500">
            No addresses on file (no orders).
          </p>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {customer.addresses.map((a, i) => (
              <li
                key={`${a.line1}-${a.postcode}-${i}`}
                className="border border-neutral-100 rounded p-3 text-sm"
              >
                <div className="font-medium">
                  {a.firstName} {a.lastName}
                </div>
                <div className="text-neutral-700">
                  {a.line1}
                  {a.line2 ? `, ${a.line2}` : ""}
                </div>
                <div className="text-neutral-700">
                  {a.city}, {a.postcode}
                </div>
                <div className="text-neutral-700">{a.country}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
