import * as React from "react";
import { Accordion } from "@/components/ui/accordion";
import { renderRichBodyHtml } from "@/lib/cms/render-content";
import type { Product } from "@/lib/schemas";

// Tailwind class fragment that lets HTML from the admin rich-text
// editor render with proper paragraph spacing, lists, bold, links and
// underline — without dragging in the @tailwindcss/typography plugin.
const RICH_CLASS =
  "[&>*]:m-0 [&>p+p]:mt-3 [&_a]:underline [&_strong]:font-semibold [&_em]:italic [&_u]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2 [&_li]:my-1";

/**
 * Render plain text or rich HTML for an accordion row. Materials and
 * sizing are now edited via TipTap → HTML; description is still plain
 * text. `renderRichBodyHtml` also catches legacy markdown paste so
 * existing rows that contain `**bold**` etc. still render correctly.
 */
function RichBody({ html }: { html: string }) {
  return (
    <div
      className={RICH_CLASS}
      dangerouslySetInnerHTML={{ __html: renderRichBodyHtml(html) }}
    />
  );
}

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
          content: <RichBody html={product.details.materials} />,
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
