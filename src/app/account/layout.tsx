import * as React from "react";
import { redirect } from "next/navigation";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { AnnouncementBar } from "@/components/announcement-bar";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { WhatsAppWidget } from "@/components/whatsapp-widget";
import { AccountLayout } from "@/components/account/account-layout";
import { SessionProvider } from "@/components/account/session-context";
import { getSessionUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function AccountLayoutShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/sign-in?next=/account");
  }
  return (
    <SessionProvider
      user={{
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerifiedAt: user.emailVerifiedAt
          ? user.emailVerifiedAt.toISOString()
          : null,
      }}
    >
      <AnnouncementBar />
      <SiteHeader />
      <main className="flex-1">
        <Section padding="md">
          <Container size="wide">
            <AccountLayout>{children}</AccountLayout>
          </Container>
        </Section>
      </main>
      <SiteFooter />
      <WhatsAppWidget />
    </SessionProvider>
  );
}
