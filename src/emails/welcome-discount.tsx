import { Button, Heading, Section, Text } from "@react-email/components";
import { EmailLayout } from "./_layout";

export interface WelcomeDiscountProps {
  customerName?: string;
  /** The customer's own single-use code. */
  promoCode: string;
  /** ISO 8601 — rendered as a plain date for the reader. */
  promoExpiresAt: string;
  discountPercent: number;
  shopUrl: string;
}

/** "24 October 2026" — a deadline a shopper can act on, unlike an ISO string. */
function formatExpiry(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}

export function WelcomeDiscount(p: WelcomeDiscountProps) {
  const greeting = p.customerName
    ? `Hi ${p.customerName},`
    : "Welcome to YNOT London.";

  return (
    <EmailLayout previewText={`Your ${p.discountPercent}% off is here`}>
      <Heading
        as="h2"
        style={{ fontFamily: "Playfair Display, Georgia, serif", fontSize: 22 }}
      >
        {`Welcome — here's ${p.discountPercent}% off.`}
      </Heading>
      <Text>{greeting}</Text>
      <Text>
        {`Thank you for creating an account. Here's ${p.discountPercent}% off your first order — enter the code at checkout.`}
      </Text>

      <Section
        style={{
          marginTop: 24,
          padding: 16,
          border: "1px solid #111",
          textAlign: "center",
        }}
      >
        <Text style={{ margin: "0 0 4px", fontSize: 12, color: "#666", letterSpacing: "0.1em" }}>
          USE CODE
        </Text>
        <Text
          style={{
            margin: 0,
            fontFamily: "Playfair Display, Georgia, serif",
            fontSize: 24,
            letterSpacing: "0.1em",
          }}
        >
          {p.promoCode}
        </Text>
        <Text style={{ margin: "8px 0 0", fontSize: 12, color: "#666" }}>
          {`${p.discountPercent}% off your first order — expires ${formatExpiry(p.promoExpiresAt)}`}
        </Text>
      </Section>

      <Section style={{ marginTop: 24 }}>
        <Button
          href={p.shopUrl}
          style={{
            background: "#111",
            color: "#fff",
            padding: "12px 24px",
            textDecoration: "none",
            display: "inline-block",
          }}
        >
          Start shopping
        </Button>
      </Section>

      <Section style={{ marginTop: 24 }}>
        <Text style={{ margin: 0, fontSize: 13, color: "#666" }}>
          The code is yours alone and can be used once.
        </Text>
      </Section>
    </EmailLayout>
  );
}
