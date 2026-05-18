"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";

interface FilterOption {
  value: string;
  label: string;
}

const SIZE_OPTIONS: FilterOption[] = [
  { value: "S", label: "S" },
  { value: "M", label: "M" },
  { value: "L", label: "L" },
];

const PRICE_OPTIONS: FilterOption[] = [
  { value: "50000", label: "Under £500" },
  { value: "100000", label: "Under £1,000" },
  { value: "150000", label: "Under £1,500" },
];

/** Query params this bar owns — used for the active-count badge + Clear all. */
const FILTER_KEYS = ["material", "size", "maxPrice"] as const;

interface FilterGroupProps {
  label: string;
  current: string | null;
  options: FilterOption[];
  paramKey: string;
  onSelect: (key: string, value: string | null) => void;
}

function FilterGroup({
  label,
  current,
  options,
  paramKey,
  onSelect,
}: FilterGroupProps) {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground-secondary">
        {label}
      </span>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = current === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onSelect(paramKey, active ? null : o.value)}
              className={cn(
                "h-9 px-3 border text-[12px] uppercase tracking-[0.1em]",
                active
                  ? "border-foreground-primary bg-foreground-primary text-foreground-inverse"
                  : "border-border-dark text-foreground-primary hover:border-foreground-primary",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export interface FilterBarProps {
  materialOptions: FilterOption[];
}

/**
 * Catalogue filter. Renders as a single "Filter" button; the controls live
 * in a right-hand drawer so the product grid is visible immediately on
 * page load instead of being pushed below a wall of filter chips.
 *
 * Selections write straight to the URL, so the grid behind the drawer
 * re-filters live — closing the drawer just hides the controls.
 */
export function FilterBar({ materialOptions }: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = React.useState(false);

  const activeCount = FILTER_KEYS.filter((k) => params.get(k)).length;

  const setParam = React.useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params);
      if (value == null || value === "") next.delete(key);
      else next.set(key, value);
      const qs = next.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  const clearAll = React.useCallback(() => {
    const next = new URLSearchParams(params);
    for (const k of FILTER_KEYS) next.delete(k);
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [params, pathname, router]);

  // Esc closes the drawer; body scroll locked while it's open.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 h-10 px-4 border border-border-dark text-[12px] uppercase tracking-[0.15em] text-foreground-primary hover:border-foreground-primary"
      >
        <svg aria-hidden width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M1 3h12M3 7h8M5 11h4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        Filter
        {activeCount > 0 && (
          <span className="ml-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground-primary px-1 text-[10px] font-semibold text-foreground-inverse">
            {activeCount}
          </span>
        )}
      </button>

      {/* Backdrop */}
      <div
        onClick={() => setOpen(false)}
        aria-hidden
        className={cn(
          "fixed inset-0 z-[70] bg-black/40 transition-opacity duration-300",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      {/* Drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Filter products"
        className={cn(
          "fixed right-0 top-0 z-[71] flex h-full w-[88vw] max-w-[380px] flex-col bg-surface-primary shadow-xl transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b border-border-light px-6 py-5">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.2em]">
            Filter
          </h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close filters"
            className="flex h-8 w-8 items-center justify-center text-[20px] leading-none"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="flex flex-col gap-8">
            {materialOptions.length > 0 && (
              <FilterGroup
                label="Material"
                current={params.get("material")}
                options={materialOptions}
                paramKey="material"
                onSelect={setParam}
              />
            )}
            <FilterGroup
              label="Size"
              current={params.get("size")}
              options={SIZE_OPTIONS}
              paramKey="size"
              onSelect={setParam}
            />
            <FilterGroup
              label="Price"
              current={params.get("maxPrice")}
              options={PRICE_OPTIONS}
              paramKey="maxPrice"
              onSelect={setParam}
            />
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-border-light px-6 py-4">
          <button
            type="button"
            onClick={clearAll}
            disabled={activeCount === 0}
            className="text-[12px] uppercase tracking-[0.15em] text-foreground-secondary underline disabled:opacity-40"
          >
            Clear all
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="ml-auto h-10 flex-1 bg-foreground-primary text-[12px] uppercase tracking-[0.15em] text-foreground-inverse"
          >
            Show results
          </button>
        </div>
      </aside>
    </>
  );
}
