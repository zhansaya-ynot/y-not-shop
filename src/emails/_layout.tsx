import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";

// Email clients fetch images by absolute URL — relative paths don't resolve.
// Read from the same env that powers the rest of the site so a staging
// render points at staging.ynotlondon.com and prod at ynotlondon.com.
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://ynotlondon.com";

export interface EmailLayoutProps {
  previewText: string;
  children: ReactNode;
}

const BRAND = {
  primary: "#111111",
  muted: "#666666",
  border: "#e5e5e5",
  bg: "#ffffff",
  fontHeading: "Playfair Display, Georgia, serif",
  fontBody: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
};

export function EmailLayout({ previewText, children }: EmailLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body
        style={{
          backgroundColor: BRAND.bg,
          fontFamily: BRAND.fontBody,
          color: BRAND.primary,
          margin: 0,
          padding: 0,
        }}
      >
        <Container style={{ maxWidth: 560, margin: "0 auto", padding: "32px 24px" }}>
          <Section style={{ paddingBottom: 32, textAlign: "center" as const }}>
            <Img
              src={`${SITE_URL}/brand/ynot-logo-black.png`}
              alt="YNOT London"
              width={140}
              height={80}
              style={{ display: "inline-block", height: "auto", maxWidth: "140px" }}
            />
          </Section>
          {children}
          <Hr style={{ borderColor: BRAND.border, margin: "48px 0 24px" }} />
          <Section>
            <Text style={{ color: BRAND.muted, fontSize: 12, lineHeight: 1.5, margin: 0 }}>
              YNOT London &middot; 13 Elvaston Place, Flat 1, London SW7 5QG &middot;{" "}
              <a href="https://ynotlondon.com" style={{ color: BRAND.muted }}>
                ynotlondon.com
              </a>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
