import { ConsoleEmailService } from "./console";
import { ResendEmailService } from "./resend";
import type { EmailService } from "./types";

export type { EmailService } from "./types";
export { ConsoleEmailService } from "./console";
export { ResendEmailService } from "./resend";

interface FactoryEnv {
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
  /** Reply-to header applied to every outbound. Optional — when unset
   *  recipients reply to the From address (the brand alias). */
  RESEND_REPLY_TO?: string;
  NODE_ENV?: string;
}

let logged = false;

function announce(implName: string, env: FactoryEnv): void {
  if (logged) return;
  logged = true;
  process.stderr.write(`[ynot email] using ${implName}\n`);
  if (implName === "ConsoleEmailService" && env.NODE_ENV === "production") {
    process.stderr.write(
      "[ynot email] WARNING: ConsoleEmailService active in production — set RESEND_API_KEY and RESEND_FROM.\n",
    );
  }
}

/**
 * Factory: picks ResendEmailService when both env vars are set, otherwise
 * falls back to ConsoleEmailService. Logs the choice once at startup.
 */
export function createEmailService(env: FactoryEnv): EmailService {
  if (env.RESEND_API_KEY && env.RESEND_FROM) {
    announce("ResendEmailService", env);
    return new ResendEmailService(env.RESEND_API_KEY, env.RESEND_FROM, env.RESEND_REPLY_TO);
  }
  announce("ConsoleEmailService", env);
  return new ConsoleEmailService();
}

let cached: EmailService | null = null;

/**
 * Module-scoped singleton. First call constructs from process.env; subsequent
 * calls return the same instance. Tests that need a fresh instance call
 * `createEmailService` directly.
 */
export function getEmailService(): EmailService {
  if (!cached) {
    cached = createEmailService(process.env);
  }
  return cached;
}
