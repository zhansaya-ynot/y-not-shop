import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db/client";

export const runtime = "nodejs";

const Body = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(180),
  subject: z.string().max(200).optional().default(""),
  message: z.string().min(5).max(5000),
});

/**
 * Public contact form endpoint. Persists the submission to ContactMessage
 * (status NEW) so the operator can triage in /admin/messages. We don't
 * send an email here — Resend's transactional pipeline already alerts on
 * ALERT_EMAIL via the worker; if/when we want a faster ping, add it
 * there instead of duplicating the email send across two paths.
 *
 * Anti-abuse: Phase 8 trusts the front-end; if spam becomes a problem,
 * front the route with Cloudflare Turnstile before promoting to live.
 */
export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_BODY", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { name, email, subject, message } = parsed.data;
  await prisma.contactMessage.create({
    data: { name, email, subject, message },
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}
