import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/server/db/client";
import { SignInRequestSchema } from "@/lib/schemas";
import { findUserByEmail } from "@/server/repositories/user.repo";
import { verifyPassword } from "./password";

export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),
  // Auth.js v5 requires JWT strategy when Credentials provider is the only
  // sign-in path — DB sessions are only writable by adapter-driven providers
  // (OAuth + email-link). Token TTL still 30 days; the cookie payload is a
  // signed JWT containing the user id.
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  trustHost: true,
  pages: {
    signIn: "/sign-in",
    verifyRequest: "/verify-email",
    error: "/sign-in",
  },
  cookies: {
    sessionToken: {
      name: "ynot.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
      },
    },
  },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(input) {
        const parsed = SignInRequestSchema.safeParse(input);
        if (!parsed.success) return null;
        const user = await findUserByEmail(parsed.data.email);
        if (!user || !user.passwordHash) return null;
        const ok = await verifyPassword(parsed.data.password, user.passwordHash);
        if (!ok) return null;
        if (!user.emailVerifiedAt) {
          // Surface a specific error code so the route handler can route the
          // client to /verify-email rather than showing a generic credentials
          // error.
          throw new Error("EMAIL_NOT_VERIFIED");
        }
        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      // On sign-in, copy id + role into the token so route handlers calling
      // auth() (e.g. /api/admin/**/status) get the role without a DB roundtrip.
      // requireOwner() reads session.user.role — without this it sees undefined
      // and rejects every privileged request as 403.
      if (user) {
        token.id = user.id;
        const role = (user as unknown as { role?: string }).role;
        if (role) token.role = role;
      }
      // Self-heal sessions issued before role was added to the token (otherwise
      // already-signed-in OWNERs would have to log out + back in to publish).
      if (token?.id && typeof token.id === "string" && !token.role) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id },
          select: { role: true },
        });
        if (dbUser?.role) token.role = dbUser.role;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (token?.id && typeof token.id === "string") {
        session.user.id = token.id;
      }
      if (token?.role && typeof token.role === "string") {
        (session.user as unknown as { role?: string }).role = token.role;
      }
      return session;
    },
  },
};
