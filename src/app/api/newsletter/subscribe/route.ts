import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const Body = z.object({
  email: z.string().email(),
});

/**
 * Newsletter signup endpoint. Phase 8 stub — captures the address but
 * doesn't yet integrate with a marketing automation provider (Klaviyo /
 * Mailchimp). When that integration lands, replace the console.info call
 * with the upstream API request.
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
  // Intentional: no DB row yet — schema doesn't have a Subscriber model.
  // Logging keeps the address visible in worker logs until we wire a
  // proper integration.
  console.info("[newsletter] subscribe", parsed.data.email);
  return NextResponse.json({ ok: true }, { status: 200 });
}
