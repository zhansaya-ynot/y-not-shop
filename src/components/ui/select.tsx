import * as React from "react";
import { cn } from "@/lib/cn";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "value"> {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  error?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  function Select(
    { label, value, onChange, options, error, className, id, ...props },
    ref,
  ) {
    const reactId = React.useId();
    const selectId = id ?? reactId;
    return (
      <div className="flex flex-col gap-2">
        {label && (
          <label
            htmlFor={selectId}
            className="text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground-secondary"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-invalid={error ? true : undefined}
            className={cn(
              "h-[48px] w-full bg-transparent border-b border-border-light px-0 py-3 pr-8",
              "text-[14px] text-foreground-primary",
              "appearance-none cursor-pointer",
              "focus:outline-none focus:border-foreground-primary",
              "rounded-none",
              error && "border-error focus:border-error",
              className,
            )}
            {...props}
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <svg
            aria-hidden="true"
            viewBox="0 0 12 8"
            className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 h-2 w-3 text-foreground-secondary"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M1 1.5L6 6.5L11 1.5" />
          </svg>
        </div>
        {error && <p className="text-[12px] text-error">{error}</p>}
      </div>
    );
  },
);
