'use client';

import * as React from 'react';
import type {
  ShippingReturnsExtras,
  ShippingRow,
} from '@/lib/cms/page-extras';

interface Props {
  value: ShippingReturnsExtras;
  onChange: (next: ShippingReturnsExtras) => void;
}

/**
 * Editor for the Shipping & Returns page: hero + Delivery tab (intro,
 * destination/time/carrier/cost rows, post-table note) + Returns tab
 * (intro, bullets, CTA). Plain textareas for paragraphs — upgrade to
 * TipTap later if operators need bold/italic in shipping copy.
 */
export function ShippingExtrasEditor({ value, onChange }: Props): React.ReactElement {
  function setHero(patch: Partial<ShippingReturnsExtras['hero']>): void {
    onChange({ ...value, hero: { ...value.hero, ...patch } });
  }
  function setDelivery(patch: Partial<ShippingReturnsExtras['delivery']>): void {
    onChange({ ...value, delivery: { ...value.delivery, ...patch } });
  }
  function setReturns(patch: Partial<ShippingReturnsExtras['returns']>): void {
    onChange({ ...value, returns: { ...value.returns, ...patch } });
  }

  function setRow(idx: number, patch: Partial<ShippingRow>): void {
    const rows = value.delivery.rows.map((r, i) => (i === idx ? { ...r, ...patch } : r));
    setDelivery({ rows });
  }
  function addRow(): void {
    if (value.delivery.rows.length >= 20) return;
    setDelivery({
      rows: [
        ...value.delivery.rows,
        { destination: '', time: '', carrier: '', cost: '' },
      ],
    });
  }
  function removeRow(idx: number): void {
    setDelivery({ rows: value.delivery.rows.filter((_, i) => i !== idx) });
  }

  function setBullet(idx: number, next: string): void {
    const bullets = value.returns.bullets.map((b, i) => (i === idx ? next : b));
    setReturns({ bullets });
  }
  function addBullet(): void {
    if (value.returns.bullets.length >= 20) return;
    setReturns({ bullets: [...value.returns.bullets, ''] });
  }
  function removeBullet(idx: number): void {
    setReturns({ bullets: value.returns.bullets.filter((_, i) => i !== idx) });
  }

  const cellInputClass = 'rounded border border-neutral-300 px-3 py-2 text-sm';

  return (
    <div className="flex flex-col gap-8 rounded border border-neutral-200 bg-neutral-50 p-5">
      <div>
        <h3 className="mb-1 text-sm font-semibold uppercase tracking-wider text-neutral-700">Hero band</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs uppercase tracking-wider text-neutral-600">Eyebrow</span>
            <input
              type="text"
              value={value.hero.eyebrow}
              onChange={(e) => setHero({ eyebrow: e.target.value })}
              maxLength={120}
              className="rounded border border-neutral-300 bg-white px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs uppercase tracking-wider text-neutral-600">Headline</span>
            <input
              type="text"
              value={value.hero.title}
              onChange={(e) => setHero({ title: e.target.value })}
              maxLength={200}
              className="rounded border border-neutral-300 bg-white px-3 py-2"
            />
          </label>
        </div>
      </div>

      <div>
        <h3 className="mb-1 text-sm font-semibold uppercase tracking-wider text-neutral-700">
          Delivery tab
        </h3>
        <p className="mb-4 text-xs text-neutral-500">
          Top paragraph, shipping table rows, and an optional note rendered
          below the table (use it for the pre-order disclaimer or anything
          extra). Leave the note empty to hide it.
        </p>
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs uppercase tracking-wider text-neutral-600">Intro paragraph</span>
            <textarea
              value={value.delivery.intro}
              onChange={(e) => setDelivery({ intro: e.target.value })}
              rows={3}
              maxLength={2000}
              className="rounded border border-neutral-300 bg-white px-3 py-2"
            />
          </label>

          <div>
            <span className="block text-xs uppercase tracking-wider text-neutral-600 mb-2">
              Shipping rows
            </span>
            <div className="flex flex-col gap-2">
              {value.delivery.rows.map((r, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-1 gap-2 rounded border border-neutral-200 bg-white p-3 md:grid-cols-[1fr_1fr_1fr_1fr_auto]"
                >
                  <input
                    type="text"
                    value={r.destination}
                    onChange={(e) => setRow(idx, { destination: e.target.value })}
                    placeholder="Destination (e.g. United Kingdom)"
                    maxLength={120}
                    className={cellInputClass}
                  />
                  <input
                    type="text"
                    value={r.time}
                    onChange={(e) => setRow(idx, { time: e.target.value })}
                    placeholder="Time (e.g. 2–3 business days)"
                    maxLength={120}
                    className={cellInputClass}
                  />
                  <input
                    type="text"
                    value={r.carrier}
                    onChange={(e) => setRow(idx, { carrier: e.target.value })}
                    placeholder="Carrier"
                    maxLength={120}
                    className={cellInputClass}
                  />
                  <input
                    type="text"
                    value={r.cost}
                    onChange={(e) => setRow(idx, { cost: e.target.value })}
                    placeholder="Cost"
                    maxLength={120}
                    className={cellInputClass}
                  />
                  <button
                    type="button"
                    onClick={() => removeRow(idx)}
                    className="rounded border border-red-200 px-3 py-1 text-xs uppercase tracking-wider text-red-700 hover:bg-red-50"
                  >
                    Remove
                  </button>
                </div>
              ))}
              {value.delivery.rows.length < 20 && (
                <button
                  type="button"
                  onClick={addRow}
                  className="self-start rounded border border-neutral-300 bg-white px-3 py-2 text-xs uppercase tracking-wider text-neutral-700 hover:bg-neutral-100"
                >
                  + Add row
                </button>
              )}
            </div>
          </div>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs uppercase tracking-wider text-neutral-600">Note (below table)</span>
            <textarea
              value={value.delivery.note}
              onChange={(e) => setDelivery({ note: e.target.value })}
              rows={2}
              maxLength={2000}
              className="rounded border border-neutral-300 bg-white px-3 py-2"
            />
          </label>
        </div>
      </div>

      <div>
        <h3 className="mb-1 text-sm font-semibold uppercase tracking-wider text-neutral-700">Returns tab</h3>
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs uppercase tracking-wider text-neutral-600">Intro paragraph</span>
            <textarea
              value={value.returns.intro}
              onChange={(e) => setReturns({ intro: e.target.value })}
              rows={3}
              maxLength={2000}
              className="rounded border border-neutral-300 bg-white px-3 py-2"
            />
          </label>

          <div>
            <span className="block text-xs uppercase tracking-wider text-neutral-600 mb-2">Bullets</span>
            <div className="flex flex-col gap-2">
              {value.returns.bullets.map((b, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
                    type="text"
                    value={b}
                    onChange={(e) => setBullet(idx, e.target.value)}
                    maxLength={400}
                    className="flex-1 rounded border border-neutral-300 bg-white px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => removeBullet(idx)}
                    className="rounded border border-red-200 px-3 py-1 text-xs uppercase tracking-wider text-red-700 hover:bg-red-50"
                  >
                    Remove
                  </button>
                </div>
              ))}
              {value.returns.bullets.length < 20 && (
                <button
                  type="button"
                  onClick={addBullet}
                  className="self-start rounded border border-neutral-300 bg-white px-3 py-2 text-xs uppercase tracking-wider text-neutral-700 hover:bg-neutral-100"
                >
                  + Add bullet
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs uppercase tracking-wider text-neutral-600">CTA label</span>
              <input
                type="text"
                value={value.returns.ctaLabel}
                onChange={(e) => setReturns({ ctaLabel: e.target.value })}
                maxLength={120}
                className="rounded border border-neutral-300 bg-white px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs uppercase tracking-wider text-neutral-600">CTA URL</span>
              <input
                type="text"
                value={value.returns.ctaHref}
                onChange={(e) => setReturns({ ctaHref: e.target.value })}
                maxLength={400}
                className="rounded border border-neutral-300 bg-white px-3 py-2 font-mono"
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
