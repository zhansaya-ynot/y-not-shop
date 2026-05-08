'use client';

import * as React from 'react';
import type {
  SustainabilityExtras,
  StatItem,
  ApproachItem,
} from '@/lib/cms/page-extras';

interface Props {
  value: SustainabilityExtras;
  onChange: (next: SustainabilityExtras) => void;
}

export function SustainabilityExtrasEditor({ value, onChange }: Props): React.ReactElement {
  function setHero(patch: Partial<SustainabilityExtras['hero']>): void {
    onChange({ ...value, hero: { ...value.hero, ...patch } });
  }

  function setStat(idx: number, patch: Partial<StatItem>): void {
    const stats = value.stats.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    onChange({ ...value, stats });
  }
  function addStat(): void {
    if (value.stats.length >= 6) return;
    onChange({ ...value, stats: [...value.stats, { value: '', label: '' }] });
  }
  function removeStat(idx: number): void {
    onChange({ ...value, stats: value.stats.filter((_, i) => i !== idx) });
  }

  function setApproach(idx: number, patch: Partial<ApproachItem>): void {
    const approaches = value.approaches.map((a, i) => (i === idx ? { ...a, ...patch } : a));
    onChange({ ...value, approaches });
  }
  function addApproach(): void {
    if (value.approaches.length >= 12) return;
    onChange({ ...value, approaches: [...value.approaches, { title: '', body: '' }] });
  }
  function removeApproach(idx: number): void {
    onChange({ ...value, approaches: value.approaches.filter((_, i) => i !== idx) });
  }

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
          <label className="flex flex-col gap-1 text-sm md:col-span-2">
            <span className="text-xs uppercase tracking-wider text-neutral-600">Description (under headline)</span>
            <textarea
              value={value.hero.description}
              onChange={(e) => setHero({ description: e.target.value })}
              rows={3}
              maxLength={800}
              className="rounded border border-neutral-300 bg-white px-3 py-2"
            />
          </label>
        </div>
      </div>

      <div>
        <h3 className="mb-1 text-sm font-semibold uppercase tracking-wider text-neutral-700">Stats band</h3>
        <p className="mb-4 text-xs text-neutral-500">Big number + label tiles. Up to 6.</p>
        <div className="flex flex-col gap-2">
          {value.stats.map((s, idx) => (
            <div
              key={idx}
              className="grid grid-cols-1 gap-2 rounded border border-neutral-200 bg-white p-3 md:grid-cols-[160px_1fr_auto]"
            >
              <input
                type="text"
                value={s.value}
                onChange={(e) => setStat(idx, { value: e.target.value })}
                placeholder="0%"
                maxLength={40}
                className="rounded border border-neutral-300 px-3 py-2 text-sm font-semibold"
              />
              <input
                type="text"
                value={s.label}
                onChange={(e) => setStat(idx, { label: e.target.value })}
                placeholder="Leather waste"
                maxLength={120}
                className="rounded border border-neutral-300 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => removeStat(idx)}
                className="rounded border border-red-200 px-3 py-1 text-xs uppercase tracking-wider text-red-700 hover:bg-red-50"
              >
                Remove
              </button>
            </div>
          ))}
          {value.stats.length < 6 && (
            <button
              type="button"
              onClick={addStat}
              className="self-start rounded border border-neutral-300 bg-white px-3 py-2 text-xs uppercase tracking-wider text-neutral-700 hover:bg-neutral-100"
            >
              + Add stat
            </button>
          )}
        </div>
      </div>

      <div>
        <h3 className="mb-1 text-sm font-semibold uppercase tracking-wider text-neutral-700">Our approach</h3>
        <p className="mb-4 text-xs text-neutral-500">Two-column grid of value statements (title + paragraph).</p>
        <label className="mb-4 flex flex-col gap-1 text-sm">
          <span className="text-xs uppercase tracking-wider text-neutral-600">Section heading</span>
          <input
            type="text"
            value={value.approachHeading}
            onChange={(e) => onChange({ ...value, approachHeading: e.target.value })}
            maxLength={120}
            className="rounded border border-neutral-300 bg-white px-3 py-2"
          />
        </label>
        <div className="flex flex-col gap-3">
          {value.approaches.map((a, idx) => (
            <div key={idx} className="flex flex-col gap-2 rounded border border-neutral-200 bg-white p-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={a.title}
                  onChange={(e) => setApproach(idx, { title: e.target.value })}
                  placeholder="Title (e.g. By-product sourcing)"
                  maxLength={120}
                  className="flex-1 rounded border border-neutral-300 px-3 py-2 text-sm font-medium"
                />
                <button
                  type="button"
                  onClick={() => removeApproach(idx)}
                  className="rounded border border-red-200 px-3 py-1 text-xs uppercase tracking-wider text-red-700 hover:bg-red-50"
                >
                  Remove
                </button>
              </div>
              <textarea
                value={a.body}
                onChange={(e) => setApproach(idx, { body: e.target.value })}
                placeholder="Body paragraph"
                rows={3}
                maxLength={800}
                className="rounded border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
          ))}
          {value.approaches.length < 12 && (
            <button
              type="button"
              onClick={addApproach}
              className="self-start rounded border border-neutral-300 bg-white px-3 py-2 text-xs uppercase tracking-wider text-neutral-700 hover:bg-neutral-100"
            >
              + Add approach
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
