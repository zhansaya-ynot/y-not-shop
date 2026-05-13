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

// Gmail + Outlook web strip `data:` URLs from <img> tags as a security
// measure — only http(s) URLs survive their HTML sanitiser. So the
// logo has to live at a real public URL the client can fetch (Gmail
// proxies it through googleusercontent.com).
//
// We read APP_URL *first* because Next inlines NEXT_PUBLIC_* into the
// build artefact — any email rendered from a Next-served route
// (Stripe webhook, API handler) keeps pointing at whatever URL was
// active when the docker image was built, even after secrets.env on
// the VPS changes. APP_URL is a plain server var Next leaves alone,
// so it tracks runtime config. Worker processes (BullMQ jobs) read
// either var fresh, so they're fine; the fallback chain just keeps
// both code paths in sync.
function resolveSiteUrl(): string {
  const raw =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://staging.ynotlondon.com";
  return raw.replace(/\/$/, "");
}
const SITE_URL = resolveSiteUrl();
const LOGO_URL = `${SITE_URL}/brand/ynot-logo-black.png`;

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
              src={LOGO_URL}
              alt="YNOT London"
              width={140}
              height={36}
              style={{ display: "inline-block", height: "auto", maxWidth: "140px" }}
            />
          </Section>
          {children}
          <Hr style={{ borderColor: BRAND.border, margin: "48px 0 24px" }} />
          <Section>
            <Text style={{ color: BRAND.muted, fontSize: 12, lineHeight: 1.5, margin: 0 }}>
              YNOT London &middot; 13 Elvaston Place, Flat 1, London SW7 5QG &middot;{" "}
              <a href={SITE_URL} style={{ color: BRAND.muted }}>
                {SITE_URL.replace(/^https?:\/\//, "")}
              </a>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
