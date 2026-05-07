import * as React from "react";
import { AnnouncementBar } from "@/components/announcement-bar";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { WhatsAppWidget } from "@/components/whatsapp-widget";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { PageHero } from "@/components/static/page-hero";
import { ContactForm } from "@/components/contact/contact-form";

export const metadata = {
  title: "Contact · YNOT London",
  description: "Get in touch with YNOT London.",
};

export default function ContactPage() {
  return (
    <>
      <AnnouncementBar />
      <SiteHeader />
      <main className="flex-1">
        <PageHero eyebrow="Get in touch" title="We'd love to hear from you." />

        <Section padding="lg">
          <Container size="narrow">
            <div className="grid gap-12 md:grid-cols-2">
              <div className="flex flex-col gap-3">
                <h2 className="text-[12px] font-semibold uppercase tracking-[0.2em] text-foreground-secondary">Customer care</h2>
                <a href="mailto:hello@ynotlondon.com" className="font-heading text-[24px] text-foreground-primary hover:text-foreground-secondary">
                  hello@ynotlondon.com
                </a>
                <p className="text-[14px] text-foreground-secondary">Response within 24 hours, Monday to Friday.</p>
              </div>
              <div className="flex flex-col gap-3">
                <h2 className="text-[12px] font-semibold uppercase tracking-[0.2em] text-foreground-secondary">Studio</h2>
                <p className="text-[14px] leading-relaxed text-foreground-primary">
                  YNOT London<br />
                  London, United Kingdom
                </p>
                <p className="text-[14px] text-foreground-secondary">By appointment only.</p>
              </div>
              <div className="flex flex-col gap-3">
                <h2 className="text-[12px] font-semibold uppercase tracking-[0.2em] text-foreground-secondary">WhatsApp</h2>
                <p className="text-[14px] text-foreground-primary">Tap the floating WhatsApp button at the bottom of any page for the fastest response.</p>
              </div>
              <div className="flex flex-col gap-3">
                <h2 className="text-[12px] font-semibold uppercase tracking-[0.2em] text-foreground-secondary">Press</h2>
                <a href="mailto:press@ynotlondon.com" className="font-heading text-[24px] text-foreground-primary hover:text-foreground-secondary">
                  press@ynotlondon.com
                </a>
              </div>
            </div>
          </Container>
        </Section>

        <Section padding="lg" background="cream">
          <Container size="narrow">
            <div className="text-center mb-10 text-foreground-on-cream">
              <h2 className="text-[12px] font-semibold uppercase tracking-[0.25em] mb-3">
                Send us a message
              </h2>
              <p className="text-[15px] text-foreground-on-cream/70 max-w-[420px] mx-auto">
                We read every message. Replies within 24 hours, Monday to Friday.
              </p>
            </div>
            <ContactForm />
          </Container>
        </Section>
      </main>
      <SiteFooter />
      <WhatsAppWidget phone="+44 7000 000000" message="Hi YNOT, I have a question." />
    </>
  );
}
