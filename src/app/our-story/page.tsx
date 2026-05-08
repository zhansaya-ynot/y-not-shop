import * as React from "react";
import { AnnouncementBar } from "@/components/announcement-bar";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { WhatsAppWidget } from "@/components/whatsapp-widget";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Display } from "@/components/ui/typography";
import { PageHero } from "@/components/static/page-hero";
import { ValueCallouts } from "@/components/static/value-callouts";
import { PullQuote } from "@/components/static/pull-quote";
import { prisma } from "@/server/db/client";
import { parseOurStoryExtras } from "@/lib/cms/page-extras";
import { renderRichBodyHtml } from "@/lib/cms/render-content";

export const dynamic = "force-dynamic";

// Last-resort defaults if the DB row is missing — keeps the page from
// rendering blank on a fresh install before the seed migration runs.
// Operators edit the live copy via /admin/content/pages → Our Story.
const FALLBACK_HERO = "/cms/our-story/hero.jpg";
const FALLBACK_BODY_HTML = `
<p>Previously known as Ynot Fashion — an online multi-brand clothing store — we&rsquo;ve rebranded as YNOT LONDON, marking an exciting new chapter in our journey.</p>
<p>Throughout the year, our team developed a luxury outerwear collection that blends style, functionality and sustainability with timeless designs and contemporary innovations.</p>
`;
const FALLBACK_VALUE_CALLOUTS = {
  heading: "What we stand for",
  items: [
    { title: "Timeless design", body: "Pieces designed to transcend seasons and trends — wardrobe foundations rather than fast fashion." },
    { title: "Premium materials", body: "Leather, suede, wool, cotton and Tencel — sourced with integrity from heritage suppliers." },
    { title: "Sustainability", body: "0% leather waste in production. Ethically sourced throughout the supply chain." },
    { title: "London & Istanbul", body: "Designed in our London studio. Made by skilled craftspeople between London and Istanbul." },
  ],
};
const FALLBACK_PULL_QUOTE = {
  quote: "Urban outerwear designed to move with you, for any occasion — from street to statement.",
  attribution: "YNOT London",
};

export async function generateMetadata() {
  const page = await prisma.staticPage.findUnique({ where: { slug: "our-story" } });
  return {
    title: page?.metaTitle?.trim() || "Our Story · YNOT London",
    description:
      page?.metaDescription?.trim() ||
      "Premium women's outerwear designed in London — built to endure, designed to be relied on.",
  };
}

export default async function OurStoryPage() {
  const page = await prisma.staticPage.findUnique({ where: { slug: "our-story" } });
  const heroImage = page?.heroImage || FALLBACK_HERO;
  // Coerce markdown-pasted content to real HTML before render. If the
  // operator typed `# Header` instead of clicking the H2 button, TipTap
  // stored it as literal text — renderRichBodyHtml runs it through
  // marked so the storefront still sees proper headings, lists, and
  // bold spans rather than literal `#` characters.
  const bodyHtml = renderRichBodyHtml(page?.bodyMarkdown?.trim() || FALLBACK_BODY_HTML);
  const extras = parseOurStoryExtras(page?.extras ?? null);
  const valueCallouts = extras?.valueCallouts ?? FALLBACK_VALUE_CALLOUTS;
  const pullQuote = extras?.pullQuote ?? FALLBACK_PULL_QUOTE;
  const title = page?.title?.trim() || "Our Story";

  return (
    <>
      <AnnouncementBar />
      <SiteHeader />
      <main className="flex-1">
        <PageHero title={title} image={heroImage} />

        <Section padding="lg">
          <Container size="narrow">
            {/* TipTap output — sanitised at write time via the editor's
                node whitelist. Rendered through the design-system Prose
                wrapper (typography tokens) but here inlined as a div so
                we keep paragraph spacing on a non-prose page. */}
            <div
              className="flex flex-col gap-6 text-[16px] leading-relaxed text-foreground-primary [&_p]:m-0 [&_h2]:font-display [&_h2]:text-2xl [&_h3]:font-display [&_h3]:text-xl [&_a]:underline [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6"
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />
          </Container>
        </Section>

        {valueCallouts.items.length > 0 && (
          <Section padding="lg" background="cream">
            <Container size="wide">
              <Display level="md" as="h2" className="text-center mb-12 text-foreground-on-cream">
                {valueCallouts.heading}
              </Display>
              <ValueCallouts items={valueCallouts.items} />
            </Container>
          </Section>
        )}

        {pullQuote.quote && (
          <Section padding="lg">
            <Container size="wide">
              <PullQuote
                quote={pullQuote.quote}
                attribution={pullQuote.attribution}
              />
            </Container>
          </Section>
        )}
      </main>
      <SiteFooter />
      <WhatsAppWidget phone="+44 7000 000000" message="Hi YNOT, I have a question." />
    </>
  );
}
