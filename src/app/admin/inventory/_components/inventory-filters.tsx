"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

interface InventoryFiltersProps {
  initial: {
    search?: string;
    lowOnly?: boolean;
  };
}

/**
 * Real-time filters for /admin/inventory. Search debounces 300ms; the
 * "low stock only" checkbox fires instantly.
 */
export function InventoryFilters({ initial }: InventoryFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = React.useState(initial.search ?? "");
  const [lowOnly, setLowOnly] = React.useState(initial.lowOnly ?? false);

  const push = React.useCallback(
    (next: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(next)) {
        if (v) params.set(k, v);
        else params.delete(k);
      }
      router.replace(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams],
  );

  function onLowOnlyChange(v: boolean) {
    setLowOnly(v);
    push({ lowOnly: v ? "1" : "" });
  }

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
          placeholder="Product name"
          className="border border-neutral-300 rounded px-2 py-1 bg-white"
        />
      </label>
      <label className="flex items-center gap-2 pb-1.5">
        <input
          type="checkbox"
          checked={lowOnly}
          onChange={(e) => onLowOnlyChange(e.target.checked)}
          className="h-4 w-4"
        />
        <span className="text-xs text-neutral-700">Show only low stock (≤5)</span>
      </label>
    </div>
  );
}
