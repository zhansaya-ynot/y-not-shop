import * as React from "react";
import Link from "next/link";
import type { UserRole } from "@prisma/client";
import { listCustomersForAdmin } from "@/server/customers/service";
import { CustomersFilters } from "./_components/customers-filters";

export const dynamic = "force-dynamic";

const ROLES: UserRole[] = ["CUSTOMER", "ADMIN", "OWNER"];
const PAGE_SIZE = 50;

interface SP {
  searchParams: Promise<{
    search?: string;
    role?: string;
    hideGuests?: string;
    cursor?: string;
  }>;
}

function formatGbp(cents: number): string {
  return `£${(cents / 100).toFixed(2)}`;
}

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toISOString().slice(0, 10);
}

export default async function AdminCustomersPage({ searchParams }: SP) {
  const sp = await searchParams;
  const filters = {
    search: sp.search?.trim() || undefined,
    role: ROLES.includes(sp.role as UserRole)
      ? (sp.role as UserRole)
      : undefined,
    hideGuests: sp.hideGuests === "1",
    cursor: sp.cursor || undefined,
    limit: PAGE_SIZE,
  };

  const customers = await listCustomersForAdmin(filters);
  const nextCursor =
    customers.length === PAGE_SIZE ? customers[customers.length - 1]!.id : null;

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6">Customers</h2>
      <CustomersFilters
        initial={{
          search: filters.search,
          role: filters.role,
          hideGuests: filters.hideGuests,
        }}
      />

      <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-600 text-xs uppercase">
            <tr>
              <th className="text-left px-3 py-2">Name</th>
              <th className="text-left px-3 py-2">Email</th>
              <th className="text-left px-3 py-2">Role</th>
              <th className="text-right px-3 py-2"># Orders</th>
              <th className="text-right px-3 py-2">Lifetime spend</th>
              <th className="text-left px-3 py-2">Joined</th>
              <th className="text-left px-3 py-2">Last order</th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-8 text-center text-neutral-500"
                >
                  No customers match these filters.
                </td>
              </tr>
            )}
            {customers.map((c) => (
              <tr
                key={c.id}
                className="border-t border-neutral-100 hover:bg-neutral-50"
              >
                <td className="px-3 py-2">
                  <Link
                    href={`/admin/customers/${c.id}`}
                    className="underline"
                  >
                    {c.name ?? "—"}
                  </Link>
                  {c.isGuest && (
                    <span className="ml-2 inline-block px-1.5 py-0.5 text-[10px] uppercase tracking-wider rounded border border-neutral-300 text-neutral-600">
                      guest
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-neutral-700">{c.email}</td>
                <td className="px-3 py-2 text-xs">{c.role}</td>
                <td className="px-3 py-2 text-right">{c.ordersCount}</td>
                <td className="px-3 py-2 text-right">
                  {formatGbp(c.lifetimeSpendCents)}
                </td>
                <td className="px-3 py-2 text-xs text-neutral-600">
                  {formatDate(c.createdAt)}
                </td>
                <td className="px-3 py-2 text-xs text-neutral-600">
                  {formatDate(c.lastOrderAt)}
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
  filters: { search?: string; role?: string; hideGuests?: boolean },
  cursor: string,
): string {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.role) params.set("role", filters.role);
  if (filters.hideGuests) params.set("hideGuests", "1");
  params.set("cursor", cursor);
  return `/admin/customers?${params.toString()}`;
}
