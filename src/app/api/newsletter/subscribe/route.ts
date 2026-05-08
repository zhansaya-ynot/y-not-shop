import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db/client";

export const runtime = "nodejs";

const Body = z.object({
  email: z.string().email(),
  source: z.string().min(1).max(60).optional(),
});

/**
 * Newsletter signup endpoint. Persists the address into NewsletterSubscriber
 * so the operator can export the list to an ESP later (Klaviyo / Mailchimp /
 * Resend Audience). Idempotent: a repeat signup with the same email is a
 * no-op (we still return 200 so the customer always sees confirmation).
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase().trim();
  const source = parsed.data.source ?? "homepage";

  await prisma.newsletterSubscriber.upsert({
    where: { email },
    create: { email, source, isActive: true },
    // Re-activating a previously unsubscribed address is intentional here —
    // someone hitting the form again is signalling they want back in.
    update: { isActive: true, unsubscribedAt: null },
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
