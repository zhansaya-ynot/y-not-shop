import { NextResponse } from "next/server";
import { VerifyEmailRequestSchema } from "@/lib/schemas";
import { assertCsrf } from "@/server/auth/csrf";
import { consumeVerificationToken } from "@/server/auth/codes";
import { findUserByEmail, markEmailVerified } from "@/server/repositories/user.repo";
import { checkRateLimit } from "@/server/auth/rate-limit";
import { issueWelcomePromo } from "@/server/promos/welcome";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  try {
    await assertCsrf();
  } catch {
    return NextResponse.json({ error: "INVALID_CSRF" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = VerifyEmailRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 422 });
  }

  const rl = await checkRateLimit({
    key: `verify:email:${parsed.data.email}`,
    windowMs: 15 * 60_000,
    max: 5,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMIT" },
      { status: 429, headers: { "Retry-After": Math.ceil(rl.retryAfterMs / 1000).toString() } },
    );
  }

  const ok = await consumeVerificationToken("verify", parsed.data.email, parsed.data.code);
  if (!ok) {
    return NextResponse.json({ error: "INVALID_CODE" }, { status: 401 });
  }

  const user = await findUserByEmail(parsed.data.email);
  if (!user) {
    return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
  }

  // Read before the write: `markEmailVerified` is not idempotent in the
  // sense we need here — it overwrites the timestamp, so afterwards there
  // is no way to tell a first confirmation from a repeat one.
  const firstConfirmation = user.emailVerifiedAt === null;
  await markEmailVerified(user.id);

  if (firstConfirmation) {
    // Making good on the "Sign in and get 10% off your first order" promise
    // in the announcement bar. Deliberately here rather than at sign-up, so
    // the discount only reaches an address its owner has proven they read.
    //
    // Never let this fail the request: verification is how the customer gets
    // into their account, and a missing perk is recoverable by hand while a
    // blocked sign-in is not.
    try {
      await issueWelcomePromo({
        userId: user.id,
        email: user.email,
        name: user.name,
      });
    } catch (err) {
      console.error("[verify-email] welcome promo failed", {
        userId: user.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({ ok: true });
}
