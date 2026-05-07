import * as React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  OrderDetailWithShipments,
  type OrderForCustomer,
} from "../order-detail-with-shipments";

function buildOrder(overrides: Partial<OrderForCustomer> = {}): OrderForCustomer {
  return {
    id: "ord_1",
    orderNumber: "YN-2026-00042",
    status: "SHIPPED",
    totalCents: 20000,
    carrier: "ROYAL_MAIL",
    createdAt: new Date("2026-04-25T10:30:00Z"),
    shipFirstName: "Ada",
    shipLastName: "Lovelace",
    shipLine1: "1 Maths Way",
    shipLine2: null,
    shipCity: "London",
    shipPostcode: "SW7 5QG",
    shipCountry: "GB",
    items: [
      {
        id: "oi_1",
        productImage: "/jacket.jpg",
        productName: "Leather Jacket",
        colour: "Black",
        size: "M",
        quantity: 1,
        unitPriceCents: 20000,
        isPreorder: false,
      },
    ],
    shipments: [
      {
        id: "shp_1",
        carrier: "ROYAL_MAIL",
        trackingNumber: "AB123456789GB",
        shippedAt: new Date("2026-04-30T12:00:00Z"),
        deliveredAt: null,
      },
    ],
    events: [
      {
        id: "ev_1",
        status: "NEW",
        note: null,
        createdAt: new Date("2026-04-25T10:30:00Z"),
      },
      {
        id: "ev_2",
        status: "PROCESSING",
        note: "label generated",
        createdAt: new Date("2026-04-29T09:00:00Z"),
      },
      {
        id: "ev_3",
        status: "SHIPPED",
        note: null,
        createdAt: new Date("2026-04-30T12:00:00Z"),
      },
    ],
    returns: [],
    ...overrides,
  };
}

describe("OrderDetailWithShipments", () => {
  it("renders order number, status, total and items", () => {
    render(<OrderDetailWithShipments order={buildOrder()} />);
    expect(screen.getByText(/YN-2026-00042/)).toBeInTheDocument();
    expect(screen.getByTestId("order-status")).toHaveTextContent(/shipped/i);
    expect(screen.getByText(/Leather Jacket/)).toBeInTheDocument();
    expect(screen.getAllByText(/£200(\.|$)/).length).toBeGreaterThan(0);
  });

  it("renders the status timeline in the order events were given", () => {
    render(<OrderDetailWithShipments order={buildOrder()} />);
    const timelineHeading = screen.getByText(/status timeline/i);
    const timeline = timelineHeading.parentElement!;
    const items = timeline.querySelectorAll("li");
    expect(items.length).toBe(3);
    expect(items[0]).toHaveTextContent(/New/);
    expect(items[1]).toHaveTextContent(/Processing/);
    expect(items[2]).toHaveTextContent(/Shipped/);
  });

  it("renders Royal Mail tracking link with the spec URL", () => {
    render(<OrderDetailWithShipments order={buildOrder()} />);
    const link = screen.getByRole("link", { name: /track shipment/i });
    expect(link).toHaveAttribute(
      "href",
      "https://www.royalmail.com/track/AB123456789GB",
    );
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("renders DHL tracking link with the spec URL when carrier is DHL", () => {
    const base = buildOrder();
    const order = buildOrder({
      shipments: [
        {
          ...base.shipments[0],
          carrier: "DHL",
          trackingNumber: "1234567890",
        },
      ],
    });
    render(<OrderDetailWithShipments order={order} />);
    const link = screen.getByRole("link", { name: /track shipment/i });
    expect(link).toHaveAttribute(
      "href",
      "https://www.dhl.com/global-en/home/tracking/tracking-express.html?submit=1&tracking-id=1234567890",
    );
  });

  it("shows preorder eyebrow on preorder items", () => {
    const order = buildOrder();
    order.items[0].isPreorder = true;
    render(<OrderDetailWithShipments order={order} />);
    expect(
      screen.getByText(/Pre-order — ships in 4-6 weeks/i),
    ).toBeInTheDocument();
  });

  it("shows empty-state for orders with no shipments", () => {
    const order = buildOrder({ shipments: [] });
    render(<OrderDetailWithShipments order={order} />);
    expect(
      screen.getByText(/No shipments yet — your order is being prepared/i),
    ).toBeInTheDocument();
  });
});
