import { auth } from '@/server/auth/nextauth';
import { requireOwner, AuthorizationError } from '@/server/auth/guards';
import { NewsletterBroadcastSchema } from '@/lib/schemas/admin-newsletter';
import { sendBroadcast } from '@/server/newsletter/broadcast';
import { withAudit } from '@/server/admin/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Newsletter sends are I/O-bound and serial through Resend; give the
// route plenty of headroom so a few-hundred-recipient batch can finish.
export const maxDuration = 300;

export async function POST(req: Request): Promise<Response> {
  let session;
  try {
    session = requireOwner(await auth());
  } catch (e) {
    if (e instanceof AuthorizationError) return new Response('Forbidden', { status: 403 });
    throw e;
  }
  const body = await req.json().catch(() => null);
  const parsed = NewsletterBroadcastSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  const actorId = session.user?.id;
  if (!actorId) return new Response('Forbidden', { status: 403 });

  const result = await withAudit(
    {
      actorId,
      entityType: 'newsletter_broadcast',
      entityId: 'broadcast',
      action: 'newsletter.broadcast.send',
      before: { subject: parsed.data.subject },
      ip: req.headers.get('x-forwarded-for') ?? undefined,
      ua: req.headers.get('user-agent') ?? undefined,
    },
    () => sendBroadcast(parsed.data),
  );

  return Response.json(result);
}
