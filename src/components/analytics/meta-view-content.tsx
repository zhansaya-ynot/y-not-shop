'use client';

import * as React from 'react';
import { trackViewContent } from './meta-events';

/**
 * Fires a Meta `ViewContent` event once when a product page mounts. Rendered
 * from the PDP (a server component) so the event carries the product id/price.
 */
export function MetaViewContent({
  productId,
  valueCents,
}: {
  productId: string;
  valueCents: number;
}): null {
  const fired = React.useRef(false);
  React.useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    trackViewContent({ productId, valueCents });
  }, [productId, valueCents]);
  return null;
}
