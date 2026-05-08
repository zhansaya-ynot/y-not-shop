'use client';

import * as React from 'react';
import type { ContactExtras, ContactInfoBlock } from '@/lib/cms/page-extras';

interface Props {
  value: ContactExtras;
  onChange: (next: ContactExtras) => void;
}

/**
 * Page-specific editor for the Contact extras: hero (eyebrow + title),
 * 4 info blocks (Customer care / Studio / WhatsApp / Press by default,
 * but freely renamable), and the form section copy.
 */
export function ContactExtrasEditor({ value, onChange }: Props): React.ReactElement {
  function setHero(patch: Partial<ContactExtras['hero']>): void {
    onChange({ ...value, hero: { ...value.hero, ...patch } });
  }

  function setBlock(idx: number, patch: Partial<ContactInfoBlock>): void {
    const infoBlocks = value.infoBlocks.map((b, i) => (i === idx ? { ...b, ...patch } : b));
    onChange({ ...value, infoBlocks });
  }

  function addBlock(): void {
    if (value.infoBlocks.length >= 8) return;
    onChange({
      ...value,
      infoBlocks: [
        ...value.infoBlocks,
        { title: '', body: '', linkHref: '', linkLabel: '' },
      ],
    });
  }

  function removeBlock(idx: number): void {
    onChange({
      ...value,
      infoBlocks: value.infoBlocks.filter((_, i) => i !== idx),
    });
  }

  function setForm(patch: Partial<ContactExtras['formSection']>): void {
    onChange({ ...value, formSection: { ...value.formSection, ...patch } });
  }

  return (
    <div className="flex flex-col gap-8 rounded border border-neutral-200 bg-neutral-50 p-5">
      <div>
        <h3 className="mb-1 text-sm font-semibold uppercase tracking-wider text-neutral-700">
          Hero band
        </h3>
        <p className="mb-4 text-xs text-neutral-500">
          The small uppercase eyebrow and large headline at the top of the page.
        </p>
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
          Info blocks
        </h3>
        <p className="mb-4 text-xs text-neutral-500">
          The four-tile grid (Customer care, Studio, WhatsApp, Press).
          Add a link if the block should highlight a clickable email or
          phone number — leave both link fields empty for a text-only
          block. Drag through max 8 entries.
        </p>
        <div className="flex flex-col gap-4">
          {value.infoBlocks.map((b, idx) => (
            <div
              key={idx}
              className="flex flex-col gap-2 rounded border border-neutral-200 bg-white p-3"
            >
              <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_auto]">
                <input
                  type="text"
                  value={b.title}
                  onChange={(e) => setBlock(idx, { title: e.target.value })}
                  placeholder="Section title (e.g. Customer care)"
                  maxLength={120}
                  className="rounded border border-neutral-300 px-3 py-2 text-sm font-medium uppercase tracking-wider"
                />
                <input
                  type="text"
                  value={b.linkLabel}
                  onChange={(e) => setBlock(idx, { linkLabel: e.target.value })}
                  placeholder="Link label (e.g. hello@ynotlondon.com)"
                  maxLength={200}
                  className="rounded border border-neutral-300 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => removeBlock(idx)}
                  className="rounded border border-red-200 px-3 py-1 text-xs uppercase tracking-wider text-red-700 hover:bg-red-50"
                >
                  Remove
                </button>
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <input
                  type="text"
                  value={b.linkHref}
                  onChange={(e) => setBlock(idx, { linkHref: e.target.value })}
                  placeholder="Link URL (mailto:..., tel:..., https://...) — optional"
                  maxLength={400}
                  className="rounded border border-neutral-300 px-3 py-2 text-sm font-mono"
                />
                <input
                  type="text"
                  value={b.body}
                  onChange={(e) => setBlock(idx, { body: e.target.value })}
                  placeholder="Body text (e.g. Response within 24h)"
                  maxLength={600}
                  className="rounded border border-neutral-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
          ))}
          {value.infoBlocks.length < 8 && (
            <button
              type="button"
              onClick={addBlock}
              className="self-start rounded border border-neutral-300 bg-white px-3 py-2 text-xs uppercase tracking-wider text-neutral-700 hover:bg-neutral-100"
            >
              + Add info block
            </button>
          )}
        </div>
      </div>

      <div>
        <h3 className="mb-1 text-sm font-semibold uppercase tracking-wider text-neutral-700">
          Form section
        </h3>
        <p className="mb-4 text-xs text-neutral-500">
          Heading and intro line above the contact form on the cream
          background. Leave the heading empty to hide it.
        </p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs uppercase tracking-wider text-neutral-600">Heading</span>
            <input
              type="text"
              value={value.formSection.heading}
              onChange={(e) => setForm({ heading: e.target.value })}
              maxLength={120}
              className="rounded border border-neutral-300 bg-white px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs uppercase tracking-wider text-neutral-600">Intro line</span>
            <input
              type="text"
              value={value.formSection.body}
              onChange={(e) => setForm({ body: e.target.value })}
              maxLength={400}
              className="rounded border border-neutral-300 bg-white px-3 py-2"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
