'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { SingleImageUpload } from '@/app/admin/content/_components/single-image-upload';
import { FooterEditor } from './footer-editor';
import {
  parseFooterContent,
  FOOTER_FALLBACK,
  type FooterContent,
} from '@/lib/cms/footer-content';

interface Initial {
  defaultCurrency: 'GBP' | 'USD' | 'EUR';
  defaultCarrier: 'ROYAL_MAIL' | 'DHL';
  freeShipThresholdCents: number;
  contactEmail: string;
  whatsappNumber: string;
  whatsappMessage: string;
  authSignInImage: string | null;
  authRegisterImage: string | null;
  brandStatementPrimary: string;
  brandStatementSecondary: string;
  brandStatementTertiary: string;
  footerJson: unknown;
}

interface Props {
  initial: Initial;
}

/**
 * Singleton SitePolicy form. Posts the full snapshot to PATCH
 * /api/admin/content/settings; the service upserts so the row is created on
 * first save when seed data hasn't been applied.
 */
export function SitePolicyForm({ initial }: Props): React.ReactElement {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [defaultCurrency, setDefaultCurrency] = React.useState(initial.defaultCurrency);
  const [defaultCarrier, setDefaultCarrier] = React.useState(initial.defaultCarrier);
  const [freeShipThreshold, setFreeShipThreshold] = React.useState(
    String(initial.freeShipThresholdCents),
  );
  const [contactEmail, setContactEmail] = React.useState(initial.contactEmail);
  const [whatsappNumber, setWhatsappNumber] = React.useState(initial.whatsappNumber);
  const [whatsappMessage, setWhatsappMessage] = React.useState(initial.whatsappMessage);
  const [authSignInImage, setAuthSignInImage] = React.useState<string>(initial.authSignInImage ?? '');
  const [authRegisterImage, setAuthRegisterImage] = React.useState<string>(initial.authRegisterImage ?? '');
  const [brandPrimary, setBrandPrimary] = React.useState<string>(initial.brandStatementPrimary);
  const [brandSecondary, setBrandSecondary] = React.useState<string>(initial.brandStatementSecondary);
  const [brandTertiary, setBrandTertiary] = React.useState<string>(initial.brandStatementTertiary);
  const [footerContent, setFooterContent] = React.useState<FooterContent>(
    () => parseFooterContent(initial.footerJson) || FOOTER_FALLBACK,
  );

  function onSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const threshold = Number.parseInt(freeShipThreshold, 10);
    if (!Number.isFinite(threshold) || threshold < 0) {
      setError('Free shipping threshold must be a non-negative integer.');
      return;
    }
    startTransition(async () => {
      const res = await fetch('/api/admin/content/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          defaultCurrency,
          defaultCarrier,
          freeShipThresholdCents: threshold,
          contactEmail,
          whatsappNumber,
          whatsappMessage,
          authSignInImage: authSignInImage.trim() || null,
          authRegisterImage: authRegisterImage.trim() || null,
          brandStatementPrimary: brandPrimary.trim(),
          brandStatementSecondary: brandSecondary.trim(),
          brandStatementTertiary: brandTertiary.trim(),
          footerJson: footerContent,
        }),
      });
      if (!res.ok) {
        setError(`Save failed (${res.status})`);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs uppercase tracking-wider text-neutral-600">
          Default currency
        </span>
        <select
          value={defaultCurrency}
          onChange={(e) =>
            setDefaultCurrency(e.target.value as Initial['defaultCurrency'])
          }
          className="border border-neutral-300 rounded px-3 py-2 bg-white w-40"
        >
          <option value="GBP">GBP</option>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs uppercase tracking-wider text-neutral-600">
          Default carrier
        </span>
        <select
          value={defaultCarrier}
          onChange={(e) => setDefaultCarrier(e.target.value as Initial['defaultCarrier'])}
          className="border border-neutral-300 rounded px-3 py-2 bg-white w-40"
        >
          <option value="ROYAL_MAIL">Royal Mail</option>
          <option value="DHL">DHL</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs uppercase tracking-wider text-neutral-600">
          Free-shipping threshold (in pence — e.g. 20000 = £200)
        </span>
        <input
          type="number"
          min={0}
          step={1}
          value={freeShipThreshold}
          onChange={(e) => setFreeShipThreshold(e.target.value)}
          className="border border-neutral-300 rounded px-3 py-2 w-40"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs uppercase tracking-wider text-neutral-600">
          Contact email
        </span>
        <input
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          className="border border-neutral-300 rounded px-3 py-2 max-w-md"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs uppercase tracking-wider text-neutral-600">
          WhatsApp number
        </span>
        <input
          type="text"
          value={whatsappNumber}
          onChange={(e) => setWhatsappNumber(e.target.value)}
          maxLength={40}
          className="border border-neutral-300 rounded px-3 py-2 max-w-md font-mono text-sm"
          placeholder="e.g. +44 20 1234 5678"
        />
        <span className="text-[11px] text-neutral-500">
          Empty hides the floating WhatsApp button site-wide.
        </span>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs uppercase tracking-wider text-neutral-600">
          WhatsApp pre-filled message
        </span>
        <input
          type="text"
          value={whatsappMessage}
          onChange={(e) => setWhatsappMessage(e.target.value)}
          maxLength={400}
          className="border border-neutral-300 rounded px-3 py-2 max-w-md text-sm"
          placeholder="Hi YNOT, I have a question."
        />
        <span className="text-[11px] text-neutral-500">
          Pre-filled in the chat input when a customer taps the floating
          WhatsApp button.
        </span>
      </label>
      <fieldset className="flex flex-col gap-3 text-sm pt-4 border-t border-neutral-200">
        <legend className="text-xs uppercase tracking-wider text-neutral-600 mb-1">
          Brand statement (homepage)
        </legend>
        <p className="text-[11px] text-neutral-500 -mt-2 mb-1">
          Three-line block shown between the hero image and the &lsquo;Shop by
          Category&rsquo; grid on the homepage. Line 1 is the display heading,
          lines 2 &amp; 3 are short eyebrow lines.
        </p>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wider text-neutral-500">
            Primary line (display heading)
          </span>
          <textarea
            rows={2}
            value={brandPrimary}
            onChange={(e) => setBrandPrimary(e.target.value)}
            maxLength={280}
            className="border border-neutral-300 rounded px-3 py-2"
          />
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wider text-neutral-500">
              Secondary line
            </span>
            <input
              type="text"
              value={brandSecondary}
              onChange={(e) => setBrandSecondary(e.target.value)}
              maxLength={80}
              className="border border-neutral-300 rounded px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wider text-neutral-500">
              Tertiary line
            </span>
            <input
              type="text"
              value={brandTertiary}
              onChange={(e) => setBrandTertiary(e.target.value)}
              maxLength={80}
              className="border border-neutral-300 rounded px-3 py-2"
            />
          </label>
        </div>
      </fieldset>
      <div className="flex flex-col gap-2 text-sm pt-4 border-t border-neutral-200">
        <span className="text-xs uppercase tracking-wider text-neutral-600">
          Sign-in side image
        </span>
        <SingleImageUpload
          prefix="auth"
          value={authSignInImage}
          onChange={setAuthSignInImage}
        />
        <span className="text-[11px] text-neutral-500">
          Shown next to the form on /sign-in. Recommended portrait/square JPG.
        </span>
      </div>
      <div className="flex flex-col gap-2 text-sm">
        <span className="text-xs uppercase tracking-wider text-neutral-600">
          Register side image
        </span>
        <SingleImageUpload
          prefix="auth"
          value={authRegisterImage}
          onChange={setAuthRegisterImage}
        />
        <span className="text-[11px] text-neutral-500">
          Shown next to the form on /register. Same format as sign-in.
        </span>
      </div>
      <fieldset className="flex flex-col gap-2 pt-4 border-t border-neutral-200">
        <legend className="text-xs uppercase tracking-wider text-neutral-600 mb-2">
          Footer
        </legend>
        <FooterEditor value={footerContent} onChange={setFooterContent} />
      </fieldset>
      {error && <p className="text-sm text-red-700">{error}</p>}
      {saved && <p className="text-sm text-green-700">Saved.</p>}
      <div className="flex gap-3 mt-2">
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 bg-neutral-900 text-white text-xs uppercase tracking-wider rounded disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save settings'}
        </button>
      </div>
    </form>
  );
}
