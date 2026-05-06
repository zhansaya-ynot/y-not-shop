"use client";

import * as React from "react";
import { cn } from "@/lib/cn";
import { Select } from "./select";

export interface PhoneInputProps {
  label?: string;
  /** ISO-3166-1 alpha-2 of the default dial code. Defaults to GB. */
  defaultCountry?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  id?: string;
  className?: string;
}

interface DialEntry {
  iso: string;
  name: string;
  code: string; // dial code with leading +
}

// Curated list — every storefront destination + common origins. Order matches
// the country-select on the shipping form so the dropdown reads as familiar.
// Sort: home market first, then alphabetical by display name.
const DIAL_CODES: DialEntry[] = [
  { iso: "GB", name: "United Kingdom", code: "+44" },
  { iso: "AE", name: "United Arab Emirates", code: "+971" },
  { iso: "AT", name: "Austria", code: "+43" },
  { iso: "AU", name: "Australia", code: "+61" },
  { iso: "BE", name: "Belgium", code: "+32" },
  { iso: "BG", name: "Bulgaria", code: "+359" },
  { iso: "BR", name: "Brazil", code: "+55" },
  { iso: "CA", name: "Canada", code: "+1" },
  { iso: "CH", name: "Switzerland", code: "+41" },
  { iso: "CN", name: "China", code: "+86" },
  { iso: "CY", name: "Cyprus", code: "+357" },
  { iso: "CZ", name: "Czechia", code: "+420" },
  { iso: "DE", name: "Germany", code: "+49" },
  { iso: "DK", name: "Denmark", code: "+45" },
  { iso: "EE", name: "Estonia", code: "+372" },
  { iso: "ES", name: "Spain", code: "+34" },
  { iso: "FI", name: "Finland", code: "+358" },
  { iso: "FR", name: "France", code: "+33" },
  { iso: "GR", name: "Greece", code: "+30" },
  { iso: "HK", name: "Hong Kong SAR", code: "+852" },
  { iso: "HR", name: "Croatia", code: "+385" },
  { iso: "HU", name: "Hungary", code: "+36" },
  { iso: "IE", name: "Ireland", code: "+353" },
  { iso: "IL", name: "Israel", code: "+972" },
  { iso: "IN", name: "India", code: "+91" },
  { iso: "IS", name: "Iceland", code: "+354" },
  { iso: "IT", name: "Italy", code: "+39" },
  { iso: "JP", name: "Japan", code: "+81" },
  { iso: "KR", name: "South Korea", code: "+82" },
  { iso: "KZ", name: "Kazakhstan", code: "+7" },
  { iso: "LT", name: "Lithuania", code: "+370" },
  { iso: "LU", name: "Luxembourg", code: "+352" },
  { iso: "LV", name: "Latvia", code: "+371" },
  { iso: "MT", name: "Malta", code: "+356" },
  { iso: "MX", name: "Mexico", code: "+52" },
  { iso: "NL", name: "Netherlands", code: "+31" },
  { iso: "NO", name: "Norway", code: "+47" },
  { iso: "NZ", name: "New Zealand", code: "+64" },
  { iso: "PL", name: "Poland", code: "+48" },
  { iso: "PT", name: "Portugal", code: "+351" },
  { iso: "QA", name: "Qatar", code: "+974" },
  { iso: "RO", name: "Romania", code: "+40" },
  { iso: "RU", name: "Russia", code: "+7" },
  { iso: "SA", name: "Saudi Arabia", code: "+966" },
  { iso: "SE", name: "Sweden", code: "+46" },
  { iso: "SG", name: "Singapore", code: "+65" },
  { iso: "SI", name: "Slovenia", code: "+386" },
  { iso: "SK", name: "Slovakia", code: "+421" },
  { iso: "TH", name: "Thailand", code: "+66" },
  { iso: "TR", name: "Turkey", code: "+90" },
  { iso: "TW", name: "Taiwan", code: "+886" },
  { iso: "UA", name: "Ukraine", code: "+380" },
  { iso: "US", name: "United States", code: "+1" },
  { iso: "ZA", name: "South Africa", code: "+27" },
];

