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

// ─── Contact ─────────────────────────────────────────────────────────

export const ContactInfoBlockSchema = z.object({
  title: z.string().max(120).default(''),
  body: z.string().max(600).default(''),
  /** Optional accent link (e.g. mailto: or tel:) rendered above the body. */
  linkHref: z.string().max(400).default(''),
  linkLabel: z.string().max(200).default(''),
});

export const ContactExtrasSchema = z.object({
  hero: z
    .object({
      eyebrow: z.string().max(120).default('Get in touch'),
      title: z.string().max(200).default("We'd love to hear from you."),
    })
    .default({ eyebrow: 'Get in touch', title: "We'd love to hear from you." }),
  infoBlocks: z.array(ContactInfoBlockSchema).max(8).default([]),
  formSection: z
    .object({
      heading: z.string().max(120).default('Send us a message'),
      body: z.string().max(400).default(''),
    })
    .default({ heading: 'Send us a message', body: '' }),
});

export type ContactInfoBlock = z.infer<typeof ContactInfoBlockSchema>;
export type ContactExtras = z.infer<typeof ContactExtrasSchema>;

export function parseContactExtras(raw: unknown): ContactExtras | null {
  if (!raw || typeof raw !== 'object') return null;
  const result = ContactExtrasSchema.safeParse(raw);
  return result.success ? result.data : null;
}

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

