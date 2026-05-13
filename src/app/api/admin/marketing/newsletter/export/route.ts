import { prisma } from '@/server/db/client';
import { auth } from '@/server/auth/nextauth';
import { requireOwner, AuthorizationError } from '@/server/auth/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * CSV export of every NewsletterSubscriber. Includes the unsubscribed
 * ones too so the operator can verify churn or feed a downstream tool
 * (Mailchimp, Klaviyo) that needs the full list. Each cell is wrapped
 * in quotes and inner quotes are escaped per RFC 4180.
 */
export async function GET(): Promise<Response> {
  try {
    requireOwner(await auth());
  } catch (e) {
    if (e instanceof AuthorizationError) return new Response('Forbidden', { status: 403 });
    throw e;
  }

  const subs = await prisma.newsletterSubscriber.findMany({
    orderBy: { subscribedAt: 'desc' },
    select: {
      email: true,
      source: true,
      isActive: true,
      subscribedAt: true,
      unsubscribedAt: true,
    },
  });

  const header = ['email', 'source', 'is_active', 'subscribed_at', 'unsubscribed_at'];
  const rows = subs.map((s) => [
    s.email,
    s.source,
    s.isActive ? 'true' : 'false',
    s.subscribedAt.toISOString(),
    s.unsubscribedAt ? s.unsubscribedAt.toISOString() : '',
  ]);

  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="newsletter-subscribers-${new Date()
        .toISOString()
        .slice(0, 10)}.csv"`,
    },
  });
}
