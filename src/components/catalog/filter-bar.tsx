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
    <div className="flex flex-col gap-2">
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

export function FilterBar({ materialOptions }: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const setParam = React.useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params);
      if (value == null || value === "") next.delete(key);
      else next.set(key, value);
      const qs = next.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [params, pathname, router],
  );

  return (
    <div className="flex flex-col gap-6 md:flex-row md:gap-10 md:items-end">
      <FilterGroup
        label="Material"
        current={params.get("material")}
        options={materialOptions}
        paramKey="material"
        onSelect={setParam}
      />
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
  );
}
