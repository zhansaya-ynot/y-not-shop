"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

interface ZoneEditorProps {
  zone: {
    id: string;
    name: string;
    countries: string[];
    isActive: boolean;
    methods: Array<{ id: string; name: string; carrier: string; isActive: boolean }>;
  };
}

// Same 52 destinations the storefront country picker offers (UK first).
const ALL_COUNTRIES: { code: string; name: string }[] = [
  { code: "GB", name: "United Kingdom" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "AT", name: "Austria" },
  { code: "AU", name: "Australia" },
  { code: "BE", name: "Belgium" },
  { code: "BG", name: "Bulgaria" },
  { code: "BR", name: "Brazil" },
  { code: "CA", name: "Canada" },
  { code: "CH", name: "Switzerland" },
  { code: "CN", name: "China" },
  { code: "CY", name: "Cyprus" },
  { code: "CZ", name: "Czechia" },
  { code: "DE", name: "Germany" },
  { code: "DK", name: "Denmark" },
  { code: "EE", name: "Estonia" },
  { code: "ES", name: "Spain" },
  { code: "FI", name: "Finland" },
  { code: "FR", name: "France" },
  { code: "GR", name: "Greece" },
  { code: "HK", name: "Hong Kong SAR" },
  { code: "HR", name: "Croatia" },
  { code: "HU", name: "Hungary" },
  { code: "IE", name: "Ireland" },
  { code: "IL", name: "Israel" },
  { code: "IN", name: "India" },
  { code: "IS", name: "Iceland" },
  { code: "IT", name: "Italy" },
  { code: "JP", name: "Japan" },
  { code: "KR", name: "South Korea" },
  { code: "KZ", name: "Kazakhstan" },
  { code: "LT", name: "Lithuania" },
  { code: "LU", name: "Luxembourg" },
  { code: "LV", name: "Latvia" },
  { code: "MT", name: "Malta" },
  { code: "MX", name: "Mexico" },
  { code: "NL", name: "Netherlands" },
  { code: "NO", name: "Norway" },
  { code: "NZ", name: "New Zealand" },
  { code: "PL", name: "Poland" },
  { code: "PT", name: "Portugal" },
  { code: "QA", name: "Qatar" },
  { code: "RO", name: "Romania" },
  { code: "RU", name: "Russia" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "SE", name: "Sweden" },
  { code: "SG", name: "Singapore" },
  { code: "SI", name: "Slovenia" },
  { code: "SK", name: "Slovakia" },
  { code: "TH", name: "Thailand" },
  { code: "TR", name: "Turkey" },
  { code: "TW", name: "Taiwan" },
  { code: "UA", name: "Ukraine" },
  { code: "US", name: "United States" },
  { code: "ZA", name: "South Africa" },
];

export function ShippingZoneEditor({ zone }: ZoneEditorProps) {
  const router = useRouter();
  const [selected, setSelected] = React.useState<Set<string>>(
    () => new Set(zone.countries),
  );
  const [isActive, setIsActive] = React.useState(zone.isActive);
  const [filter, setFilter] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  const filtered = filter
    ? ALL_COUNTRIES.filter(
        (c) =>
          c.name.toLowerCase().includes(filter.toLowerCase()) ||
          c.code.toLowerCase().includes(filter.toLowerCase()),
      )
    : ALL_COUNTRIES;

  function toggle(code: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  async function save() {
    setError(null);
    setSaved(false);
    setPending(true);
    const res = await fetch(`/api/admin/shipping/zones/${zone.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        countries: Array.from(selected),
        isActive,
      }),
    });
    setPending(false);
    if (!res.ok) {
      setError(`Save failed (${res.status})`);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <section className="border border-neutral-200 rounded-md bg-white">
      <header className="flex items-center justify-between gap-4 px-5 py-4 border-b border-neutral-200">
        <div>
          <h3 className="text-base font-semibold">{zone.name}</h3>
          <p className="text-xs text-neutral-500 mt-0.5">
            {selected.size} countr{selected.size === 1 ? "y" : "ies"} selected
            {zone.methods.length > 0 && (
              <>
                {" · "}
                {zone.methods.map((m) => m.name).join(", ")}
              </>
            )}
          </p>
        </div>
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          Active
        </label>
      </header>

      <div className="px-5 py-4 space-y-3">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by country or ISO code…"
          className="w-full border border-neutral-300 rounded px-3 py-2 text-sm"
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 max-h-96 overflow-y-auto pr-2">
          {filtered.map((c) => (
            <label
              key={c.code}
              className="inline-flex items-center gap-2 text-[13px] py-1 cursor-pointer hover:text-foreground-primary"
            >
              <input
                type="checkbox"
                checked={selected.has(c.code)}
                onChange={() => toggle(c.code)}
              />
              <span className="font-mono text-[11px] text-neutral-500 w-6">
                {c.code}
              </span>
              <span>{c.name}</span>
            </label>
          ))}
        </div>
      </div>

      <footer className="flex items-center gap-3 px-5 py-3 border-t border-neutral-200">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="px-4 py-2 bg-neutral-900 text-white text-xs uppercase tracking-wider rounded disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
        {error && <p className="text-sm text-red-700">{error}</p>}
        {saved && <p className="text-sm text-green-700">Saved.</p>}
      </footer>
    </section>
  );
}
