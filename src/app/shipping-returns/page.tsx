"use client";

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

const ROWS = [
  { destination: "United Kingdom", time: "2–3 business days", carrier: "Royal Mail", cost: "Free" },
  { destination: "Worldwide", time: "8–10 business days", carrier: "DHL", cost: "Calculated at checkout" },
];

const RETURN_BULLETS = [
  "Items must be returned within 14 days of delivery",
  "All original tags and packaging must be intact",
  "Items must be unworn and in original condition",
  "Refunds are processed within 5–7 business days",
  "If the item was pre-ordered, allow an extra 3 weeks for it to be delivered",
];

export default function ShippingReturnsPage() {
  return (
    <>
      <AnnouncementBar />
      <SiteHeader />
      <main className="flex-1">
        <PageHero eyebrow="Shipping & Returns" title="Easy returns within 14 days." />

        <Section padding="lg">
          <Container size="wide">
            <Tabs
              items={[
                {
                  value: "delivery",
                  label: "Delivery",
                  content: (
                    <div className="flex flex-col gap-8">
                      <p className="text-[15px] text-foreground-primary max-w-[640px]">
                        UK shipping is free via Royal Mail. Worldwide DHL is charged at standard rates calculated at checkout. Orders are dispatched from our London warehouse within 1–2 business days.
                      </p>
                      <ShippingTable rows={ROWS} />
                      <p className="text-[15px] text-foreground-primary max-w-[640px]">
                        For pre-orders, please allow an extra 3 weeks on top of the standard delivery time. We&rsquo;ll email you as soon as your item ships.
                      </p>
                    </div>
                  ),
                },
                {
                  value: "returns",
                  label: "Returns",
                  content: (
                    <div className="flex flex-col gap-8 max-w-[640px]">
                      <p className="text-[15px] text-foreground-primary">
                        We accept returns within 14 days of delivery. Items must be unworn, in original condition with all tags attached.
                      </p>
                      <ul className="flex flex-col gap-3 text-[14px] text-foreground-primary">
                        {RETURN_BULLETS.map((b) => (
                          <li key={b} className="flex gap-3">
                            <span aria-hidden className="text-accent-warm">·</span>
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                      <Link href="/initiate-return" className="self-start">
                        <Button>Start your return</Button>
                      </Link>
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
