import * as React from "react";
import { Accordion } from "@/components/ui/accordion";
import type { Product } from "@/lib/schemas";

export function ProductDetailsAccordion({ product }: { product: Product }) {
  return (
    <Accordion
      multiple
      items={[
        {
          value: "description",
          title: "Description",
          content: <p>{product.description}</p>,
        },
        {
          value: "materials",
          title: "Materials",
          content: <p>{product.details.materials}</p>,
        },
        {
          // Care is its own page (/product-care) — the row links there
          // instead of expanding inline. Per-product `details.care` copy
          // is no longer surfaced on the PDP.
          value: "care",
          title: "Care",
          href: "/product-care",
        },
        {
          value: "sizing",
          title: "Sizing",
          content: <p>{product.details.sizing}</p>,
        },
      ]}
    />
  );
}
