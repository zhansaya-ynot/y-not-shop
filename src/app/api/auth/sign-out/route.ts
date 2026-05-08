import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { signOut } from "@/server/auth/nextauth";
import { assertCsrf } from "@/server/auth/csrf";

export const dynamic = "force-dynamic";

// Cookie names mirror src/server/auth/config.ts. Auth.js v5's `signOut()` is
// designed for Server Actions / middleware where it can mutate response
// cookies via the framework's RSC-aware response object. From a plain Route
// Handler the cleanup is brittle and can leave the JWT intact — we observed
// /admin still serving the dashboard after a successful sign-out POST.
// Strategy: call signOut() (best-effort, also clears any DB session row if
// the strategy ever flips to database) AND explicitly delete the cookies
// via next/headers so the response definitely carries the Set-Cookie
// invalidations.
const COOKIE_NAMES = [
  "ynot.session-token",
  // Auth.js prepends __Secure- in production when secure:true. Belt-and-braces.
  "__Secure-ynot.session-token",
  // CSRF cookie also rotates on sign-out so the next sign-in gets a fresh one.
  "authjs.csrf-token",
  "__Host-authjs.csrf-token",
  "authjs.callback-url",
  "__Secure-authjs.callback-url",
];

export async function POST(): Promise<NextResponse> {
  try {
    await assertCsrf();
  } catch {
    return NextResponse.json({ error: "INVALID_CSRF" }, { status: 403 });
  }
  await signOut({ redirect: false }).catch(() => {
    // Auth.js may throw inside a Route Handler (no RSC response context);
    // we still proceed to delete the cookies manually below.
  });
  const jar = await cookies();
  for (const name of COOKIE_NAMES) {
    // delete() writes a Max-Age=0 expiry — covers both http and https.
    jar.delete(name);
  }
  return NextResponse.json({ ok: true });
}
