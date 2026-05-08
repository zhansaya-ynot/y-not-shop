import * as React from "react";
import { AnnouncementBar } from "@/components/announcement-bar";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { WhatsAppWidget } from "@/components/whatsapp-widget";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { PageHero } from "@/components/static/page-hero";
import { ContactForm } from "@/components/contact/contact-form";
import { prisma } from "@/server/db/client";
import { parseContactExtras, type ContactInfoBlock } from "@/lib/cms/page-extras";

export const dynamic = "force-dynamic";

// Bundled defaults if /admin hasn't seeded the contact row yet — the
// migration installs these on first deploy, so this only fires for
// fresh installs or test environments.
const FALLBACK_INFO_BLOCKS: ContactInfoBlock[] = [
  {
    title: 'Customer care',
    body: 'Response within 24 hours, Monday to Friday.',
    linkHref: 'mailto:hello@ynotlondon.com',
    linkLabel: 'hello@ynotlondon.com',
  },
  {
    title: 'Studio',
    body: 'YNOT London\nLondon, United Kingdom\n\nBy appointment only.',
    linkHref: '',
    linkLabel: '',
  },
  {
    title: 'WhatsApp',
    body: 'Tap the floating WhatsApp button at the bottom of any page for the fastest response.',
    linkHref: '',
    linkLabel: '',
  },
  {
    title: 'Press',
    body: '',
    linkHref: 'mailto:press@ynotlondon.com',
    linkLabel: 'press@ynotlondon.com',
  },
];

export async function generateMetadata() {
  const page = await prisma.staticPage.findUnique({ where: { slug: "contact" } });
  return {
    title: page?.metaTitle?.trim() || "Contact · YNOT London",
    description: page?.metaDescription?.trim() || "Get in touch with YNOT London.",
  };
}

export default async function ContactPage() {
  const page = await prisma.staticPage.findUnique({ where: { slug: "contact" } });
  const extras = parseContactExtras(page?.extras ?? null);
  const hero = extras?.hero ?? {
    eyebrow: 'Get in touch',
    title: "We'd love to hear from you.",
  };
  const infoBlocks =
    extras && extras.infoBlocks.length > 0 ? extras.infoBlocks : FALLBACK_INFO_BLOCKS;
  const formSection = extras?.formSection ?? {
    heading: 'Send us a message',
    body: 'We read every message. Replies within 24 hours, Monday to Friday.',
  };

  return (
    <>
      <AnnouncementBar />
      <SiteHeader />
      <main className="flex-1">
        <PageHero eyebrow={hero.eyebrow} title={hero.title} />

        <Section padding="lg">
          <Container size="narrow">
            <div className="grid gap-12 md:grid-cols-2">
              {infoBlocks.map((block, idx) => (
                <div key={idx} className="flex flex-col gap-3">
                  {block.title && (
                    <h2 className="text-[12px] font-semibold uppercase tracking-[0.2em] text-foreground-secondary">
                      {block.title}
                    </h2>
                  )}
                  {block.linkHref && block.linkLabel && (
                    <a
                      href={block.linkHref}
                      className="font-heading text-[24px] text-foreground-primary hover:text-foreground-secondary"
                    >
                      {block.linkLabel}
                    </a>
                  )}
                  {block.body && (
                    // Body supports newlines (e.g. multi-line address) —
                    // whitespace-pre-line keeps line breaks without HTML.
                    <p className="whitespace-pre-line text-[14px] leading-relaxed text-foreground-primary">
                      {block.body}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Container>
        </Section>

        {(formSection.heading || formSection.body) && (
          <Section padding="lg" background="cream">
            <Container size="narrow">
              <div className="text-center mb-10 text-foreground-on-cream">
                {formSection.heading && (
                  <h2 className="text-[12px] font-semibold uppercase tracking-[0.25em] mb-3">
                    {formSection.heading}
                  </h2>
                )}
                {formSection.body && (
                  <p className="text-[15px] text-foreground-on-cream/70 max-w-[420px] mx-auto">
                    {formSection.body}
                  </p>
                )}
              </div>
              <ContactForm />
            </Container>
          </Section>
        )}
      </main>
      <SiteFooter />
      <WhatsAppWidget phone="+44 7000 000000" message="Hi YNOT, I have a question." />
    </>
  );
}
