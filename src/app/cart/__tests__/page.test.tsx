import * as React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { useCartStore } from "@/lib/stores/cart-store";
import CartPage from "../page";

const baseSnapshot = {
  id: "cart-1",
  items: [
    {
      id: "item-1",
      productId: "prod_001",
      productSlug: "belted-suede-field-jacket",
      productName: "Belted Suede Field Jacket",
      productImage: "/sample/jacket-1.svg",
      colour: "Chocolate Brown",
      size: "M" as const,
      quantity: 1,
      unitPriceCents: 89500,
      currency: "GBP" as const,
      isPreorder: false,
      preorderBatchId: null,
      stockAvailable: 5,
    },
  ],
  subtotalCents: 89500,
  discountCents: 0,
  promo: null,
  itemCount: 1,
  expiresAt: new Date().toISOString(),
};

beforeEach(() => {
  useCartStore.setState({
    snapshot: baseSnapshot,
    isOpen: false,
    isLoading: false,
    // Stub hydrate — page.tsx fires it from useEffect; the real impl calls
    // /api/cart which is unreachable in jsdom.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    hydrate: vi.fn().mockResolvedValue(undefined) as any,
  });
});

describe("CartPage pre-order eyebrow", () => {
  it("renders the pre-order eyebrow with spec wording when isPreorder is true", () => {
    useCartStore.setState({
      snapshot: {
        ...baseSnapshot,
        items: [
          {
            ...baseSnapshot.items[0],
            isPreorder: true,
            preorderBatchId: null,
            stockAvailable: 0,
          },
        ],
      },
    });
    render(<CartPage />);
    expect(
      screen.getByText(/Pre-order — ships in 3 weeks/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/out of stock/i)).toBeNull();
    expect(screen.queryByText(/sold out/i)).toBeNull();
  });

  it("does not render the eyebrow on a normal item", () => {
    render(<CartPage />);
    expect(
      screen.queryByText(/Pre-order — ships in 3 weeks/i),
    ).toBeNull();
  });
});
