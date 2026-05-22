'use client';

import * as React from 'react';
import { Reorder } from 'motion/react';
import { useRouter } from 'next/navigation';

interface Image {
  id: string;
  url: string;
  alt: string | null;
  sortOrder: number;
  colour: string | null;
}

interface Props {
  productId: string;
  images: Image[];
  /** Colour names defined on the product; enables the per-image colour
   *  dropdown. Empty = product has no colours, dropdown hidden. */
  colours: string[];
}

/**
 * Drag-to-reorder grid using `Reorder.Group`. Local state tracks the live
 * order during the drag; `onReorder` fires the PATCH after the user releases
 * the item and only if the order actually changed (compare ids).
 */
export function ImageGridReorder(props: Props): React.ReactElement {
  // Re-mount the inner stateful component when the parent's `images` array
  // identity changes (server snapshot updated via `router.refresh()`); this
  // lets us hold optimistic local order in `useState` without an effect to
  // re-sync.
  const key = props.images.map((i) => `${i.id}:${i.colour ?? ''}`).join('|');
  return <ImageGridReorderInner key={key} {...props} />;
}

function ImageGridReorderInner({
  productId,
  images,
  colours,
}: Props): React.ReactElement {
  const router = useRouter();
  const [items, setItems] = React.useState(images);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function commitOrder(next: Image[]): void {
    const same =
      next.length === items.length && next.every((it, i) => it.id === items[i].id);
    if (same) return;
    setItems(next);
    const sameAsServer =
      next.length === images.length && next.every((it, i) => it.id === images[i].id);
    if (sameAsServer) return;
    startTransition(async () => {
      setError(null);
      const res = await fetch(`/api/admin/products/${productId}/images`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: next.map((it) => it.id) }),
      });
      if (!res.ok) {
        setError(`Reorder failed (${res.status})`);
        return;
      }
      router.refresh();
    });
  }

  function remove(imgId: string): void {
    startTransition(async () => {
      const res = await fetch(`/api/admin/products/${productId}/images/${imgId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        setError(`Delete failed (${res.status})`);
        return;
      }
      router.refresh();
    });
  }

  function setColour(imgId: string, colour: string): void {
    startTransition(async () => {
      const res = await fetch(`/api/admin/products/${productId}/images/colour`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId: imgId, colour: colour || null }),
      });
      if (!res.ok) {
        setError(`Colour update failed (${res.status})`);
        return;
      }
      router.refresh();
    });
  }

  if (items.length === 0) {
    return <p className="text-sm text-neutral-500 mt-4">No images yet.</p>;
  }

  return (
    <div>
      <Reorder.Group
        axis="x"
        values={items}
        onReorder={commitOrder}
        className="flex flex-wrap gap-3 mt-4 list-none p-0"
      >
        {items.map((img) => (
          <Reorder.Item
            key={img.id}
            value={img}
            className="w-32 flex flex-col gap-1 cursor-grab active:cursor-grabbing"
            data-testid={`image-${img.id}`}
          >
            <div className="relative w-32 h-32 bg-neutral-100 rounded overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={img.alt ?? ''}
                className="w-full h-full object-cover pointer-events-none"
                draggable={false}
              />
              <button
                type="button"
                onClick={() => remove(img.id)}
                disabled={pending}
                className="absolute top-1 right-1 px-2 py-0.5 text-xs bg-white/90 text-red-700 rounded shadow"
              >
                ×
              </button>
            </div>
            {colours.length > 0 && (
              <select
                value={img.colour ?? ''}
                disabled={pending}
                // Stop the pointerdown from starting a drag when the
                // operator opens the dropdown.
                onPointerDown={(e) => e.stopPropagation()}
                onChange={(e) => setColour(img.id, e.target.value)}
                className="w-32 border border-neutral-300 rounded px-1 py-1 text-xs bg-white"
                title="Which colour this image belongs to"
              >
                <option value="">All colours</option>
                {colours.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}
          </Reorder.Item>
        ))}
      </Reorder.Group>
      {error && <p className="text-xs text-red-700 mt-2">{error}</p>}
    </div>
  );
}
