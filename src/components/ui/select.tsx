"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  error?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
}

/**
 * Branded dropdown — uses a button + popup list instead of the native
 * <select> element so the open menu inherits the storefront's typography
 * and palette across browsers (Safari/Chrome both render <option> as a
 * platform-styled list otherwise). Same prop signature as the previous
 * native Select so callers don't need to change.
 */
export function Select({
  label,
  value,
  onChange,
  options,
  error,
  className,
  disabled,
  id,
  name,
}: SelectProps) {
  const reactId = React.useId();
  const buttonId = id ?? reactId;
  const listboxId = `${buttonId}-listbox`;
  const [open, setOpen] = React.useState(false);
  const [highlight, setHighlight] = React.useState<number>(-1);
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);

  const selected = options.find((o) => o.value === value) ?? options[0];

  // Close on outside click.
  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // When opening, scroll the highlighted (or selected) option into view.
  React.useEffect(() => {
    if (!open) return;
    const selectedIdx = options.findIndex((o) => o.value === value);
    setHighlight(selectedIdx >= 0 ? selectedIdx : 0);
  }, [open, options, value]);

  React.useEffect(() => {
    if (!open || highlight < 0) return;
    const node = listRef.current?.querySelector<HTMLElement>(
      `[data-index="${highlight}"]`,
    );
    node?.scrollIntoView({ block: "nearest" });
  }, [open, highlight]);

  function commit(next: string) {
    onChange(next);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((i) => Math.min(options.length - 1, i + 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((i) => Math.max(0, i - 1));
      return;
    }
    if (e.key === "Home") {
      e.preventDefault();
      setHighlight(0);
      return;
    }
    if (e.key === "End") {
      e.preventDefault();
      setHighlight(options.length - 1);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const opt = options[highlight];
      if (opt) commit(opt.value);
      return;
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label
          htmlFor={buttonId}
          className="text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground-secondary"
        >
          {label}
        </label>
      )}
      <div ref={wrapperRef} className={cn("relative", className)}>
        {name && (
          <input type="hidden" name={name} value={value} readOnly />
        )}
        <button
          type="button"
          id={buttonId}
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-invalid={error ? true : undefined}
          disabled={disabled}
          onClick={() => !disabled && setOpen((o) => !o)}
          onKeyDown={onKeyDown}
          className={cn(
            "flex h-[48px] w-full items-center justify-between bg-transparent border-b border-border-light px-0 py-3 pr-8",
            "text-left text-[14px] text-foreground-primary",
            "cursor-pointer",
            "focus:outline-none focus:border-foreground-primary",
            "disabled:cursor-not-allowed disabled:opacity-60",
            error && "border-error focus:border-error",
          )}
        >
          <span className="truncate">{selected?.label ?? ""}</span>
          <svg
            aria-hidden="true"
            viewBox="0 0 12 8"
            className={cn(
              "pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 h-2 w-3 text-foreground-secondary transition-transform",
              open && "rotate-180",
            )}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M1 1.5L6 6.5L11 1.5" />
          </svg>
        </button>
        {open && (
          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            tabIndex={-1}
            className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto bg-surface-primary border border-border-light shadow-lg py-1"
          >
            {options.map((o, idx) => {
              const isSelected = o.value === value;
              const isHighlighted = idx === highlight;
              return (
                <li
                  key={o.value}
                  role="option"
                  aria-selected={isSelected}
                  data-index={idx}
                  onMouseDown={(e) => {
                    // mousedown to commit before button blur runs onPointerDown
                    e.preventDefault();
                    commit(o.value);
                  }}
                  onMouseEnter={() => setHighlight(idx)}
                  className={cn(
                    "px-4 py-2 text-[14px] cursor-pointer text-foreground-primary",
                    isHighlighted && "bg-surface-secondary",
                    isSelected && "font-semibold",
                  )}
                >
                  {o.label}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {error && <p className="text-[12px] text-error">{error}</p>}
    </div>
  );
}
