import * as React from "react";
import Link from "next/link";
import { AnnouncementBarServer } from "@/components/announcement-bar-server";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Display } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";

interface PageProps {
  searchParams: Promise<{ id?: string }>;
}

/**
 * Confirmation screen rendered after a successful POST /api/returns. Shown
 * to the customer with their return number and the next-step instructions
 * that used to live in the wizard's step-3 stub (Phase 5 task 99).
 */
export default async function ReturnSuccessPage({ searchParams }: PageProps) {
  const { id: returnNumber } = await searchParams;

  return (
    <>
      <AnnouncementBarServer />
      <SiteHeader />
      <main className="flex-1">
        <Section padding="md">
          <Container size="narrow">
            <div className="flex flex-col gap-8 max-w-[640px] text-center mx-auto">
              <Display level="md" as="h1">
                Return submitted
              </Display>
              {returnNumber ? (
                <p className="text-[14px] text-foreground-secondary">
                  We&rsquo;ve received your return request. Your return number
                  is <strong>{returnNumber}</strong>. A pre-paid label and
                  instructions have been sent to your email.
                </p>
              ) : (
                <p className="text-[14px] text-foreground-secondary">
                  We&rsquo;ve received your return request. A pre-paid label
                  and instructions have been sent to your email.
                </p>
              )}

              <div className="border border-border-light p-6 text-left">
                <h2 className="text-[12px] font-semibold uppercase tracking-[0.2em] text-foreground-secondary mb-3">
                  Next steps
                </h2>
                <ol className="flex flex-col gap-2 text-[14px] text-foreground-primary list-decimal pl-5">
                  <li>Print the pre-paid label from the email we sent.</li>
                  <li>
                    Pack the items in their original packaging with tags
                    attached.
                  </li>
                  <li>
                    Drop off at any Royal Mail post office (UK) or DHL
                    ServicePoint (worldwide).
                  </li>
                  <li>
                    You&rsquo;ll receive a refund within 5–7 business days of
                    us receiving the return.
                  </li>
                </ol>
              </div>

              <div className="flex justify-center">
                <Link href="/">
                  <Button size="lg">Continue shopping</Button>
                </Link>
              </div>
            </div>
          </Container>
        </Section>
      </main>
      <SiteFooter />
    </>
  );
}
