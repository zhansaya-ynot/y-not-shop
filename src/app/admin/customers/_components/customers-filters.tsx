"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const ROLES = ["CUSTOMER", "ADMIN", "OWNER"] as const;

interface CustomersFiltersProps {
  initial: {
    search?: string;
    role?: string;
    hideGuests?: boolean;
  };
}

/**
 * Real-time filters for /admin/customers. Selects + checkbox fire instantly;
 * the search input debounces 300ms before pushing the new URL. Pagination
 * cursor is dropped on every filter change so the operator sees results from
 * page 1.
 */
export function CustomersFilters({ initial }: CustomersFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = React.useState(initial.search ?? "");
  const [role, setRole] = React.useState(initial.role ?? "");
  const [hideGuests, setHideGuests] = React.useState(
    initial.hideGuests ?? false,
  );

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

  function onRoleChange(v: string) {
    setRole(v);
    push({ role: v });
  }

  function onHideGuestsChange(v: boolean) {
    setHideGuests(v);
    push({ hideGuests: v ? "1" : "" });
  }

  // Debounced text input.
  React.useEffect(() => {
    const t = setTimeout(() => {
      if (search !== (initial.search ?? "")) push({ search });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className="flex flex-wrap gap-3 mb-4 items-end text-sm">
      <label className="flex flex-col flex-1 min-w-48">
        <span className="text-xs text-neutral-600 mb-1">Search</span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Name or email"
          className="border border-neutral-300 rounded px-2 py-1 bg-white"
        />
      </label>
      <label className="flex flex-col">
        <span className="text-xs text-neutral-600 mb-1">Role</span>
        <select
          value={role}
          onChange={(e) => onRoleChange(e.target.value)}
          className="border border-neutral-300 rounded px-2 py-1 bg-white"
        >
          <option value="">All</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 pb-1.5">
        <input
          type="checkbox"
          checked={hideGuests}
          onChange={(e) => onHideGuestsChange(e.target.checked)}
          className="h-4 w-4"
        />
        <span className="text-xs text-neutral-700">Hide guests</span>
      </label>
    </div>
  );
}
