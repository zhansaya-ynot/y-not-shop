import { prisma } from '@/server/db/client';
import { getEmailService } from '@/server/email';
import { signUnsubscribeToken } from '@/lib/newsletter/token';

export interface BroadcastInput {
  subject: string;
  /** Plain-text body. Line breaks preserved; the HTML version wraps it
   *  in <p> + <br/> and appends the unsubscribe footer. */
  body: string;
}

export interface BroadcastResult {
  total: number;
  sent: number;
  failed: number;
  failures: Array<{ email: string; error: string }>;
}

/**
 * Send a marketing broadcast to every active NewsletterSubscriber.
 * One email per subscriber so each gets a unique unsubscribe link in
 * the footer (CAN-SPAM + UK PECR). Errors per recipient are caught
 * so one bad address can't poison the whole batch.
 *
 * Throttles to ~5 sends/second to stay safely under Resend's free-tier
 * limits (10 req/s). Good enough for YNOT's MVP newsletter size; bump
 * later or migrate to Resend Broadcasts if list grows past a few
 * thousand.
 */
export async function sendBroadcast(input: BroadcastInput): Promise<BroadcastResult> {
  const subscribers = await prisma.newsletterSubscriber.findMany({
    where: { isActive: true },
    select: { email: true },
    orderBy: { subscribedAt: 'asc' },
  });

  const result: BroadcastResult = {
    total: subscribers.length,
    sent: 0,
    failed: 0,
    failures: [],
  };

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ynotlondon.com';
  const email = getEmailService();

  for (const sub of subscribers) {
    const token = signUnsubscribeToken(sub.email);
    const unsubUrl = `${baseUrl}/newsletter/unsubscribe?token=${encodeURIComponent(token)}`;
    const html = renderHtml(input.body, unsubUrl);
    const text = `${input.body}\n\n---\nUnsubscribe: ${unsubUrl}`;

    try {
      await email.send({
        to: sub.email,
        subject: input.subject,
        html,
        text,
      });
      result.sent += 1;
    } catch (err) {
      result.failed += 1;
      result.failures.push({
        email: sub.email,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    await new Promise((r) => setTimeout(r, 200));
  }

  return result;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderHtml(body: string, unsubUrl: string): string {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;line-height:1.6;color:#1a1a1a">${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`)
    .join('');
  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f8f8f8;font-family:Inter,Helvetica,Arial,sans-serif;color:#1a1a1a;font-size:14px">
  <div style="max-width:560px;margin:0 auto;background:#fff;padding:32px">
    ${paragraphs}
    <hr style="border:none;border-top:1px solid #e5e5e5;margin:32px 0 16px"/>
    <p style="font-size:11px;color:#888;line-height:1.5;margin:0">
      You&rsquo;re receiving this email because you subscribed to YNOT London updates.
      <a href="${unsubUrl}" style="color:#888;text-decoration:underline">Unsubscribe</a>.
    </p>
  </div>
</body></html>`;
}
