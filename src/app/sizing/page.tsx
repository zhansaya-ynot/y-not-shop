import * as React from "react";
import { AnnouncementBar } from "@/components/announcement-bar";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { WhatsAppWidget } from "@/components/whatsapp-widget";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { PageHero } from "@/components/static/page-hero";
import { prisma } from "@/server/db/client";
import { renderRichBodyHtml } from "@/lib/cms/render-content";

export const dynamic = "force-dynamic";

// Bundled fallback so /sizing renders something useful before the
// operator has touched it in /admin/content/pages. Once a StaticPage
// row with slug='sizing' exists, its title/body override these.
const FALLBACK_TITLE = "General sizing";
const FALLBACK_BODY_HTML = `
<p>YNOT pieces are cut to a relaxed, true-to-size fit. If you're between sizes, we recommend sizing down for a tailored silhouette or sizing up for a more relaxed look.</p>

<h2>Women's sizing</h2>
<table>
  <thead>
    <tr><th>Size</th><th>UK</th><th>EU</th><th>US</th><th>Bust (cm)</th><th>Waist (cm)</th><th>Hips (cm)</th></tr>
  </thead>
  <tbody>
    <tr><td>S</td><td>8</td><td>36</td><td>4</td><td>84</td><td>66</td><td>92</td></tr>
    <tr><td>M</td><td>10</td><td>38</td><td>6</td><td>88</td><td>70</td><td>96</td></tr>
    <tr><td>L</td><td>12</td><td>40</td><td>8</td><td>92</td><td>74</td><td>100</td></tr>
  </tbody>
</table>

<h2>How to measure</h2>
<p><strong>Bust:</strong> Measure around the fullest part, keeping the tape parallel to the floor.</p>
<p><strong>Waist:</strong> Measure around your natural waistline, the narrowest part of your torso.</p>
<p><strong>Hips:</strong> Measure around the fullest part of your hips, about 20cm below your waist.</p>

<h2>Need help?</h2>
<p>If you're unsure about sizing for a specific piece, check the product page for a garment-specific size guide, or <a href="/contact">get in touch</a> — we're happy to advise.</p>
`;

export async function generateMetadata() {
  const page = await prisma.staticPage.findUnique({ where: { slug: "sizing" } });
  return {
    title: page?.metaTitle?.trim() || "General sizing · YNOT London",
    description:
      page?.metaDescription?.trim() ||
      "YNOT London sizing guide — UK / EU / US conversions, body measurements, and how to measure yourself.",
  };
}

export default async function SizingPage() {
  const page = await prisma.staticPage.findUnique({ where: { slug: "sizing" } });
  const title = page?.title?.trim() || FALLBACK_TITLE;
  // Reuse the same coercion as Our Story so markdown pasted into TipTap
  // still renders as real HTML on the storefront.
  const bodyHtml = renderRichBodyHtml(page?.bodyMarkdown?.trim() || FALLBACK_BODY_HTML);
  const heroImage = page?.heroImage || undefined;

  return (
    <>
      <AnnouncementBar />
      <SiteHeader />
      <main className="flex-1">
        <PageHero title={title} {...(heroImage ? { image: heroImage } : {})} />

        <Section padding="lg">
          <Container size="narrow">
            <div
              className="flex flex-col gap-6 text-[16px] leading-relaxed text-foreground-primary [&_p]:m-0 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:mt-8 [&_h3]:font-display [&_h3]:text-xl [&_a]:underline [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_table]:w-full [&_table]:border-collapse [&_th]:text-left [&_th]:font-semibold [&_th]:border-b [&_th]:border-border-light [&_th]:py-2 [&_th]:pr-4 [&_td]:py-2 [&_td]:pr-4 [&_td]:border-b [&_td]:border-border-light"
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />
          </Container>
        </Section>
      </main>
      <SiteFooter />
      <WhatsAppWidget />
    </>
  );
}
