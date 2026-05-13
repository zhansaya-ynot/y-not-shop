'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { SingleImageUpload } from '../../../_components/single-image-upload';
import { SingleVideoUpload } from '../../../_components/single-video-upload';

/**
 * Hero create form. New heroes are always inserted with `isActive=false` —
 * activation is a separate explicit step (Activate button on the list page)
 * so accidental imports don't clobber the live hero.
 *
 * Kind toggle behaves the same way as the edit form: image and video URLs
 * are kept in independent state, so flipping between modes never loses
 * a previously uploaded asset.
 */
export function HeroCreateForm(): React.ReactElement {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [kind, setKind] = React.useState<'IMAGE' | 'VIDEO'>('IMAGE');
  const [imageUrl, setImageUrl] = React.useState('');
  const [videoUrl, setVideoUrl] = React.useState('');
  const [eyebrow, setEyebrow] = React.useState('');
  const [ctaLabel, setCtaLabel] = React.useState('');
  const [ctaHref, setCtaHref] = React.useState('');

  function onSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    setError(null);
    if (kind === 'IMAGE' && !imageUrl) {
      setError('Upload an image or paste an image URL.');
      return;
    }
    if (kind === 'VIDEO' && !videoUrl) {
      setError('Upload a video or paste a video URL.');
      return;
    }
    if (!eyebrow || !ctaLabel || !ctaHref) {
      setError('Eyebrow, CTA label and CTA href are required.');
      return;
    }
    startTransition(async () => {
      const res = await fetch('/api/admin/content/hero', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          // Submit both so we don't drop work the operator did in the
          // other mode. For VIDEO heroes without a separate poster image
          // we fall back to the video URL itself so the NOT NULL DB
          // constraint on imageUrl stays satisfied.
          imageUrl: imageUrl || videoUrl,
          videoUrl: kind === 'VIDEO' ? videoUrl : undefined,
          eyebrow,
          ctaLabel,
          ctaHref,
        }),
      });
      if (!res.ok) {
        setError(`Create failed (${res.status})`);
        return;
      }
      const hero = await res.json();
      router.push(`/admin/content/hero/${hero.id}`);
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs uppercase tracking-wider text-neutral-600">Kind</span>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as 'IMAGE' | 'VIDEO')}
          className="border border-neutral-300 rounded px-3 py-2 bg-white"
        >
          <option value="IMAGE">Image</option>
          <option value="VIDEO">Video</option>
        </select>
      </label>

      {kind === 'IMAGE' ? (
        <div className="flex flex-col gap-1 text-sm">
          <span className="text-xs uppercase tracking-wider text-neutral-600">Image</span>
          <SingleImageUpload prefix="hero" value={imageUrl} onChange={setImageUrl} />
          <label className="flex flex-col gap-1 mt-2">
            <span className="text-xs uppercase tracking-wider text-neutral-600">Image URL</span>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="border border-neutral-300 rounded px-3 py-2 font-mono text-xs"
            />
          </label>
          <p className="text-xs text-neutral-500 leading-relaxed mt-1">
            <strong>Recommended:</strong> JPEG or WebP, 1920×1080 or larger
            (16:9), ≤500KB. Hard upload limit 5MB.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1 text-sm">
          <span className="text-xs uppercase tracking-wider text-neutral-600">Video</span>
          <SingleVideoUpload prefix="hero" value={videoUrl} onChange={setVideoUrl} />
          <label className="flex flex-col gap-1 mt-2">
            <span className="text-xs uppercase tracking-wider text-neutral-600">Video URL</span>
            <input
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              className="border border-neutral-300 rounded px-3 py-2 font-mono text-xs"
            />
          </label>
          <p className="text-xs text-neutral-500 leading-relaxed mt-1">
            <strong>Recommended:</strong> MP4 H.264, 1920×1080, 5–10s loop,
            no audio, ≤8MB. Hard upload limit 20MB. WebM and MOV also
            accepted.
          </p>
        </div>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs uppercase tracking-wider text-neutral-600">Eyebrow</span>
        <input
          type="text"
          value={eyebrow}
          onChange={(e) => setEyebrow(e.target.value)}
          required
          maxLength={120}
          className="border border-neutral-300 rounded px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs uppercase tracking-wider text-neutral-600">CTA label</span>
        <input
          type="text"
          value={ctaLabel}
          onChange={(e) => setCtaLabel(e.target.value)}
          required
          maxLength={60}
          className="border border-neutral-300 rounded px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs uppercase tracking-wider text-neutral-600">CTA href</span>
        <input
          type="text"
          value={ctaHref}
          onChange={(e) => setCtaHref(e.target.value)}
          required
          maxLength={500}
          className="border border-neutral-300 rounded px-3 py-2 font-mono text-xs"
        />
      </label>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <div className="flex gap-3 mt-2">
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 bg-neutral-900 text-white text-xs uppercase tracking-wider rounded disabled:opacity-50"
        >
          {pending ? 'Creating…' : 'Create hero'}
        </button>
      </div>
    </form>
  );
}
