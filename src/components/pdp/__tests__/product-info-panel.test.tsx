import * as React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProductInfoPanel } from "../product-info-panel";

describe("ProductInfoPanel pre-order eyebrow", () => {
  it("renders the pre-order eyebrow when preOrder is true", () => {
    render(
      <ProductInfoPanel name="Suede Field Jacket" price={89500} preOrder>
        <span>cta</span>
      </ProductInfoPanel>,
    );
    expect(
      screen.getByText(/Pre-order — ships in 3 weeks/i),
    ).toBeInTheDocument();
  });

  it("does not render the eyebrow when preOrder is false", () => {
    render(
      <ProductInfoPanel name="Suede Field Jacket" price={89500} preOrder={false}>
        <span>cta</span>
      </ProductInfoPanel>,
    );
    expect(
      screen.queryByText(/Pre-order — ships in 3 weeks/i),
    ).toBeNull();
  });

  it("does not render the eyebrow when preOrder is omitted", () => {
    render(
      <ProductInfoPanel name="Suede Field Jacket" price={89500}>
        <span>cta</span>
      </ProductInfoPanel>,
    );
    expect(
      screen.queryByText(/Pre-order — ships in 3 weeks/i),
    ).toBeNull();
  });
});
