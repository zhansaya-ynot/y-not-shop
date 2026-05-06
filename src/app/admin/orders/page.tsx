import * as React from "react";
import Link from "next/link";
import type { OrderStatus } from "@prisma/client";
import { listForAdmin } from "@/server/orders/service";
import { OrdersFilters } from "./_components/orders-filters";

export const dynamic = "force-dynamic";

const ORDER_STATUSES: OrderStatus[] = [
  "PENDING_PAYMENT",
  "PAYMENT_FAILED",
  "NEW",
  "PROCESSING",
  "PARTIALLY_SHIPPED",
  "SHIPPED",
  "PARTIALLY_DELIVERED",
  "DELIVERED",
  "RETURNED",
  "CANCELLED",
];

const PAGE_SIZE = 50;

interface SP {
  searchParams: Promise<{
    status?: string;
    carrier?: string;
    country?: string;
    search?: string;
    cursor?: string;
  }>;
}

export default async function AdminOrdersPage({ searchParams }: SP) {
  const sp = await searchParams;
  const filters = {
    status: ORDER_STATUSES.includes(sp.status as OrderStatus)
      ? (sp.status as OrderStatus)
      : undefined,
    carrier:
      sp.carrier === "ROYAL_MAIL" || sp.carrier === "DHL"
        ? (sp.carrier as "ROYAL_MAIL" | "DHL")
        : undefined,
    country: sp.country?.trim() || undefined,
    search: sp.search?.trim() || undefined,
    cursor: sp.cursor || undefined,
    limit: PAGE_SIZE,
  };
  const orders = await listForAdmin(filters);

  const nextCursor =
    orders.length === PAGE_SIZE ? orders[orders.length - 1]!.id : null;

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6">Orders</h2>
      <OrdersFilters
        initial={{
          status: filters.status,
          carrier: filters.carrier,
          country: filters.country,
          search: filters.search,
        }}
      />

      <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-600 text-xs uppercase">
            <tr>
              <th className="text-left px-3 py-2">Order</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Customer</th>
              <th className="text-left px-3 py-2">Country</th>
              <th className="text-left px-3 py-2">Carrier</th>
              <th className="text-right px-3 py-2">Total</th>
              <th className="text-left px-3 py-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-neutral-500">
                  No orders match these filters.
                </td>
              </tr>
            )}
            {orders.map((o) => (
              <tr key={o.id} className="border-t border-neutral-100 hover:bg-neutral-50">
                <td className="px-3 py-2 font-mono">
                  <Link href={`/admin/orders/${o.id}`} className="underline">
                    {o.orderNumber}
                  </Link>
                </td>
                <td className="px-3 py-2">{o.status}</td>
                <td className="px-3 py-2">
                  {o.shipFirstName} {o.shipLastName}
                  <div className="text-xs text-neutral-500">{o.user?.email ?? "-"}</div>
                </td>
                <td className="px-3 py-2">{o.shipCountry}</td>
                <td className="px-3 py-2">{o.carrier}</td>
                <td className="px-3 py-2 text-right">
                  £{(o.totalCents / 100).toFixed(2)}
                </td>
                <td className="px-3 py-2 text-xs text-neutral-600">
                  {new Date(o.createdAt).toISOString().slice(0, 16).replace("T", " ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {nextCursor && (
        <div className="mt-4 text-right">
          <Link
            href={buildNextHref(filters, nextCursor)}
            className="inline-block px-4 py-2 border border-neutral-300 rounded hover:bg-neutral-100 text-sm"
          >
            Next page →
          </Link>
        </div>
      )}
    </div>
  );
}

function buildNextHref(
  filters: { status?: string; carrier?: string; country?: string; search?: string },
  cursor: string,
): string {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.carrier) params.set("carrier", filters.carrier);
  if (filters.country) params.set("country", filters.country);
  if (filters.search) params.set("search", filters.search);
  params.set("cursor", cursor);
  return `/admin/orders?${params.toString()}`;
}
