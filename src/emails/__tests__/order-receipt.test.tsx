import { describe, expect, it } from "vitest";
import { render } from "@react-email/render";
import { OrderReceipt } from "../order-receipt";

describe("OrderReceipt", () => {
  it("renders with order data", async () => {
    const html = await render(
      <OrderReceipt
        orderNumber="YN-2026-00042"
        customerName="Anna"
        totalCents={45000}
        currency="GBP"
        itemsInStock={[{ name: "Coat", size: "M", qty: 1, priceCents: 45000 }]}
        itemsPreorder={[]}
        shippingAddress={{
          line1: "1 Green St",
          city: "London",
          postcode: "SW1",
          country: "GB",
        }}
        estimatedShipFrom="2026-05-06"
      />,
    );
    expect(html).toMatchSnapshot();
    expect(html).toContain("YN-2026-00042");
    expect(html).toContain("Coat");
  });

  it("shows preorder section when items have isPreorder", async () => {
    const html = await render(
      <OrderReceipt
        orderNumber="YN-2026-00043"
        customerName="Anna"
        totalCents={70000}
        currency="GBP"
        itemsInStock={[]}
        itemsPreorder={[
          { name: "Spring Trench", size: "L", qty: 1, priceCents: 70000, batchEtaWeeks: 3 },
        ]}
        shippingAddress={{
          line1: "1 Green St",
          city: "London",
          postcode: "SW1",
          country: "GB",
        }}
      />,
    );
    expect(html).toContain("Pre-order");
    expect(html).toContain("3 weeks");
  });
});
