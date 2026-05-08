'use client';

import * as React from 'react';
import type { OurStoryExtras, ValueCalloutItem } from '@/lib/cms/page-extras';

interface Props {
  value: OurStoryExtras;
  onChange: (next: OurStoryExtras) => void;
}

/**
 * Page-specific editor for the Our Story extras blob: 4 value callouts
 * (title + body each) and a pull quote (text + attribution). Renders as
 * inline form fields under the body editor — operator never touches JSON.
 */
export function OurStoryExtrasEditor({ value, onChange }: Props): React.ReactElement {
  const callouts: OurStoryExtras['valueCallouts'] = value.valueCallouts ?? {
    heading: 'What we stand for',
    items: [],
  };
  const quote: OurStoryExtras['pullQuote'] = value.pullQuote ?? {
    quote: '',
    attribution: '',
  };

  function setCalloutHeading(next: string): void {
    onChange({
      ...value,
      valueCallouts: { ...callouts, heading: next },
    });
  }

  function setCalloutItem(idx: number, patch: Partial<ValueCalloutItem>): void {
    const items = callouts.items.map((it, i) => (i === idx ? { ...it, ...patch } : it));
    onChange({ ...value, valueCallouts: { ...callouts, items } });
  }

  function addCalloutItem(): void {
    if (callouts.items.length >= 8) return;
    onChange({
      ...value,
      valueCallouts: {
        ...callouts,
        items: [...callouts.items, { title: '', body: '' }],
      },
    });
  }

  function removeCalloutItem(idx: number): void {
    onChange({
      ...value,
      valueCallouts: {
        ...callouts,
        items: callouts.items.filter((_, i) => i !== idx),
      },
    });
  }

  function setQuote(patch: Partial<typeof quote>): void {
    onChange({ ...value, pullQuote: { ...quote, ...patch } });
  }

  return (
    <div className="flex flex-col gap-8 rounded border border-neutral-200 bg-neutral-50 p-5">
      <div>
        <h3 className="mb-1 text-sm font-semibold uppercase tracking-wider text-neutral-700">
          Value callouts
        </h3>
        <p className="mb-4 text-xs text-neutral-500">
          The four-tile band on the cream background. Each tile = a short
          headline plus one-sentence body.
        </p>

        <label className="mb-4 flex flex-col gap-1 text-sm">
          <span className="text-xs uppercase tracking-wider text-neutral-600">
            Section heading
          </span>
          <input
            type="text"
            value={callouts.heading}
            onChange={(e) => setCalloutHeading(e.target.value)}
            maxLength={120}
            className="rounded border border-neutral-300 bg-white px-3 py-2"
          />
        </label>

        <div className="flex flex-col gap-3">
          {callouts.items.map((item, idx) => (
            <div
              key={idx}
              className="grid grid-cols-1 gap-2 rounded border border-neutral-200 bg-white p-3 md:grid-cols-[200px_1fr_auto]"
            >
              <input
                type="text"
                value={item.title}
                onChange={(e) => setCalloutItem(idx, { title: e.target.value })}
                placeholder="Title"
                maxLength={120}
                className="rounded border border-neutral-300 px-3 py-2 text-sm font-medium"
              />
              <input
                type="text"
                value={item.body}
                onChange={(e) => setCalloutItem(idx, { body: e.target.value })}
                placeholder="Body"
                maxLength={400}
                className="rounded border border-neutral-300 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => removeCalloutItem(idx)}
                className="rounded border border-red-200 px-3 py-1 text-xs uppercase tracking-wider text-red-700 hover:bg-red-50"
              >
                Remove
              </button>
            </div>
          ))}
          {callouts.items.length < 8 && (
            <button
              type="button"
              onClick={addCalloutItem}
              className="self-start rounded border border-neutral-300 bg-white px-3 py-2 text-xs uppercase tracking-wider text-neutral-700 hover:bg-neutral-100"
            >
              + Add callout
            </button>
          )}
        </div>
      </div>

      <div>
        <h3 className="mb-1 text-sm font-semibold uppercase tracking-wider text-neutral-700">
          Pull quote
        </h3>
        <p className="mb-4 text-xs text-neutral-500">
          The large centred quote near the bottom of the page. Leave the
          quote empty to hide the section entirely.
        </p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm md:col-span-2">
            <span className="text-xs uppercase tracking-wider text-neutral-600">Quote</span>
            <textarea
              value={quote.quote}
              onChange={(e) => setQuote({ quote: e.target.value })}
              maxLength={400}
              rows={3}
              className="rounded border border-neutral-300 bg-white px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs uppercase tracking-wider text-neutral-600">
              Attribution (e.g. designer name)
            </span>
            <input
              type="text"
              value={quote.attribution}
              onChange={(e) => setQuote({ attribution: e.target.value })}
              maxLength={200}
              className="rounded border border-neutral-300 bg-white px-3 py-2"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
