import * as React from "react";
import { AnnouncementBar } from "@/components/announcement-bar";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { WhatsAppWidget } from "@/components/whatsapp-widget";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Tabs } from "@/components/ui/tabs";
import { PageHero } from "@/components/static/page-hero";
import { CareTabContent } from "@/components/static/care-tab-content";
import { prisma } from "@/server/db/client";
import {
  parseProductCareExtras,
  type ProductCareExtras,
} from "@/lib/cms/page-extras";

export const dynamic = "force-dynamic";

const FALLBACK: ProductCareExtras = {
  hero: {
    eyebrow: "Product Care",
    title: "Made to last.",
    description:
      "Keep your YNOT pieces looking their best with these care instructions. Select a material to view detailed guidance.",
  },
  materials: [
    {
      value: "leather",
      label: "Leather",
      intro:
        "Leather is a natural material that develops a beautiful patina over time. With proper care, your YNOT leather piece will last for years and only get better with age.",
      sections: [
        { title: "Cleaning", body: "Wipe with a soft, damp cloth. Use specialist leather cleaner for stubborn marks. Never use harsh chemicals or abrasive materials." },
        { title: "Protection", body: "Apply leather conditioner every 6 months to maintain suppleness. Avoid direct sunlight and heat sources for prolonged periods." },
        { title: "Storage", body: "Store on a padded hanger in a breathable garment bag. Keep in a cool, dry place away from direct sunlight. Never fold leather garments." },
      ],
    },
    {
      value: "shearling",
      label: "Shearling",
      intro: "Shearling is a luxurious natural material that requires gentle care to retain its softness, warmth, and longevity.",
      sections: [
        { title: "Cleaning", body: "Spot clean only. For deep cleaning, use a specialist shearling cleaner — never machine wash or dry clean conventionally." },
        { title: "Protection", body: "Brush gently with a suede brush to maintain texture. Avoid prolonged exposure to rain or moisture." },
        { title: "Storage", body: "Hang on a wide padded hanger to maintain shape. Store in a cool, dry place. Use a garment bag if storing for an extended period." },
      ],
    },
    {
      value: "suede",
      label: "Suede",
      intro: "Suede is delicate but durable when cared for properly. Regular brushing and prompt stain treatment keep your piece looking its best.",
      sections: [
        { title: "Cleaning", body: "Use a suede brush to remove dust and revive nap. For stains, blot immediately with a clean cloth and use a suede eraser." },
        { title: "Protection", body: "Apply a suede protector spray before first wear and after cleaning. Avoid wearing in heavy rain." },
        { title: "Storage", body: "Hang on a padded hanger in a breathable garment bag. Stuff sleeves with tissue to maintain shape." },
      ],
    },
    {
      value: "wool",
      label: "Wool",
      intro: "Wool is naturally resilient, breathable, and warm. With minimal care, your wool piece will serve you for many seasons.",
      sections: [
        { title: "Cleaning", body: "Dry clean only. Brush gently with a soft clothes brush after each wear to remove surface dust and debris." },
        { title: "Protection", body: "Air your garment between wears to allow natural fibres to recover. Avoid direct heat when drying." },
        { title: "Storage", body: "Fold and store in a breathable bag with cedar blocks to deter moths. Avoid plastic, which traps moisture." },
      ],
    },
    {
      value: "cotton",
      label: "Cotton",
      intro: "Cotton outerwear is the easiest to care for. Follow the care label for machine washing instructions and your piece will stay fresh wear after wear.",
      sections: [
        { title: "Cleaning", body: "Machine wash cold on a gentle cycle with similar colours. Use a mild detergent — avoid bleach." },
        { title: "Protection", body: "Wash inside-out to preserve colour. Avoid over-drying — remove from the dryer while slightly damp." },
        { title: "Storage", body: "Fold or hang in a dry, ventilated place. Iron on a medium setting if needed." },
      ],
    },
  ],
};

export async function generateMetadata() {
  const page = await prisma.staticPage.findUnique({ where: { slug: "product-care" } });
  return {
    title: page?.metaTitle?.trim() || "Product Care · YNOT London",
    description:
      page?.metaDescription?.trim() ||
      "Care instructions for leather, shearling, suede, wool, and cotton outerwear.",
  };
}

export default async function ProductCarePage() {
  const page = await prisma.staticPage.findUnique({ where: { slug: "product-care" } });
  const extras = parseProductCareExtras(page?.extras ?? null) ?? FALLBACK;
  const { hero, materials } = extras;

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

        {materials.length > 0 && (
          <Section padding="lg">
            <Container size="wide">
              <Tabs
                items={materials.map((m) => ({
                  value: m.value,
                  label: m.label,
                  content: <CareTabContent intro={m.intro} sections={m.sections} />,
                }))}
              />
            </Container>
          </Section>
        )}
      </main>
      <SiteFooter />
      <WhatsAppWidget />
    </>
  );
}
