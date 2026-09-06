'use client';

import * as React from 'react';
import { SingleImageUpload } from '../../_components/single-image-upload';
import { SingleVideoUpload } from '../../_components/single-video-upload';

/**
 * The hero is art-directed: the storefront serves the landscape asset from
 * 768px up and the portrait one below that. Both the create and the edit
 * form render this identical pair of slots, so it lives here rather than
 * being duplicated in each.
 *
 * Mobile is optional everywhere — leaving it blank makes phones fall back
 * to the landscape asset, which is exactly how the hero behaved before
 * these fields existed.
 */

interface AssetSlotProps {
  /** Heading above the slot, e.g. "Desktop & tablet (16:9)". */
  title: string;
  /** Label of the URL input — also what tests and screen readers key off. */
  urlLabel: string;
  value: string;
  onChange: (v: string) => void;
  uploader: React.ReactNode;
  children: React.ReactNode;
}

function AssetSlot({
  title,
  urlLabel,
  value,
  onChange,
  uploader,
  children,
}: AssetSlotProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-1 text-sm border border-neutral-200 rounded p-3">
      <span className="text-xs uppercase tracking-wider text-neutral-600">{title}</span>
      {uploader}
      <label className="flex flex-col gap-1 mt-2">
        <span className="text-xs uppercase tracking-wider text-neutral-600">{urlLabel}</span>
        <input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="border border-neutral-300 rounded px-3 py-2 font-mono text-xs"
        />
      </label>
      <p className="text-xs text-neutral-500 leading-relaxed mt-1">{children}</p>
    </div>
  );
}

export interface HeroAssetFieldsProps {
  kind: 'IMAGE' | 'VIDEO';
  imageUrl: string;
  onImageUrlChange: (v: string) => void;
  mobileImageUrl: string;
  onMobileImageUrlChange: (v: string) => void;
  videoUrl: string;
  onVideoUrlChange: (v: string) => void;
  mobileVideoUrl: string;
  onMobileVideoUrlChange: (v: string) => void;
}

export function HeroAssetFields({
  kind,
  imageUrl,
  onImageUrlChange,
  mobileImageUrl,
  onMobileImageUrlChange,
  videoUrl,
  onVideoUrlChange,
  mobileVideoUrl,
  onMobileVideoUrlChange,
}: HeroAssetFieldsProps): React.ReactElement {
  if (kind === 'IMAGE') {
    return (
      <div className="flex flex-col gap-3">
        <AssetSlot
          title="Image — desktop & tablet (16:9)"
          urlLabel="Desktop image URL"
          value={imageUrl}
          onChange={onImageUrlChange}
          uploader={
            <SingleImageUpload prefix="hero" value={imageUrl} onChange={onImageUrlChange} />
          }
        >
          <strong>Recommended:</strong> JPEG or WebP, landscape 1920×1080
          (16:9). Shown on laptops and on iPads in both orientations.
          Compress to ≤500KB — use{' '}
          <a href="https://squoosh.app" target="_blank" rel="noreferrer" className="underline">
            squoosh.app
          </a>{' '}
          or <span className="font-mono">cwebp -q 80</span>. Hard upload limit 5MB.
        </AssetSlot>

        <AssetSlot
          title="Image — mobile (9:16)"
          urlLabel="Mobile image URL"
          value={mobileImageUrl}
          onChange={onMobileImageUrlChange}
          uploader={
            <SingleImageUpload
              prefix="hero"
              value={mobileImageUrl}
              onChange={onMobileImageUrlChange}
            />
          }
        >
          <strong>Optional.</strong> Portrait 1080×1920 (9:16) for phones.
          Leave empty to show the desktop image everywhere — but a landscape
          photo on a phone crops to a narrow strip, so a dedicated portrait
          shot is worth it.
        </AssetSlot>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <AssetSlot
        title="Video — desktop & tablet (16:9)"
        urlLabel="Desktop video URL"
        value={videoUrl}
        onChange={onVideoUrlChange}
        uploader={
          <SingleVideoUpload prefix="hero" value={videoUrl} onChange={onVideoUrlChange} />
        }
      >
        <strong>Recommended:</strong> MP4 (H.264) at 1920×1080, 5–10 seconds,
        looping, <em>no audio</em>, 24–30 fps, bitrate 2–4 Mbps. Target ≤8MB.
        Hard upload limit 20MB. WebM and MOV also accepted. Compress with{' '}
        <a href="https://www.ffmpeg.org/" target="_blank" rel="noreferrer" className="underline">
          ffmpeg
        </a>{' '}
        or{' '}
        <a href="https://handbrake.fr/" target="_blank" rel="noreferrer" className="underline">
          HandBrake
        </a>
        .
      </AssetSlot>

      <AssetSlot
        title="Video — mobile (9:16)"
        urlLabel="Mobile video URL"
        value={mobileVideoUrl}
        onChange={onMobileVideoUrlChange}
        uploader={
          <SingleVideoUpload
            prefix="hero"
            value={mobileVideoUrl}
            onChange={onMobileVideoUrlChange}
          />
        }
      >
        <strong>Optional.</strong> Portrait 1080×1920 (9:16) cut for phones.
        Keep it under 8MB — phones are usually on mobile data. Leave empty to
        play the desktop cut everywhere.
      </AssetSlot>
    </div>
  );
}
