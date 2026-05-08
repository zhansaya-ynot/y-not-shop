import * as React from "react";
import Link from "next/link";
import { AnnouncementBar } from "@/components/announcement-bar";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { WhatsAppWidget } from "@/components/whatsapp-widget";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Display } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <>
      <AnnouncementBar />
      <SiteHeader />
      <main className="flex-1">
        <Section padding="lg">
          <Container size="narrow" className="text-center">
            <p className="font-heading text-[120px] leading-none text-foreground-primary md:text-[180px]">404</p>
            <Display level="md" as="h1" className="mt-4">Page not found</Display>
            <p className="mt-4 mx-auto w-full max-w-[480px] text-[14px] text-foreground-secondary">
              The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
            </p>
            <div className="mt-10">
              <Link href="/">
                <Button size="lg">Back to home</Button>
              </Link>
            </div>
          </Container>
        </Section>
      </main>
      <SiteFooter />
      <WhatsAppWidget />
    </>
  );
}
