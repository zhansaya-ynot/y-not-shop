'use client';

import * as React from 'react';
import type {
  FooterContent,
  FooterColumn,
  FooterLink,
} from '@/lib/cms/footer-content';

interface Props {
  value: FooterContent;
  onChange: (next: FooterContent) => void;
}

export function FooterEditor({ value, onChange }: Props): React.ReactElement {
  function setColumn(idx: number, patch: Partial<FooterColumn>): void {
    const columns = value.columns.map((c, i) => (i === idx ? { ...c, ...patch } : c));
    onChange({ ...value, columns });
  }
  function addColumn(): void {
    if (value.columns.length >= 8) return;
    onChange({ ...value, columns: [...value.columns, { title: '', links: [] }] });
  }
  function removeColumn(idx: number): void {
    onChange({ ...value, columns: value.columns.filter((_, i) => i !== idx) });
  }
  function setLink(colIdx: number, linkIdx: number, patch: Partial<FooterLink>): void {
    const col = value.columns[colIdx];
    if (!col) return;
    const links = col.links.map((l, i) => (i === linkIdx ? { ...l, ...patch } : l));
    setColumn(colIdx, { links });
  }
  function addLink(colIdx: number): void {
    const col = value.columns[colIdx];
    if (!col || col.links.length >= 20) return;
    setColumn(colIdx, { links: [...col.links, { label: '', href: '' }] });
  }
  function removeLink(colIdx: number, linkIdx: number): void {
    const col = value.columns[colIdx];
    if (!col) return;
    setColumn(colIdx, { links: col.links.filter((_, i) => i !== linkIdx) });
  }

  return (
    <div className="flex flex-col gap-6 rounded border border-neutral-200 bg-neutral-50 p-5">
      <div>
        <h3 className="mb-1 text-sm font-semibold uppercase tracking-wider text-neutral-700">
          Footer columns
        </h3>
        <p className="mb-4 text-xs text-neutral-500">
          Each column = a title + a list of links. Default 3 columns
          (About / Customer Care / Product); add up to 8 if needed. The
          social column on the right is configured separately below.
        </p>
        <div className="flex flex-col gap-4">
          {value.columns.map((col, cidx) => (
            <div
              key={cidx}
              className="flex flex-col gap-3 rounded border border-neutral-200 bg-white p-4"
            >
              <div className="flex gap-2">
                <input
                  type="text"
                  value={col.title}
                  onChange={(e) => setColumn(cidx, { title: e.target.value })}
                  placeholder="Column title (e.g. About)"
                  maxLength={120}
                  className="flex-1 rounded border border-neutral-300 px-3 py-2 text-sm font-semibold uppercase tracking-wider"
                />
                <button
                  type="button"
                  onClick={() => removeColumn(cidx)}
                  className="rounded border border-red-200 px-3 py-1 text-xs uppercase tracking-wider text-red-700 hover:bg-red-50"
                >
                  Remove column
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {col.links.map((link, lidx) => (
                  <div
                    key={lidx}
                    className="grid grid-cols-1 gap-2 rounded border border-neutral-100 bg-neutral-50 p-2 md:grid-cols-[1fr_1fr_auto]"
                  >
                    <input
                      type="text"
                      value={link.label}
                      onChange={(e) => setLink(cidx, lidx, { label: e.target.value })}
                      placeholder="Link label"
                      maxLength={120}
                      className="rounded border border-neutral-300 bg-white px-3 py-2 text-sm"
                    />
                    <input
                      type="text"
                      value={link.href}
                      onChange={(e) => setLink(cidx, lidx, { href: e.target.value })}
                      placeholder="URL (/our-story or https://…)"
                      maxLength={400}
                      className="rounded border border-neutral-300 bg-white px-3 py-2 text-sm font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => removeLink(cidx, lidx)}
                      className="rounded border border-red-200 px-2 py-1 text-xs uppercase tracking-wider text-red-700 hover:bg-red-50"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                {col.links.length < 20 && (
                  <button
                    type="button"
                    onClick={() => addLink(cidx)}
                    className="self-start rounded border border-neutral-300 bg-white px-3 py-1 text-xs uppercase tracking-wider text-neutral-700 hover:bg-neutral-100"
                  >
                    + Add link
                  </button>
                )}
              </div>
            </div>
          ))}
          {value.columns.length < 8 && (
            <button
              type="button"
              onClick={addColumn}
              className="self-start rounded border border-neutral-300 bg-white px-3 py-2 text-xs uppercase tracking-wider text-neutral-700 hover:bg-neutral-100"
            >
              + Add column
            </button>
          )}
        </div>
      </div>

      <div>
        <h3 className="mb-1 text-sm font-semibold uppercase tracking-wider text-neutral-700">
          Social + bottom strip
        </h3>
        <div className="grid grid-cols-1 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs uppercase tracking-wider text-neutral-600">
              Instagram URL (empty to hide)
            </span>
            <input
              type="text"
              value={value.instagramUrl}
              onChange={(e) => onChange({ ...value, instagramUrl: e.target.value })}
              placeholder="https://instagram.com/…"
              maxLength={400}
              className="rounded border border-neutral-300 bg-white px-3 py-2 font-mono text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs uppercase tracking-wider text-neutral-600">
              Copyright line — use {'{year}'} for the current year
            </span>
            <input
              type="text"
              value={value.copyright}
              onChange={(e) => onChange({ ...value, copyright: e.target.value })}
              maxLength={400}
              className="rounded border border-neutral-300 bg-white px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs uppercase tracking-wider text-neutral-600">Tagline</span>
            <input
              type="text"
              value={value.tagline}
              onChange={(e) => onChange({ ...value, tagline: e.target.value })}
              maxLength={400}
              className="rounded border border-neutral-300 bg-white px-3 py-2"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
