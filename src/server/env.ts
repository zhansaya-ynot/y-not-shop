import { z } from "zod";

const EnvSchema = z.object({
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  // Default to "development" so we can omit NODE_ENV from committed env
  // files (pinning it there breaks `dotenv -e .env.development -- next build`
  // by downgrading the build to a dev React bundle).
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_SITE_URL: z.url(),
  /** Server-only public URL of the live site. Mirrors NEXT_PUBLIC_SITE_URL
   *  but lives outside the NEXT_PUBLIC_ namespace so it's NOT baked into
   *  the build at `pnpm build` time — Next inlines NEXT_PUBLIC_* as
   *  literal strings during webpack compile, which means anything sent
   *  from a Next-served handler (Stripe webhooks, API routes) keeps
   *  pointing at whatever URL was active during docker build, ignoring
   *  the value in secrets.env at runtime. APP_URL is read fresh on
   *  every container start, so a staging/prod cutover only needs a
   *  container restart, no rebuild. */
  APP_URL: z.url().optional(),
  NEXTAUTH_SECRET: z.string().min(32),
  STRIPE_SECRET_KEY: z.string().min(1, 'STRIPE_SECRET_KEY is required'),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1, 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is required'),
  STRIPE_WEBHOOK_SECRET: z.string().min(1, 'STRIPE_WEBHOOK_SECRET is required'),
  ORDER_TOKEN_SECRET: z.string().min(32, 'ORDER_TOKEN_SECRET must be at least 32 chars'),
  SHIPPING_PROVIDER: z.string().optional().transform((v) => (v && v.length > 0 ? v : 'mock')).pipe(z.enum(['mock', 'dhl'])),
  // Phase 5 — carrier credentials. Optional so existing dev/test envs without
  // them keep parsing; required wiring is enforced at the carrier-provider
  // boundary in Group F.
  ROYAL_MAIL_API_KEY: z.string().min(1).optional(),
  // Click & Drop service codes vary per merchant subscription tier — what
  // each account has access to is shown in their "Manual order entry"
  // postage dropdown. Defaults are informed guesses; override via
  // /etc/ynot/secrets.env without a code change once the operator confirms
  // their tier's actual codes.
  ROYAL_MAIL_SERVICE_CODE: z.string().min(1).default('TRN48'),
  ROYAL_MAIL_RETURNS_SERVICE_CODE: z.string().min(1).default('TRR48'),
  DHL_API_KEY: z.string().min(1).optional(),
  DHL_API_SECRET: z.string().min(1).optional(),
  DHL_ACCOUNT_NUMBER: z.string().min(1).optional(),
  // 'prod' (default) hits https://express.api.dhl.com/mydhlapi; 'test' hits the
  // /test sandbox so Customer Integration credentials work before Production
  // Access is granted at developer.dhl.com.
  DHL_API_ENV: z.enum(['prod', 'test']).default('prod'),
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_FROM: z.string().min(1).optional(), // accepts "Display Name <email>" Resend sender format
  // Reply-to header on every outbound. Sends are 'from' hello@ynotlondon.com
  // but customer replies route to the founder's inbox so we don't lose
  // mail until Cloudflare Email Routing is wired up.
  RESEND_REPLY_TO: z.string().min(1).default('zhansaya@ynotlondon.com'),
  // Phase 5 — label storage backend.
  LABEL_STORAGE: z.enum(['local', 's3', 'r2']).default('local'),
  LABEL_STORAGE_PATH: z.string().default('/var/lib/ynot/labels'),
  // Phase 5 — worker container toggle. Coerce string env to boolean: only the
  // literal string "false" disables; any other value (including undefined →
  // default "true") enables.
  WORKER_ENABLED: z.string().default('true').transform((v) => v !== 'false'),
  // Phase 5 — operational alerts (carrier failures, refund failures, etc.).
  ALERT_EMAIL: z.email().optional(),
  SEED_OWNER_EMAIL: z.email().optional(),
  SEED_OWNER_PASSWORD: z.string().min(8).optional(),
  // Phase 7a — media storage backend (product/CMS images). Mirrors Phase 5
  // LABEL_STORAGE: 'local' default writes to MEDIA_STORAGE_PATH; 's3'/'r2'
  // are placeholders for follow-on phases. MEDIA_PUBLIC_BASE_URL is optional;
  // when unset, public URLs default to NEXT_PUBLIC_SITE_URL + "/api/media".
  MEDIA_STORAGE: z.enum(['local', 's3', 'r2']).default('local'),
  MEDIA_STORAGE_PATH: z.string().default('/var/lib/ynot/media'),
  MEDIA_PUBLIC_BASE_URL: z.string().optional(),
  // Phase 8 — trader identifiers for the CN23 customs declaration on
  // international returns. Optional so dev/test envs without them keep
  // parsing; when unset the corresponding line is omitted from the PDF.
  YNOT_EORI: z.string().min(1).optional(),
  YNOT_VAT: z.string().min(1).optional(),
  YNOT_RETURNS_PHONE: z.string().min(1).optional(),
});

export type Env = z.infer<typeof EnvSchema>;
export type PartialEnv = Partial<Env>;

/**
 * Parse an arbitrary record (used by tests) — throws on invalid input.
 *
 * Phase 8: when `BUILD_PROD=1` is set, parse against a partial schema so the
 * Docker builder stage can run `next build` without production secrets. This
 * env var is only set inside the Dockerfile builder stage; runtime always
 * leaves it unset and gets the strict full-schema validation.
 */
export function parseEnv(input: Record<string, string | undefined>): Env | PartialEnv {
  return input.BUILD_PROD === "1"
    ? (EnvSchema.partial().parse(input) as PartialEnv)
    : EnvSchema.parse(input);
}

/**
 * Validated process.env. Importing this module fails fast on bad config.
 * Server-only — never import from `lib/` or any client component.
 *
 * The `as Env` cast is intentional: `BUILD_PROD=1` only happens during
 * `next build` inside Docker, never at runtime, so production runtime always
 * has the full validated env.
 */
export const env: Env = parseEnv(process.env as Record<string, string | undefined>) as Env;
