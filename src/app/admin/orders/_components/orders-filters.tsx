"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const ORDER_STATUSES = [
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
] as const;

interface OrdersFiltersProps {
  initial: {
    status?: string;
    carrier?: string;
    country?: string;
    search?: string;
  };
}

/**
 * Client-side filters for /admin/orders. Selects fire instantly; the search
 * + country text inputs debounce 300ms before pushing the new URL so we
 * don't refetch on every keystroke. Pagination cursor is dropped on every
 * filter change so the operator sees results from page 1.
 */
export function OrdersFilters({ initial }: OrdersFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [status, setStatus] = React.useState(initial.status ?? "");
  const [carrier, setCarrier] = React.useState(initial.carrier ?? "");
  const [country, setCountry] = React.useState(initial.country ?? "");
  const [search, setSearch] = React.useState(initial.search ?? "");

  const push = React.useCallback(
    (next: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("cursor");
      for (const [k, v] of Object.entries(next)) {
        if (v) params.set(k, v);
        else params.delete(k);
      }
      router.replace(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams],
  );

  // Selects: instant.
  function onStatusChange(v: string) {
    setStatus(v);
    push({ status: v });
  }
  function onCarrierChange(v: string) {
    setCarrier(v);
    push({ carrier: v });
  }

  // Text inputs: debounce so we don't navigate on each keystroke.
  React.useEffect(() => {
    const t = setTimeout(() => {
      if (country !== (initial.country ?? "")) push({ country });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country]);

  React.useEffect(() => {
    const t = setTimeout(() => {
      if (search !== (initial.search ?? "")) push({ search });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className="flex flex-wrap gap-3 mb-4 items-end text-sm">
      <label className="flex flex-col">
        <span className="text-xs text-neutral-600 mb-1">Status</span>
        <select
          value={status}
          onChange={(e) => onStatusChange(e.target.value)}
          className="border border-neutral-300 rounded px-2 py-1 bg-white"
        >
          <option value="">All</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col">
        <span className="text-xs text-neutral-600 mb-1">Carrier</span>
        <select
          value={carrier}
          onChange={(e) => onCarrierChange(e.target.value)}
          className="border border-neutral-300 rounded px-2 py-1 bg-white"
        >
          <option value="">All</option>
          <option value="ROYAL_MAIL">Royal Mail</option>
          <option value="DHL">DHL</option>
        </select>
      </label>
      <label className="flex flex-col">
        <span className="text-xs text-neutral-600 mb-1">Country</span>
        <input
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          placeholder="GB"
          className="border border-neutral-300 rounded px-2 py-1 bg-white w-20"
        />
      </label>
      <label className="flex flex-col flex-1 min-w-48">
        <span className="text-xs text-neutral-600 mb-1">Search</span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Order #, surname, tracking"
          className="border border-neutral-300 rounded px-2 py-1 bg-white"
        />
      </label>
    </div>
  );
}
