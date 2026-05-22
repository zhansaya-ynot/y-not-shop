"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { ProductGallery } from "./product-gallery";
import { ProductInfoPanel } from "./product-info-panel";
import { AddToBagSection } from "./add-to-bag-section";
import { ProductDetailsAccordion } from "./product-details-accordion";
import { duration, ease } from "@/lib/motion";
import type { Product, ColourOption } from "@/lib/schemas";

function defaultColour(product: Product): ColourOption | null {
  if (product.colourOptions && product.colourOptions.length > 0) {
    return product.colourOptions[0];
  }
  if (product.colour) return { name: product.colour, hex: "#1A1A1A" };
  return null;
}

/**
 * Returns the gallery images for a given colour. If the product has no
 * per-image colour tags it returns the full list (legacy behaviour). When
 * a colour is selected, images tagged with that colour win; otherwise we
 * fall back to untagged images, then to everything — so the gallery is
 * never empty.
 */
function imagesForColour(product: Product, colourName: string | null): string[] {
  const variants = product.imageVariants;
  if (!variants || variants.length === 0) return product.images;

  if (colourName) {
    const matched = variants.filter((v) => v.colour === colourName).map((v) => v.url);
    if (matched.length > 0) return matched;
  }
  const untagged = variants.filter((v) => !v.colour).map((v) => v.url);
  if (untagged.length > 0) return untagged;
  return product.images;
}

/**
 * Client wrapper that ties the colour picker (inside AddToBagSection) to
 * the gallery: changing colour swaps the gallery to that colour's photos
 * with a crossfade. Owns the shared colour state so both columns stay in
 * sync.
 */
export function ProductDetailMedia({ product }: { product: Product }) {
  const [colour, setColour] = React.useState<ColourOption | null>(() =>
    defaultColour(product),
  );

  const galleryImages = React.useMemo(
    () => imagesForColour(product, colour?.name ?? null),
    [product, colour],
  );

  return (
    <div className="grid gap-10 md:grid-cols-2 md:gap-16">
      <div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={colour?.name ?? "__default"}
            initial={{ opacity: 0 }}
            animate={{
              opacity: 1,
              transition: { duration: duration.base, ease: ease.out },
            }}
            exit={{
              opacity: 0,
              transition: { duration: duration.fast, ease: ease.out },
            }}
          >
            <ProductGallery images={galleryImages} alt={product.name} />
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex flex-col gap-10">
        <ProductInfoPanel name={product.name} price={product.price} preOrder={product.preOrder}>
          <AddToBagSection
            product={product}
            colour={colour}
            onColourChange={setColour}
          />
        </ProductInfoPanel>
        <ProductDetailsAccordion product={product} />
      </div>
    </div>
  );
}
