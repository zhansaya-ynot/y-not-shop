"use client";

import * as React from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { SizeSelector } from "@/components/ui/size-selector";
import { ColourSwatch } from "@/components/ui/colour-swatch";
import { Modal } from "@/components/ui/modal";
import { useCartStore } from "@/lib/stores/cart-store";
import { trackAddToCart } from "@/components/analytics/meta-events";
import type { Product, Size, ColourOption } from "@/lib/schemas";

export interface AddToBagSectionProps {
  product: Product;
  /** When provided, colour selection is controlled by the parent (so the
   *  PDP gallery can react to it). Omit for standalone/internal state. */
  colour?: ColourOption | null;
  onColourChange?: (colour: ColourOption) => void;
}

const ONE_SIZE_TOKEN: Size = "M"; // representative size used internally for one-size products

function defaultColour(product: Product): ColourOption | null {
  if (product.colourOptions && product.colourOptions.length > 0) {
    return product.colourOptions[0];
  }
  if (product.colour) {
    return { name: product.colour, hex: "#1A1A1A" };
  }
  return null;
}

export function AddToBagSection({
  product,
  colour: controlledColour,
  onColourChange,
}: AddToBagSectionProps) {
  // For one-size products we skip the picker and pre-select the
  // ONE_SIZE_TOKEN so the existing Add-to-bag flow keeps working without
  // a special-case branch in the cart API.
  const [size, setSize] = React.useState<Size | null>(
    product.isOneSize ? ONE_SIZE_TOKEN : null,
  );
  // Colour is controlled when the parent passes onColourChange (PDP gallery
  // sync); otherwise we keep it in local state.
  const isControlled = onColourChange !== undefined;
  const [internalColour, setInternalColour] = React.useState<ColourOption | null>(
    () => defaultColour(product),
  );
  const colour = isControlled ? (controlledColour ?? null) : internalColour;
  const setColour = (c: ColourOption) => {
    if (isControlled) onColourChange(c);
    else setInternalColour(c);
  };
  const [sizeGuideOpen, setSizeGuideOpen] = React.useState(false);
  const addItem = useCartStore((s) => s.addItem);
  const openDrawer = useCartStore((s) => s.openDrawer);

  // Stock follows the selected colour. Products without colours store their
  // stock under the "" key; fall back to the aggregate map for older fixtures
  // that don't carry stockByColour.
  const colourKey = colour?.name ?? '';
  const stockForColour = product.stockByColour?.[colourKey] ?? product.stock;
  const selectedStock = size ? (stockForColour[size] ?? 0) : 0;
  const isPreOrderForSelection =
    product.preOrder || (size !== null && selectedStock === 0);

  const onAdd = async () => {
    if (!size) return;
    await addItem({
      productId: product.id,
      size,
      colour: colour?.name ?? '',
      quantity: 1,
      isPreorder: isPreOrderForSelection,
    });
    trackAddToCart({ productId: product.id, valueCents: product.price, quantity: 1 });
    openDrawer();
  };

  const showColourPicker =
    product.colourOptions && product.colourOptions.length > 1;

  return (
    <div className="flex flex-col gap-6">
      {(colour || product.colour) && (
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-foreground-secondary mb-2">
            Colour
          </p>
          {colour && (
            <p className="text-[14px] text-foreground-primary mb-3">{colour.name}</p>
          )}
          {showColourPicker && product.colourOptions && (
            <div className="flex flex-wrap gap-2">
              {product.colourOptions.map((c) => (
                <ColourSwatch
                  key={c.name}
                  name={c.name}
                  hex={c.hex}
                  selected={colour?.name === c.name}
                  onClick={() => setColour(c)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {!product.isOneSize && (
        <div>
          <div className="flex items-baseline justify-between mb-3">
            <p className="text-[11px] uppercase tracking-[0.2em] text-foreground-secondary">
              Size
            </p>
            {product.sizeGuideImage && (
              <button
                type="button"
                onClick={() => setSizeGuideOpen(true)}
                className="text-[11px] uppercase tracking-[0.2em] text-foreground-secondary underline underline-offset-4 hover:text-foreground-primary"
              >
                Size guide
              </button>
            )}
          </div>
          <SizeSelector
            sizes={product.sizes}
            value={size}
            onChange={(s) => setSize(s)}
            stock={stockForColour}
            allowSoldOut
          />
        </div>
      )}
      {product.isOneSize && (
        <div className="flex items-baseline justify-between">
          <p className="text-[12px] uppercase tracking-[0.2em] text-foreground-secondary">
            One size
          </p>
          {/* One-size products still get a "Size guide" link when an
              image is uploaded — the guide is useful for measurements
              (chest/length) even when there's no size picker. */}
          {product.sizeGuideImage && (
            <button
              type="button"
              onClick={() => setSizeGuideOpen(true)}
              className="text-[11px] uppercase tracking-[0.2em] text-foreground-secondary underline underline-offset-4 hover:text-foreground-primary"
            >
              Size guide
            </button>
          )}
        </div>
      )}

      <Button
        size="lg"
        fullWidth
        variant={isPreOrderForSelection ? "preorder" : "primary"}
        onClick={onAdd}
        disabled={!size}
      >
        {isPreOrderForSelection ? "Pre-order (3 weeks)" : "Add to bag"}
      </Button>

      {product.sizeGuideImage && (
        <Modal
          open={sizeGuideOpen}
          onClose={() => setSizeGuideOpen(false)}
          title="Size guide"
          width="min(800px, 92vw)"
        >
          <div className="relative w-full" style={{ aspectRatio: "4 / 3" }}>
            <Image
              src={product.sizeGuideImage}
              alt={`${product.name} size guide`}
              fill
              sizes="(min-width: 1024px) 800px, 90vw"
              className="object-contain"
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
