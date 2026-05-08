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

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Our Story · YNOT London",
  description: "Premium women's outerwear designed in London — built to endure, designed to be relied on.",
};

const VALUES = [
  { title: "Timeless design", body: "Pieces designed to transcend seasons and trends — wardrobe foundations rather than fast fashion." },
  { title: "Premium materials", body: "Leather, suede, wool, cotton and Tencel — sourced with integrity from heritage suppliers." },
  { title: "Sustainability", body: "0% leather waste in production. Ethically sourced throughout the supply chain." },
  { title: "London & Istanbul", body: "Designed in our London studio. Made by skilled craftspeople between London and Istanbul." },
];

// Bundled stub used until the operator uploads a custom hero in
// /admin/content/pages → Our Story. Pre-populated on the StaticPage
// row at migration time so the admin form already shows it as
// "currently uploaded" (Replace / Clear) instead of an empty dropzone.
const FALLBACK_HERO = "/cms/our-story/hero.jpg";

export default async function OurStoryPage() {
  const page = await prisma.staticPage.findUnique({ where: { slug: "our-story" } });
  const heroImage = page?.heroImage || FALLBACK_HERO;
  return (
    <>
      <AnnouncementBar />
      <SiteHeader />
      <main className="flex-1">
        <PageHero title="Our Story" image={heroImage} />

        <Section padding="lg">
          <Container size="narrow">
            <div className="flex flex-col gap-6 text-[16px] leading-relaxed text-foreground-primary">
              <p>
                Previously known as Ynot Fashion — an online multi-brand clothing store — we&rsquo;ve rebranded as YNOT LONDON, marking an exciting new chapter in our journey.
              </p>
              <p>
                Throughout the year, our team developed a luxury outerwear collection that blends style, functionality and sustainability with timeless designs and contemporary innovations. Every piece is designed in London and produced between London and Istanbul.
              </p>
              <p>
                The collection features timeless silhouettes in seasonal colours with versatile styling options. Excellent craftsmanship, weather-resistant materials and unisex pieces sit at the heart of the line.
              </p>
              <p>
                <strong>Materials &amp; production standards.</strong> Our outerwear uses premium-quality materials, including vegetable-tanned leather sourced from Gold-rated suppliers of first-class raw materials. Leather outerwear is produced with zero leather waste — a commitment to sustainability built into the way we cut and pattern every piece.
              </p>
              <p>
                <strong>Featured pieces.</strong> Our lookbook showcases four signatures: the Lia Suede Bomber, Zoe Wool Coat, Tia Leather Bomber and Noa Leather Jacket.
              </p>
            </div>
          </Container>
        </Section>

        <Section padding="lg" background="cream">
          <Container size="wide">
            <Display level="md" as="h2" className="text-center mb-12 text-foreground-on-cream">
              What we stand for
            </Display>
            <ValueCallouts items={VALUES} />
          </Container>
        </Section>

        <Section padding="lg">
          <Container size="wide">
            <PullQuote
              quote="Urban outerwear designed to move with you, for any occasion — from street to statement."
              attribution="YNOT London"
            />
          </Container>
        </Section>
      </main>
      <SiteFooter />
      <WhatsAppWidget phone="+44 7000 000000" message="Hi YNOT, I have a question." />
    </>
  );
}
