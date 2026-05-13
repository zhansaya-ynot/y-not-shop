import * as React from 'react';
import { prisma } from '@/server/db/client';
import { verifyUnsubscribeToken } from '@/lib/newsletter/token';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';

export const dynamic = 'force-dynamic';

interface Ctx {
  searchParams: Promise<{ token?: string }>;
}

/**
 * One-click unsubscribe landing. Linked from the footer of every
 * marketing broadcast — token decodes back to the subscriber's email
 * and we flip isActive=false without requiring a sign-in. CAN-SPAM /
 * UK GDPR / ICO PECR all require unsubscribe to take effect without
 * a login wall.
 */
export default async function UnsubscribePage({ searchParams }: Ctx) {
  const { token } = await searchParams;
  let status: 'ok' | 'invalid' | 'not_found' = 'invalid';
  let email = '';

  if (token) {
    const verified = verifyUnsubscribeToken(token);
    if (verified) {
      email = verified;
      const sub = await prisma.newsletterSubscriber.findUnique({
        where: { email },
      });
      if (sub) {
        if (sub.isActive) {
          await prisma.newsletterSubscriber.update({
            where: { email },
            data: { isActive: false, unsubscribedAt: new Date() },
          });
        }
        status = 'ok';
      } else {
        status = 'not_found';
      }
    }
  }

  return (
    <>
      <div className="bg-surface-primary border-b border-border-light">
        <SiteHeader />
      </div>
      <main className="min-h-[60vh] flex items-center justify-center px-6 py-20">
        <div className="max-w-md text-center">
          {status === 'ok' && (
            <>
              <h1 className="text-2xl font-semibold mb-3">You&rsquo;re unsubscribed</h1>
              <p className="text-sm text-neutral-600">
                {email} will no longer receive YNOT marketing emails. You will
                still receive transactional emails for any active orders.
              </p>
            </>
          )}
          {status === 'invalid' && (
            <>
              <h1 className="text-2xl font-semibold mb-3">Invalid link</h1>
              <p className="text-sm text-neutral-600">
                This unsubscribe link is missing or has been tampered with.
                Reply to any YNOT email and we&rsquo;ll remove you manually.
              </p>
            </>
          )}
          {status === 'not_found' && (
            <>
              <h1 className="text-2xl font-semibold mb-3">Not subscribed</h1>
              <p className="text-sm text-neutral-600">
                {email} is not on our list — nothing to remove.
              </p>
            </>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
