'use client';

import * as React from 'react';

interface Props {
  prefix: string;
  value: string;
  onChange: (url: string) => void;
}

/**
 * Single-video upload widget for CMS forms. Mirrors SingleImageUpload but
 * accepts MP4/WebM/MOV and previews inline with a muted autoplay loop —
 * the same playback mode the storefront uses, so the operator sees what
 * the customer will see. Hits the same /api/admin/media/upload endpoint
 * with a 20MB per-file cap server-side.
 */
export function SingleVideoUpload({ prefix, value, onChange }: Props): React.ReactElement {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [progress, setProgress] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function handleFile(file: File): Promise<void> {
    setError(null);
    setUploading(true);
    setProgress(0);

    try {
      const url = await uploadWithProgress(file, prefix, (pct) => setProgress(pct));
      onChange(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
      setProgress(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {value ? (
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            src={value}
            autoPlay
            loop
            muted
            playsInline
            className="w-48 h-32 object-cover rounded border border-neutral-200 bg-black"
          />
          <div className="flex flex-col gap-2">
            <label className="inline-block cursor-pointer px-3 py-1.5 text-xs uppercase tracking-wider rounded border border-neutral-300 bg-white hover:bg-neutral-100">
              <span>
                {uploading
                  ? progress !== null
                    ? `Uploading ${progress}%`
                    : 'Uploading…'
                  : 'Replace'}
              </span>
              <input
                ref={inputRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFile(f);
                }}
              />
            </label>
            <button
              type="button"
              onClick={() => onChange('')}
              className="px-3 py-1.5 text-xs uppercase tracking-wider rounded border border-neutral-300 bg-white hover:bg-neutral-100 text-red-700"
            >
              Clear
            </button>
          </div>
        </div>
      ) : (
        <label className="inline-flex items-center justify-center cursor-pointer px-4 py-6 border-2 border-dashed border-neutral-300 rounded-lg text-sm text-neutral-600 bg-neutral-50 hover:bg-neutral-100">
          <span>
            {uploading
              ? progress !== null
                ? `Uploading ${progress}%`
                : 'Uploading…'
              : 'Drop a video or choose file'}
          </span>
          <input
            ref={inputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
        </label>
      )}
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}

/**
 * XMLHttpRequest-based upload so we can surface upload progress — `fetch`
 * doesn't expose progress events for the request body. Server response
 * shape matches the JSON returned by /api/admin/media/upload.
 */
function uploadWithProgress(
  file: File,
  prefix: string,
  onProgress: (pct: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append('files', file);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/admin/media/upload?prefix=${encodeURIComponent(prefix)}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`Upload failed (${xhr.status})`));
        return;
      }
      try {
        const data = JSON.parse(xhr.responseText) as {
          uploaded?: Array<{ url: string }>;
          rejected?: Array<{ reason: string }>;
        };
        if (data.rejected && data.rejected.length > 0) {
          reject(new Error(`Rejected: ${data.rejected[0].reason}`));
          return;
        }
        const url = data.uploaded?.[0]?.url;
        if (!url) {
          reject(new Error('Upload returned no URL'));
          return;
        }
        resolve(url);
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(fd);
  });
}
