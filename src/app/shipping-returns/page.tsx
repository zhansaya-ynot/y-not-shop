import * as React from "react";
import Link from "next/link";
import { AnnouncementBar } from "@/components/announcement-bar";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { WhatsAppWidget } from "@/components/whatsapp-widget";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Tabs } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { PageHero } from "@/components/static/page-hero";
import { ShippingTable } from "@/components/static/shipping-table";
import { prisma } from "@/server/db/client";
import {
  parseShippingReturnsExtras,
  type ShippingReturnsExtras,
} from "@/lib/cms/page-extras";

export const dynamic = "force-dynamic";

const FALLBACK: ShippingReturnsExtras = {
  hero: { eyebrow: "Shipping & Returns", title: "Easy returns within 14 days." },
  delivery: {
    intro:
      "UK shipping is free via Royal Mail. Worldwide DHL is charged at standard rates calculated at checkout. Orders are dispatched from our London warehouse within 1–2 business days.",
    rows: [
      { destination: "United Kingdom", time: "2–3 business days", carrier: "Royal Mail", cost: "Free" },
      { destination: "Worldwide", time: "8–10 business days", carrier: "DHL", cost: "Calculated at checkout" },
    ],
    note: "For pre-orders, please allow an extra 3 weeks on top of the standard delivery time. We'll email you as soon as your item ships.",
  },
  returns: {
    intro:
      "We accept returns within 14 days of delivery. Items must be unworn, in original condition with all tags attached.",
    bullets: [
      "Items must be returned within 14 days of delivery",
      "All original tags and packaging must be intact",
      "Items must be unworn and in original condition",
      "Refunds are processed within 5–7 business days",
      "If the item was pre-ordered, allow an extra 3 weeks for it to be delivered",
    ],
    ctaLabel: "Start your return",
    ctaHref: "/initiate-return",
  },
};

export async function generateMetadata() {
  const page = await prisma.staticPage.findUnique({ where: { slug: "shipping-returns" } });
  return {
    title: page?.metaTitle?.trim() || "Shipping & Returns · YNOT London",
    description:
      page?.metaDescription?.trim() ||
      "Free UK delivery via Royal Mail. Worldwide DHL. 14-day returns.",
  };
}

export default async function ShippingReturnsPage() {
  const page = await prisma.staticPage.findUnique({ where: { slug: "shipping-returns" } });
  const extras = parseShippingReturnsExtras(page?.extras ?? null) ?? FALLBACK;
  const { hero, delivery, returns } = extras;

  return (
    <>
      <AnnouncementBar />
      <SiteHeader />
      <main className="flex-1">
        <PageHero eyebrow={hero.eyebrow} title={hero.title} />

        <Section padding="lg">
          <Container size="wide">
            <Tabs
              items={[
                {
                  value: "delivery",
                  label: "Delivery",
                  content: (
                    <div className="flex flex-col gap-8">
                      {delivery.intro && (
                        <p className="text-[15px] text-foreground-primary max-w-[640px] whitespace-pre-line">
                          {delivery.intro}
                        </p>
                      )}
                      {delivery.rows.length > 0 && <ShippingTable rows={delivery.rows} />}
                      {delivery.note && (
                        <p className="text-[15px] text-foreground-primary max-w-[640px] whitespace-pre-line">
                          {delivery.note}
                        </p>
                      )}
                    </div>
                  ),
                },
                {
                  value: "returns",
                  label: "Returns",
                  content: (
                    <div className="flex flex-col gap-8 max-w-[640px]">
                      {returns.intro && (
                        <p className="text-[15px] text-foreground-primary whitespace-pre-line">
                          {returns.intro}
                        </p>
                      )}
                      {returns.bullets.length > 0 && (
                        <ul className="flex flex-col gap-3 text-[14px] text-foreground-primary">
                          {returns.bullets.map((b, idx) => (
                            <li key={idx} className="flex gap-3">
                              <span aria-hidden className="text-accent-warm">·</span>
                              <span>{b}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {returns.ctaLabel && returns.ctaHref && (
                        <Link href={returns.ctaHref} className="self-start">
                          <Button>{returns.ctaLabel}</Button>
                        </Link>
                      )}
                    </div>
                  ),
                },
              ]}
            />
          </Container>
        </Section>
      </main>
      <SiteFooter />
      <WhatsAppWidget phone="+44 7000 000000" message="Hi YNOT, I have a question." />
    </>
  );
}
