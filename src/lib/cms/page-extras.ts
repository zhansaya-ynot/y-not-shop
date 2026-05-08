import { z } from 'zod';

/**
 * Per-page structured content beyond the body. Each known page's `extras`
 * column conforms to one of the schemas below — additional pages
 * (Contact info-grid, Shipping table, etc.) will be added here as we
 * migrate them off hardcoded JSX.
 */

export const ValueCalloutItemSchema = z.object({
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(400),
});

export const ValueCalloutsSchema = z.object({
  heading: z.string().max(120).default('What we stand for'),
  items: z.array(ValueCalloutItemSchema).max(8),
});

export const PullQuoteSchema = z.object({
  quote: z.string().min(1).max(400),
  attribution: z.string().max(200).default(''),
});

export const OurStoryExtrasSchema = z.object({
  valueCallouts: ValueCalloutsSchema.default({
    heading: 'What we stand for',
    items: [],
  }),
  pullQuote: PullQuoteSchema.default({ quote: '', attribution: '' }),
});

export type ValueCalloutItem = z.infer<typeof ValueCalloutItemSchema>;
export type ValueCallouts = z.infer<typeof ValueCalloutsSchema>;
export type PullQuote = z.infer<typeof PullQuoteSchema>;
export type OurStoryExtras = z.infer<typeof OurStoryExtrasSchema>;

/**
 * Defensive parse: tolerates legacy rows where `extras` is null or carries
 * a partial shape. Returns the parsed extras for the slug or null if the
 * stored value can't be coerced — callers fall back to bundled defaults.
 */
export function parseOurStoryExtras(raw: unknown): OurStoryExtras | null {
  if (!raw || typeof raw !== 'object') return null;
  const result = OurStoryExtrasSchema.safeParse(raw);
  return result.success ? result.data : null;
}