const ISO_TO_DIAL: Map<string, DialEntry> = new Map(
  DIAL_CODES.map((d) => [d.iso, d]),
);

/**
 * Phone input with an inline country-code selector. The full E.164-style
 * value (`+44 7700 900123`) is stored on the parent; the local-number portion
 * is editable, the dial code comes from the dropdown.
 *
 * Migration note: previously hard-coded `+44`. Existing values that already
 * start with a recognised dial code stay associated with that country on
 * mount; values without a recognised code default to the prop or GB.
 */
export function PhoneInput({
  label,
  defaultCountry = "GB",
  value,
  onChange,
  placeholder,
  error,
  id,
  className,
}: PhoneInputProps) {
  const reactId = React.useId();
  const inputId = id ?? reactId;

  // Try to detect dial code from the incoming value once on mount; longer
  // codes win to disambiguate the +1/+44/+7 prefixes from +1 (US/CA) etc.
  const initialIso = React.useMemo(() => {
    const trimmed = value.trim();
    if (!trimmed.startsWith("+")) return defaultCountry;
    const sorted = [...DIAL_CODES].sort((a, b) => b.code.length - a.code.length);
    const hit = sorted.find((d) => trimmed.startsWith(d.code));
    return hit?.iso ?? defaultCountry;
  }, [value, defaultCountry]);

  const [iso, setIso] = React.useState(initialIso);
  const dial = ISO_TO_DIAL.get(iso) ?? ISO_TO_DIAL.get("GB")!;

  // Strip the dial code (and any whitespace right after it) so the input
  // shows only the local portion of the number.
  const local = React.useMemo(() => {
    if (value.startsWith(dial.code)) {
      return value.slice(dial.code.length).replace(/^\s+/, "");
    }
    // If the existing value starts with a different known code, the user
    // just switched country — leave the local number visible as-is so they
    // don't lose their typing.
    const sorted = [...DIAL_CODES].sort((a, b) => b.code.length - a.code.length);
    const old = sorted.find((d) => value.startsWith(d.code));
    if (old) return value.slice(old.code.length).replace(/^\s+/, "");
    return value;
  }, [value, dial.code]);

  function emit(nextLocal: string, nextIso: string) {
    const nextDial = ISO_TO_DIAL.get(nextIso) ?? ISO_TO_DIAL.get("GB")!;
    const cleaned = nextLocal.replace(/^\s+/, "");
    onChange(cleaned ? `${nextDial.code} ${cleaned}` : nextDial.code);
  }

  function onCountryChange(nextIso: string) {
    setIso(nextIso);
    emit(local, nextIso);
  }
  function onLocalChange(next: string) {
    emit(next, iso);
  }

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label
          htmlFor={inputId}
          className="text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground-secondary"
        >
          {label}
        </label>
      )}
      <div
        className={cn(
          "flex items-center gap-3 border-b border-border-light",
          "focus-within:border-foreground-primary",
          error && "border-error focus-within:border-error",
        )}
      >
        {/* Country dial-code picker — same branded combobox used for the
            form-level Country select, sized to fit inside the phone row. */}
        <div className="w-[120px] shrink-0">
          <Select
            value={iso}
            onChange={onCountryChange}
            options={DIAL_CODES.map((d) => ({
              value: d.iso,
              label: `${d.iso} ${d.code}`,
            }))}
            className="!border-0 !h-[48px] !pl-0"
          />
        </div>
        <input
          id={inputId}
          type="tel"
          inputMode="tel"
          value={local}
          onChange={(e) => onLocalChange(e.target.value)}
          placeholder={placeholder ?? "7700 900123"}
          aria-invalid={error ? true : undefined}
          className={cn(
            "h-[48px] flex-1 bg-transparent py-3",
            "text-[14px] text-foreground-primary placeholder:text-foreground-tertiary",
            "focus:outline-none rounded-none",
            className,
          )}
        />
      </div>
      {error && <p className="text-[12px] text-error">{error}</p>}
    </div>
  );
}
