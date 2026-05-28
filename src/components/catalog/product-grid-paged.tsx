"use client";

import * as React from "react";
import { ProductGrid } from "@/components/catalog/product-grid";
import { Button } from "@/components/ui/button";
import type { Product } from "@/lib/schemas";

export interface ProductGridPagedProps {
  /** The full filtered/sorted product list — already server-rendered into
   *  the page payload, so "Load more" reveals from memory with no
   *  network request or navigation. */
  products: Product[];
  pageSize?: number;
}

/**
 * Catalogue grid that reveals products in client-side batches. Replaces
 * the old URL-based `?limit=` Load-more (which triggered a full server
 * navigation and felt like a page reload). The whole filtered list is
 * shipped once; the button just bumps a local counter.
 *
 * `shown` resets to `pageSize` whenever the products prop changes — i.e.
 * when the operator changes a filter/sort and the server re-renders the
 * page with a different set.
 */
export function ProductGridPaged({
  products,
  pageSize = 12,
}: ProductGridPagedProps) {
  const [shown, setShown] = React.useState(pageSize);

  React.useEffect(() => {
    setShown(pageSize);
  }, [products, pageSize]);

  const visible = products.slice(0, shown);
  const hasMore = shown < products.length;

  return (
    <>
      <ProductGrid products={visible} />
      {hasMore && (
        <div className="mt-10 flex justify-center">
          <Button variant="outline" onClick={() => setShown((s) => s + pageSize)}>
            Load more
          </Button>
        </div>
      )}
    </>
  );
}
