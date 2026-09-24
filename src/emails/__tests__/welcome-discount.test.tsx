import { describe, expect, it } from "vitest";
import { render } from "@react-email/render";
import { WelcomeDiscount } from "../welcome-discount";

const props = {
  customerName: "Robyn",
  promoCode: "WELCOME10-A1B2C3",
  promoExpiresAt: "2026-10-24T09:00:00.000Z",
  discountPercent: 10,
  shopUrl: "https://ynotlondon.com/shop",
};

describe("WelcomeDiscount", () => {
  it("shows the code the customer has to type at checkout", async () => {
    const html = await render(<WelcomeDiscount {...props} />);
    expect(html).toContain("WELCOME10-A1B2C3");
  });

  it("states the discount and where to spend it", async () => {
    const html = await render(<WelcomeDiscount {...props} />);
    expect(html).toContain("10%");
    expect(html).toContain("https://ynotlondon.com/shop");
  });

  it("spells the expiry out as a date, not an ISO timestamp", async () => {
    const html = await render(<WelcomeDiscount {...props} />);
    expect(html).toContain("24 October 2026");
    expect(html).not.toContain("2026-10-24T09:00:00.000Z");
  });

  it("greets a customer whose name we never captured", async () => {
    const { customerName: _omitted, ...anonymous } = props;
    const html = await render(<WelcomeDiscount {...anonymous} />);
    expect(html).toContain("WELCOME10-A1B2C3");
    expect(html).not.toContain("undefined");
  });
});
