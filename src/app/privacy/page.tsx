import * as React from "react";
import { AnnouncementBar } from "@/components/announcement-bar";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { WhatsAppWidget } from "@/components/whatsapp-widget";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Prose } from "@/components/ui/prose";
import { PageHero } from "@/components/static/page-hero";

export const metadata = {
  title: "Privacy Policy · YNOT London",
  description: "How YNOT London handles your personal data.",
};

export default function PrivacyPage() {
  return (
    <>
      <AnnouncementBar />
      <SiteHeader />
      <main className="flex-1">
        <PageHero eyebrow="Legal" title="Privacy Policy" />
        <Section padding="lg">
          <Container size="narrow">
            <Prose>
              <h2>Information collection</h2>
              <p>We track visitor data during your browsing session, including:</p>
              <ul>
                <li>Products you&rsquo;ve viewed: we use this to show you products you&rsquo;ve recently viewed.</li>
                <li>Location, IP address and browser type: we use this for purposes like estimating taxes and shipping.</li>
                <li>Shipping address: we&rsquo;ll ask you to enter this so we can, for instance, estimate shipping.</li>
              </ul>
              <p>Cookies monitor shopping cart activity throughout your browsing session.</p>

              <h2>Purchase information</h2>
              <p>When you buy a product from us, YNOT London collects your name, address, email address, phone number and payment details. We use this data to:</p>
              <ul>
                <li>Send account and order communications</li>
                <li>Respond to your requests, including refunds and complaints</li>
                <li>Process payments and prevent fraudulent transactions</li>
                <li>Set up your account for our store</li>
                <li>Meet legal obligations</li>
                <li>Enhance our store offering</li>
                <li>Deliver marketing messages (optional)</li>
              </ul>

              <h2>Data retention</h2>
              <p>Account holders have stored name, address, email and phone information available for future orders. We generally store information about you for as long as we need the information for the purposes relevant to the business, including order records retained for tax purposes.</p>

              <h2>Team access &amp; third parties</h2>
              <p>Administrators and shop managers access customer and order information to fulfil orders and provide support. We share data with service providers including Stripe (payment platform), DHL, UPS and Royal Mail for shipping and return services.</p>
              <p>Payment processing occurs through Stripe, which receives the necessary transaction details.</p>

              <h2>Your rights</h2>
              <p>You can access, correct, or delete your personal data at any time. Contact us at hello@ynotlondon.com for any data requests.</p>

              <h2>Cookies</h2>
              <p>We use essential cookies to operate the site and analytics cookies to understand how visitors use it. You can manage your cookie preferences via the banner at the bottom of the page.</p>

              <p className="text-[12px] text-foreground-tertiary mt-12">Last updated: 8 May 2026.</p>
            </Prose>
          </Container>
        </Section>
      </main>
      <SiteFooter />
      <WhatsAppWidget phone="+44 7000 000000" message="Hi YNOT, I have a question." />
    </>
  );
}
