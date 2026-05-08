import * as React from "react";
import { AnnouncementBar } from "@/components/announcement-bar";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { WhatsAppWidget } from "@/components/whatsapp-widget";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Display } from "@/components/ui/typography";
import { PageHero } from "@/components/static/page-hero";
import { StatsBlock } from "@/components/static/stats-block";
import { prisma } from "@/server/db/client";
import {
  parseSustainabilityExtras,
  type SustainabilityExtras,
} from "@/lib/cms/page-extras";

export const dynamic = "force-dynamic";

const FALLBACK: SustainabilityExtras = {
  hero: {
    eyebrow: "Sustainability & Animal Welfare",
    title: "Responsibility, woven in.",
    description:
      "At YNOT London, sustainability isn't a trend — it's a responsibility. We believe that creating beautiful outerwear shouldn't come at the cost of the planet.",
  },
  stats: [
    { value: "0%", label: "Leather waste" },
    { value: "100%", label: "By-product sourcing" },
    { value: "LWG", label: "Certified partners" },
  ],
  approachHeading: "Our approach",
  approaches: [
    {
      title: "By-product sourcing",
      body: "All leather used in YNOT products is a by-product of the food industry. We ensure that no animal is raised or harmed for the sole purpose of leather production.",
    },
    {
      title: "LWG certification",
      body: "We partner exclusively with tanneries certified by the Leather Working Group, ensuring the highest standards in environmental management, water treatment, and energy efficiency.",
    },
    {
      title: "Zero waste production",
      body: "Our cutting process is optimised to achieve 0% leather waste. Offcuts are repurposed for smaller accessories or returned to suppliers for use in other products.",
    },
    {
      title: "Responsible fibres",
      body: "We use Tencel, a sustainably sourced wood fibre, alongside responsibly produced wool and organic cotton. Every material is chosen with the planet in mind.",
    },
  ],
};

export async function generateMetadata() {
  const page = await prisma.staticPage.findUnique({ where: { slug: "sustainability" } });
  return {
    title: page?.metaTitle?.trim() || "Sustainability · YNOT London",
    description:
      page?.metaDescription?.trim() ||
      "Our approach to sustainability and animal welfare — by-product sourcing, LWG certification, zero waste production.",
  };
}

export default async function SustainabilityPage() {
  const page = await prisma.staticPage.findUnique({ where: { slug: "sustainability" } });
  const extras = parseSustainabilityExtras(page?.extras ?? null) ?? FALLBACK;
  const { hero, stats, approachHeading, approaches } = extras;

  return (
    <>
      <AnnouncementBar />
      <SiteHeader />
      <main className="flex-1">
        <PageHero
          eyebrow={hero.eyebrow}
          title={hero.title}
          description={hero.description || undefined}
        />

        {stats.length > 0 && (
          <Section padding="lg">
            <Container size="wide">
              <StatsBlock stats={stats} />
            </Container>
          </Section>
        )}

        {approaches.length > 0 && (
          <Section padding="lg" background="cream">
            <Container size="wide">
              <Display level="md" as="h2" className="text-center mb-16 text-foreground-on-cream">
                {approachHeading}
              </Display>
              <div className="grid gap-12 md:grid-cols-2 md:gap-16">
                {approaches.map((a, idx) => (
                  <article key={idx} className="flex flex-col gap-3">
                    <h3 className="font-heading text-[24px] text-foreground-on-cream">{a.title}</h3>
                    <p className="text-[15px] leading-relaxed text-foreground-on-cream whitespace-pre-line">
                      {a.body}
                    </p>
                  </article>
                ))}
              </div>
            </Container>
          </Section>
        )}
      </main>
      <SiteFooter />
      <WhatsAppWidget phone="+44 7000 000000" message="Hi YNOT, I have a question." />
    </>
  );
}
