'use client';

import * as React from 'react';
import { marked } from 'marked';
import { useRouter } from 'next/navigation';
import { SingleImageUpload } from '@/app/admin/content/_components/single-image-upload';
import { RichTextEditor } from '@/components/admin/rich-text-editor';
import { OurStoryExtrasEditor } from './our-story-extras';
import { ContactExtrasEditor } from './contact-extras';
import { ShippingExtrasEditor } from './shipping-extras';
import {
  parseOurStoryExtras,
  parseContactExtras,
  parseShippingReturnsExtras,
  type OurStoryExtras,
  type ContactExtras,
  type ShippingReturnsExtras,
} from '@/lib/cms/page-extras';

interface Props {
  id: string;
  initial: {
    slug: string;
    title: string;
    bodyMarkdown: string;
    metaTitle: string;
    metaDescription: string;
    heroImage: string | null;
    extras?: Record<string, unknown> | null;
  };
}

/**
 * Detect whether a stored body is HTML (TipTap output, the new format)
 * versus legacy Markdown. Heuristic: a body that opens with a tag we know
 * the editor emits is HTML — anything else is treated as markdown and
 * up-converted on load. Older rows authored with the markdown textarea
 * survive without a backfill migration.
 */
function looksLikeHtml(body: string): boolean {
  const trimmed = body.trimStart();
  return /^<(p|h[1-6]|ul|ol|blockquote|div|table|hr|figure|br)\b/i.test(trimmed);
}

const OUR_STORY_DEFAULT_EXTRAS: OurStoryExtras = {
  valueCallouts: { heading: 'What we stand for', items: [] },
  pullQuote: { quote: '', attribution: '' },
};

const CONTACT_DEFAULT_EXTRAS: ContactExtras = {
  hero: { eyebrow: 'Get in touch', title: "We'd love to hear from you." },
  infoBlocks: [],
  formSection: { heading: 'Send us a message', body: '' },
};

const SHIPPING_DEFAULT_EXTRAS: ShippingReturnsExtras = {
  hero: { eyebrow: 'Shipping & Returns', title: 'Easy returns within 14 days.' },
  delivery: { intro: '', rows: [], note: '' },
  returns: {
    intro: '',
    bullets: [],
    ctaLabel: 'Start your return',
    ctaHref: '/initiate-return',
  },
};

/**
 * WYSIWYG page editor. Stores TipTap-rendered HTML in the existing
 * `bodyMarkdown` column — column name kept for migration tractability;
 * the storefront renderer detects HTML vs markdown via the same
 * heuristic above. Title, slug, hero image, meta tags, and (for known
 * slugs) page-specific structured extras share one Save.
 */
