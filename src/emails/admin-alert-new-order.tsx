import { Heading, Hr, Section, Text } from "@react-email/components";
import { EmailLayout } from "./_layout";

export interface AdminAlertNewOrderProps {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  totalCents: number;
  shippingCents: number;
  discountCents: number;
  subtotalCents: number;
  currency: "GBP";
  items: Array<{
    name: string;
    size: string;
    qty: number;
    priceCents: number;
    isPreorder: boolean;
  }>;
  shippingAddress: {
    line1: string;
    line2?: string;
    city: string;
    postcode: string;
    country: string;
  };
  adminUrl: string;
}

const fmt = (cents: number) => `£${(cents / 100).toFixed(2)}`;

export function AdminAlertNewOrder(p: AdminAlertNewOrderProps) {
  return (
    <EmailLayout previewText={`New order ${p.orderNumber} — ${fmt(p.totalCents)}`}>
      <Heading
        as="h2"
        style={{ fontFamily: "Playfair Display, Georgia, serif", fontSize: 22, margin: 0 }}
      >
        New Order: {p.orderNumber}
      </Heading>
      <Text style={{ margin: "8px 0 24px", color: "#666" }}>
        You&apos;ve received a new order from {p.customerName}.
      </Text>

      <table
        cellPadding={8}
        cellSpacing={0}
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 14,
          border: "1px solid #e5e5e5",
        }}
      >
        <thead>
          <tr style={{ background: "#f7f7f7", textAlign: "left" }}>
            <th style={{ borderBottom: "1px solid #e5e5e5" }}>Product</th>
            <th style={{ borderBottom: "1px solid #e5e5e5", textAlign: "center" }}>Quantity</th>
            <th style={{ borderBottom: "1px solid #e5e5e5", textAlign: "right" }}>Price</th>
          </tr>
        </thead>
        <tbody>
          {p.items.map((it, i) => (
            <tr key={i}>
              <td style={{ borderBottom: "1px solid #f0f0f0" }}>
                {it.name} — Size {it.size}
                {it.isPreorder && (
                  <span style={{ color: "#a06f00", fontSize: 12 }}> (Pre-order)</span>
                )}
              </td>
              <td style={{ borderBottom: "1px solid #f0f0f0", textAlign: "center" }}>
                {it.qty}
              </td>
              <td style={{ borderBottom: "1px solid #f0f0f0", textAlign: "right" }}>
                {fmt(it.priceCents * it.qty)}
              </td>
            </tr>
          ))}
          <tr>
            <td colSpan={2} style={{ textAlign: "right", color: "#666" }}>
              Subtotal:
            </td>
            <td style={{ textAlign: "right" }}>{fmt(p.subtotalCents)}</td>
          </tr>
          <tr>
            <td colSpan={2} style={{ textAlign: "right", color: "#666" }}>
              Shipping:
            </td>
            <td style={{ textAlign: "right" }}>
              {p.shippingCents === 0 ? "Free shipping" : fmt(p.shippingCents)}
            </td>
          </tr>
          {p.discountCents > 0 && (
            <tr>
              <td colSpan={2} style={{ textAlign: "right", color: "#666" }}>
                Discount:
              </td>
              <td style={{ textAlign: "right" }}>−{fmt(p.discountCents)}</td>
            </tr>
          )}
          <tr style={{ background: "#fafafa" }}>
            <td colSpan={2} style={{ textAlign: "right", fontWeight: 600 }}>
              Total:
            </td>
            <td style={{ textAlign: "right", fontWeight: 600 }}>{fmt(p.totalCents)}</td>
          </tr>
        </tbody>
      </table>

      <Hr style={{ borderColor: "#e5e5e5", margin: "24px 0" }} />

      <Section>
        <Text
          style={{
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "#666",
            margin: "0 0 8px",
          }}
        >
          Shipping address
        </Text>
        <Text style={{ margin: 0 }}>
          {p.customerName}
          <br />
          {p.shippingAddress.line1}
          {p.shippingAddress.line2 ? (
            <>
              <br />
              {p.shippingAddress.line2}
            </>
          ) : null}
          <br />
          {p.shippingAddress.city} {p.shippingAddress.postcode}
          <br />
          {p.shippingAddress.country}
        </Text>
      </Section>

      <Section style={{ marginTop: 24 }}>
        <Text
          style={{
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "#666",
            margin: "0 0 8px",
          }}
        >
          Customer
        </Text>
        <Text style={{ margin: 0 }}>
          {p.customerEmail}
          {p.customerPhone ? (
            <>
              <br />
              {p.customerPhone}
            </>
          ) : null}
        </Text>
      </Section>

      <Hr style={{ borderColor: "#e5e5e5", margin: "24px 0" }} />

      <Section>
        <Text style={{ margin: 0 }}>
          <a href={p.adminUrl} style={{ color: "#000", fontWeight: 600 }}>
            Open order in admin →
          </a>
        </Text>
      </Section>
    </EmailLayout>
  );
}
