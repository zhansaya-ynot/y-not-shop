import * as React from "react";
import { AnnouncementBar } from "@/components/announcement-bar";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { WhatsAppWidget } from "@/components/whatsapp-widget";

export const metadata = {
  title: "Checkout · YNOT London",
};

/**
 * Checkout uses the same header chrome as the rest of the site (logo,
 * search, account, bag) — the previous bespoke CheckoutHeader with its
 * "Secure checkout / 256-BIT SSL" trust strip felt like a cheap shop and
 * looked out of place next to the editorial homepage. The progress
 * indicator (Shipping → Payment → Confirmation) lives inside each
 * individual page, not the layout.
 */
export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AnnouncementBar />
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
      <WhatsAppWidget />
    </>
  );
}