export function MarkdownEditor({ id, initial }: Props): React.ReactElement {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [title, setTitle] = React.useState(initial.title);
  const [slug, setSlug] = React.useState(initial.slug);
  // First-time HTML coercion: legacy markdown rows render through `marked`
  // so the visual editor sees the same formatting the storefront did.
  const [body, setBody] = React.useState(() =>
    looksLikeHtml(initial.bodyMarkdown)
      ? initial.bodyMarkdown
      : marked.parse(initial.bodyMarkdown ?? '', { async: false }) as string,
  );
  const [metaTitle, setMetaTitle] = React.useState(initial.metaTitle);
  const [metaDescription, setMetaDescription] = React.useState(initial.metaDescription);
  const [heroImage, setHeroImage] = React.useState<string>(initial.heroImage ?? '');
  const [ourStoryExtras, setOurStoryExtras] = React.useState<OurStoryExtras>(
    () => parseOurStoryExtras(initial.extras ?? null) ?? OUR_STORY_DEFAULT_EXTRAS,
  );
  const [contactExtras, setContactExtras] = React.useState<ContactExtras>(
    () => parseContactExtras(initial.extras ?? null) ?? CONTACT_DEFAULT_EXTRAS,
  );
  const [shippingExtras, setShippingExtras] = React.useState<ShippingReturnsExtras>(
    () => parseShippingReturnsExtras(initial.extras ?? null) ?? SHIPPING_DEFAULT_EXTRAS,
  );

  const isOurStory = initial.slug === 'our-story';
  const isContact = initial.slug === 'contact';
  const isShipping = initial.slug === 'shipping-returns';

  function onSave(): void {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const payload: Record<string, unknown> = {
        title,
        slug,
        bodyMarkdown: body,
        metaTitle,
        metaDescription,
        heroImage: heroImage.trim() || null,
      };
      if (isOurStory) payload.extras = ourStoryExtras;
      else if (isContact) payload.extras = contactExtras;
      else if (isShipping) payload.extras = shippingExtras;

      const res = await fetch(`/api/admin/content/pages/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setError(`Save failed (${res.status})`);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  function onDelete(): void {
    if (!confirm('Delete this page?')) return;
    startTransition(async () => {
      const res = await fetch(`/api/admin/content/pages/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        setError(`Delete failed (${res.status})`);
        return;
      }
      router.push('/admin/content/pages');
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs uppercase tracking-wider text-neutral-600">Title</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            className="border border-neutral-300 rounded px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs uppercase tracking-wider text-neutral-600">Slug</span>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            maxLength={200}
            className="border border-neutral-300 rounded px-3 py-2 font-mono"
          />
        </label>
      </div>

      <div className="flex flex-col gap-2 text-sm">
        <span className="text-xs uppercase tracking-wider text-neutral-600">
          Hero image (wide banner above the title)
        </span>
        <SingleImageUpload prefix="pages" value={heroImage} onChange={setHeroImage} />
        <span className="text-[11px] text-neutral-500">
          Shown at the top of /<code>{slug}</code>. Use a landscape image —
          recommended ~1920×800 px JPG. Empty = page renders without a hero.
        </span>
      </div>

      <div className="flex flex-col gap-2 text-sm">
        <span className="text-xs uppercase tracking-wider text-neutral-600">Body</span>
        <RichTextEditor
          value={body}
          onChange={setBody}
          minHeight={420}
          placeholder="Start writing the page body…"
        />
        <span className="text-[11px] text-neutral-500" data-testid="markdown-preview">
          Tip: paste from Word or Google Docs and formatting (headings,
          bold, lists) is preserved. The page on the live site uses the
          same typography you see here.
        </span>
      </div>

      {isOurStory && (
        <OurStoryExtrasEditor value={ourStoryExtras} onChange={setOurStoryExtras} />
      )}
      {isContact && (
        <ContactExtrasEditor value={contactExtras} onChange={setContactExtras} />
      )}
      {isShipping && (
        <ShippingExtrasEditor value={shippingExtras} onChange={setShippingExtras} />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs uppercase tracking-wider text-neutral-600">
            Meta title
          </span>
          <input
            type="text"
            value={metaTitle}
            onChange={(e) => setMetaTitle(e.target.value)}
            maxLength={200}
            className="border border-neutral-300 rounded px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs uppercase tracking-wider text-neutral-600">
            Meta description
          </span>
          <input
            type="text"
            value={metaDescription}
            onChange={(e) => setMetaDescription(e.target.value)}
            maxLength={500}
            className="border border-neutral-300 rounded px-3 py-2"
          />
        </label>
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}
      {saved && <p className="text-sm text-green-700">Saved.</p>}
      <div className="flex gap-3 mt-2">
        <button
          type="button"
          onClick={onSave}
          disabled={pending}
          className="px-4 py-2 bg-neutral-900 text-white text-xs uppercase tracking-wider rounded disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={pending}
          className="ml-auto px-4 py-2 border border-red-300 text-red-700 text-xs uppercase tracking-wider rounded hover:bg-red-50 disabled:opacity-50"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
