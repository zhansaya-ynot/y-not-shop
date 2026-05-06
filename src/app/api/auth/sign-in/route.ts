import { NextResponse } from "next/server";
import { SignInRequestSchema } from "@/lib/schemas";
import { assertCsrf } from "@/server/auth/csrf";
import { signIn } from "@/server/auth/nextauth";
import { checkRateLimit } from "@/server/auth/rate-limit";
import { findUserByEmail } from "@/server/repositories/user.repo";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  try {
    await assertCsrf();
  } catch {
    return NextResponse.json({ error: "INVALID_CSRF" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = SignInRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 422 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const ipRl = await checkRateLimit({ key: `signin:ip:${ip}`, windowMs: 15 * 60_000, max: 5 });
  const emailRl = await checkRateLimit({
    key: `signin:email:${parsed.data.email}`,
    windowMs: 15 * 60_000,
    max: 5,
  });
  if (!ipRl.allowed || !emailRl.allowed) {
    const retry = Math.max(ipRl.retryAfterMs, emailRl.retryAfterMs);
    return NextResponse.json(
      { error: "RATE_LIMIT" },
      { status: 429, headers: { "Retry-After": Math.ceil(retry / 1000).toString() } },
    );
  }

  try {
    await signIn("credentials", { ...parsed.data, redirect: false });
    // Surface the role so the sign-in page can route admins straight to /admin
    // instead of /account (which is the customer cabinet).
    const user = await findUserByEmail(parsed.data.email);
    return NextResponse.json({ ok: true, role: user?.role ?? null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message.includes("EMAIL_NOT_VERIFIED")) {
      return NextResponse.json({ error: "EMAIL_NOT_VERIFIED" }, { status: 403 });
    }
    return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
  }
}
