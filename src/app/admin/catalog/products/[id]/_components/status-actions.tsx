'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import type { ProductStatus } from '@prisma/client';

interface Props {
  productId: string;
  status: ProductStatus;
}

/**
 * Mirrors `ALLOWED_PRODUCT_TRANSITIONS` on the server: DRAFT ↔ PUBLISHED,
 * DRAFT/PUBLISHED → ARCHIVED, and ARCHIVED → DRAFT to un-archive (a
 * product that was archived by mistake has to be brought back to DRAFT
 * first, then explicitly published — the two-step gate is intentional
 * so accidental "undo" doesn't republish a half-finished listing).
 */
const LEGAL: Record<ProductStatus, ProductStatus[]> = {
  DRAFT: ['PUBLISHED', 'ARCHIVED'],
  PUBLISHED: ['DRAFT', 'ARCHIVED'],
  ARCHIVED: ['DRAFT'],
};

const LABEL: Record<ProductStatus, { unpublish: string; archive: string }> = {
  DRAFT: { unpublish: 'Unpublish', archive: 'Archive' },
  PUBLISHED: { unpublish: 'Unpublish', archive: 'Archive' },
  // From ARCHIVED the only legal target is DRAFT, so the middle button
  // turns into "Restore" to make the recovery path obvious.
  ARCHIVED: { unpublish: 'Restore', archive: 'Archive' },
};

export function StatusActions({ productId, status }: Props): React.ReactElement {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function transition(to: ProductStatus, opts: { confirmMsg?: string } = {}): void {
    if (opts.confirmMsg && !confirm(opts.confirmMsg)) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/products/${productId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to }),
      });
      if (!res.ok) {
        setError(`Status change failed (${res.status})`);
        return;
      }
      router.refresh();
    });
  }

  const legal = LEGAL[status];
  const labels = LABEL[status];
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2 items-center">
        <button
          type="button"
          disabled={pending || !legal.includes('PUBLISHED')}
          onClick={() => transition('PUBLISHED')}
          className="px-3 py-1.5 text-xs uppercase tracking-wider rounded bg-green-700 text-white disabled:opacity-30"
        >
          Publish
        </button>
        <button
          type="button"
          disabled={pending || !legal.includes('DRAFT')}
          onClick={() => transition('DRAFT')}
          className="px-3 py-1.5 text-xs uppercase tracking-wider rounded bg-yellow-600 text-white disabled:opacity-30"
        >
          {labels.unpublish}
        </button>
        {/* Spacer + visual divider so the destructive Archive action
            can't be mis-tapped while reaching for Publish/Unpublish. */}
        <span className="mx-2 h-6 w-px bg-neutral-300" aria-hidden />
        <button
          type="button"
          disabled={pending || !legal.includes('ARCHIVED')}
          onClick={() =>
            transition('ARCHIVED', {
              confirmMsg:
                'Archive this product? It will be hidden from the storefront. You can restore it later.',
            })
          }
          className="px-3 py-1.5 text-xs uppercase tracking-wider rounded border border-red-300 text-red-700 bg-white hover:bg-red-50 disabled:opacity-30"
        >
          {labels.archive}
        </button>
      </div>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </div>
  );
}
