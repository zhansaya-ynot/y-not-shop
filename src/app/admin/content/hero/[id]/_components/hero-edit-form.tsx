'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { SingleImageUpload } from '../../../_components/single-image-upload';
import { SingleVideoUpload } from '../../../_components/single-video-upload';

interface Initial {
  kind: 'IMAGE' | 'VIDEO';
  imageUrl: string;
  videoUrl: string | null;
  eyebrow: string;
  ctaLabel: string;
  ctaHref: string;
}

interface Props {
  id: string;
  initial: Initial;
}

/**
 * Hero edit form with a Kind toggle that switches between an image-only
 * and a video-only upload UI. Both URLs are kept in state independently
 * so flipping back and forth never destroys what was previously
 * uploaded — only the rendered uploader changes.
 *
 * Format guidance text under each uploader documents what the storefront
 * actually wants (size cap, resolution, codec) so the operator can prep
 * assets before clicking through.
 */
export function HeroEditForm({ id, initial }: Props): React.ReactElement {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [kind, setKind] = React.useState<'IMAGE' | 'VIDEO'>(initial.kind);
  const [imageUrl, setImageUrl] = React.useState(initial.imageUrl);
  const [videoUrl, setVideoUrl] = React.useState(initial.videoUrl ?? '');
  const [eyebrow, setEyebrow] = React.useState(initial.eyebrow);
  const [ctaLabel, setCtaLabel] = React.useState(initial.ctaLabel);
  const [ctaHref, setCtaHref] = React.useState(initial.ctaHref);

  function onSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (kind === 'IMAGE' && !imageUrl) {
      setError('Upload an image or paste an image URL.');
      return;
    }
    if (kind === 'VIDEO' && !videoUrl) {
      setError('Upload a video or paste a video URL.');
      return;
    }
    startTransition(async () => {
      const res = await fetch(`/api/admin/content/hero/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          // Always send both — the toggle is a UI hint, not a destructive
          // operation. Empty string for the unused side is fine; the
          // storefront only reads the field matching `kind`.
          imageUrl,
          videoUrl: videoUrl || null,
          eyebrow,
          ctaLabel,
          ctaHref,
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

  function onDelete(): void {
    if (!confirm('Delete this hero block?')) return;
    startTransition(async () => {
      const res = await fetch(`/api/admin/content/hero/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        setError(`Delete failed (${res.status})`);
        return;
      }
      router.push('/admin/content/hero');
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
        <span className="text-xs text-neutral-500">
          Switching does not delete the other asset — re-toggle to keep
          using a previously uploaded image or video.
        </span>
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
            <strong>Recommended:</strong> JPEG or WebP, 1920×1080 (or
            larger, 16:9). Compress to ≤500KB for fast load — use
            <a
              href="https://squoosh.app"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              {' '}squoosh.app
            </a>{' '}
            or <span className="font-mono">cwebp -q 80</span>. Hard upload limit 5MB.
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
            <strong>Recommended:</strong> MP4 (H.264 codec) at 1920×1080,
            5–10 seconds, looping, <em>no audio</em>, 24–30 fps,
            bitrate 2–4 Mbps. Target file size ≤8MB for fast load on
            mobile. Hard upload limit 20MB. WebM and MOV also accepted.
            Use{' '}
            <a
              href="https://www.ffmpeg.org/"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              ffmpeg
            </a>{' '}
            or{' '}
            <a
              href="https://handbrake.fr/"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              HandBrake
            </a>{' '}
            to compress.
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
      {saved && <p className="text-sm text-green-700">Saved.</p>}
      <div className="flex gap-3 mt-2">
        <button
          type="submit"
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
    </form>
  );
}
