'use client';

import * as React from 'react';
import type {
  ProductCareExtras,
  CareMaterial,
  CareSection,
} from '@/lib/cms/page-extras';

interface Props {
  value: ProductCareExtras;
  onChange: (next: ProductCareExtras) => void;
}

/**
 * Editor for the Product Care page: hero + tabbed materials. Each
 * material has an intro paragraph and a list of titled care sections
 * (Cleaning / Protection / Storage by default, but freely renamable).
 */
export function CareExtrasEditor({ value, onChange }: Props): React.ReactElement {
  function setHero(patch: Partial<ProductCareExtras['hero']>): void {
    onChange({ ...value, hero: { ...value.hero, ...patch } });
  }

  function setMaterial(idx: number, patch: Partial<CareMaterial>): void {
    const materials = value.materials.map((m, i) =>
      i === idx ? { ...m, ...patch } : m,
    );
    onChange({ ...value, materials });
  }
  function addMaterial(): void {
    if (value.materials.length >= 12) return;
    onChange({
      ...value,
      materials: [
        ...value.materials,
        { value: `mat-${Date.now()}`, label: '', intro: '', sections: [] },
      ],
    });
  }
  function removeMaterial(idx: number): void {
    onChange({ ...value, materials: value.materials.filter((_, i) => i !== idx) });
  }

  function setSection(matIdx: number, secIdx: number, patch: Partial<CareSection>): void {
    const mat = value.materials[matIdx];
    if (!mat) return;
    const sections = mat.sections.map((s, i) => (i === secIdx ? { ...s, ...patch } : s));
    setMaterial(matIdx, { sections });
  }
  function addSection(matIdx: number): void {
    const mat = value.materials[matIdx];
    if (!mat || mat.sections.length >= 10) return;
    setMaterial(matIdx, { sections: [...mat.sections, { title: '', body: '' }] });
  }
  function removeSection(matIdx: number, secIdx: number): void {
    const mat = value.materials[matIdx];
    if (!mat) return;
    setMaterial(matIdx, { sections: mat.sections.filter((_, i) => i !== secIdx) });
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
            <span className="text-xs uppercase tracking-wider text-neutral-600">Description</span>
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
        <h3 className="mb-1 text-sm font-semibold uppercase tracking-wider text-neutral-700">
          Material tabs
        </h3>
        <p className="mb-4 text-xs text-neutral-500">
          Each tab = one material with an intro paragraph and a list of
          care sections. Default is 5 materials × 3 sections (Cleaning /
          Protection / Storage), but feel free to add or rename anything.
        </p>
        <div className="flex flex-col gap-4">
          {value.materials.map((m, midx) => (
            <div key={m.value} className="flex flex-col gap-3 rounded border border-neutral-200 bg-white p-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={m.label}
                  onChange={(e) => setMaterial(midx, { label: e.target.value })}
                  placeholder="Material name (e.g. Leather)"
                  maxLength={60}
                  className="flex-1 rounded border border-neutral-300 px-3 py-2 text-sm font-semibold uppercase tracking-wider"
                />
                <button
                  type="button"
                  onClick={() => removeMaterial(midx)}
                  className="rounded border border-red-200 px-3 py-1 text-xs uppercase tracking-wider text-red-700 hover:bg-red-50"
                >
                  Remove material
                </button>
              </div>
              <textarea
                value={m.intro}
                onChange={(e) => setMaterial(midx, { intro: e.target.value })}
                placeholder="Intro paragraph for this material"
                rows={2}
                maxLength={800}
                className="rounded border border-neutral-300 px-3 py-2 text-sm"
              />
              <div className="flex flex-col gap-2">
                {m.sections.map((s, sidx) => (
                  <div key={sidx} className="grid grid-cols-1 gap-2 rounded border border-neutral-100 bg-neutral-50 p-3 md:grid-cols-[180px_1fr_auto]">
                    <input
                      type="text"
                      value={s.title}
                      onChange={(e) => setSection(midx, sidx, { title: e.target.value })}
                      placeholder="Section title"
                      maxLength={120}
                      className="rounded border border-neutral-300 bg-white px-3 py-2 text-sm font-medium"
                    />
                    <textarea
                      value={s.body}
                      onChange={(e) => setSection(midx, sidx, { body: e.target.value })}
                      placeholder="Section body"
                      rows={2}
                      maxLength={1200}
                      className="rounded border border-neutral-300 bg-white px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => removeSection(midx, sidx)}
                      className="rounded border border-red-200 px-2 py-1 text-xs uppercase tracking-wider text-red-700 hover:bg-red-50 self-start"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                {m.sections.length < 10 && (
                  <button
                    type="button"
                    onClick={() => addSection(midx)}
                    className="self-start rounded border border-neutral-300 bg-white px-3 py-1 text-xs uppercase tracking-wider text-neutral-700 hover:bg-neutral-100"
                  >
                    + Add section
                  </button>
                )}
              </div>
            </div>
          ))}
          {value.materials.length < 12 && (
            <button
              type="button"
              onClick={addMaterial}
              className="self-start rounded border border-neutral-300 bg-white px-3 py-2 text-xs uppercase tracking-wider text-neutral-700 hover:bg-neutral-100"
            >
              + Add material
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
