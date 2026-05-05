import { describe, expect, it } from "vitest";
import { parseEnv } from "../env";

describe("parseEnv", () => {
  const baseEnv = {
    DATABASE_URL: "postgresql://u:p@localhost:5432/db",
    REDIS_URL: "redis://localhost:6379",
    NODE_ENV: "development",
    NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
    NEXTAUTH_SECRET: "a-32-byte-base64-string-for-tests-12345",
    STRIPE_SECRET_KEY: "sk_test_stub_for_tests",
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_stub_for_tests",
    STRIPE_WEBHOOK_SECRET: "whsec_stub_for_tests",
    ORDER_TOKEN_SECRET: "test-order-token-secret-at-least-32-chars-long",
  };

  it("accepts a complete dev environment", () => {
    const env = parseEnv(baseEnv);
    expect(env.NODE_ENV).toBe("development");
    expect(env.DATABASE_URL).toBe("postgresql://u:p@localhost:5432/db");
  });

  it("rejects an invalid DATABASE_URL", () => {
    expect(() => parseEnv({ ...baseEnv, DATABASE_URL: "not-a-url" })).toThrow();
  });

  it("rejects an unknown NODE_ENV", () => {
    expect(() => parseEnv({ ...baseEnv, NODE_ENV: "staging" })).toThrow();
  });

  it("requires NEXTAUTH_SECRET", () => {
    const withoutSecret = { ...baseEnv };
    delete (withoutSecret as Record<string, unknown>).NEXTAUTH_SECRET;
    expect(() => parseEnv(withoutSecret)).toThrow();
  });

  it("rejects a too-short NEXTAUTH_SECRET", () => {
    expect(() => parseEnv({ ...baseEnv, NEXTAUTH_SECRET: "short" })).toThrow();
  });

  it("permits optional Resend credentials", () => {
    const env = parseEnv({
      ...baseEnv,
      RESEND_API_KEY: "re_xxxxxxxxxxxxxxxxxxxxxxxx",
      RESEND_FROM: "auth@ynot.london",
    });
    expect(env.RESEND_API_KEY).toBe("re_xxxxxxxxxxxxxxxxxxxxxxxx");
    expect(env.RESEND_FROM).toBe("auth@ynot.london");
  });

  it("permits optional seed credentials", () => {
    const env = parseEnv({
      ...baseEnv,
      SEED_OWNER_EMAIL: "owner@ynot.london",
      SEED_OWNER_PASSWORD: "longenough",
    });
    expect(env.SEED_OWNER_EMAIL).toBe("owner@ynot.london");
  });
});

describe("Phase 5 envs", () => {
  const baseEnv = {
    DATABASE_URL: "postgresql://x",
    REDIS_URL: "redis://x",
    NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
    NEXTAUTH_SECRET: "a".repeat(32),
    ORDER_TOKEN_SECRET: "b".repeat(32),
    STRIPE_SECRET_KEY: "sk_test_x",
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_x",
    STRIPE_WEBHOOK_SECRET: "whsec_x",
    ROYAL_MAIL_API_KEY: "rm-key",
    DHL_API_KEY: "dhl-key",
    DHL_API_SECRET: "dhl-secret",
    DHL_ACCOUNT_NUMBER: "230200799",
    RESEND_API_KEY: "re_x",
    RESEND_FROM: "YNOT <hello@ynotlondon.com>",
    ALERT_EMAIL: "alerts@ynotlondon.com",
    SHIPPING_PROVIDER: "mock",
  };

  it("parses ROYAL_MAIL_API_KEY, RESEND_*, LABEL_STORAGE, ALERT_EMAIL with defaults", () => {
    const env = parseEnv(baseEnv);
    expect(env.ROYAL_MAIL_API_KEY).toBe("rm-key");
    expect(env.LABEL_STORAGE).toBe("local");
    expect(env.LABEL_STORAGE_PATH).toBe("/var/lib/ynot/labels");
    expect(env.WORKER_ENABLED).toBe(true);
    expect(env.ALERT_EMAIL).toBe("alerts@ynotlondon.com");
    expect(env.RESEND_API_KEY).toBe("re_x");
    expect(env.RESEND_FROM).toBe("YNOT <hello@ynotlondon.com>");
    expect(env.DHL_API_KEY).toBe("dhl-key");
    expect(env.DHL_API_SECRET).toBe("dhl-secret");
    expect(env.DHL_ACCOUNT_NUMBER).toBe("230200799");
  });

  it("rejects invalid LABEL_STORAGE value", () => {
    expect(() => parseEnv({ ...baseEnv, LABEL_STORAGE: "azure" })).toThrow();
  });

  it("coerces WORKER_ENABLED='false' to boolean false", () => {
    const env = parseEnv({ ...baseEnv, WORKER_ENABLED: "false" });
    expect(env.WORKER_ENABLED).toBe(false);
  });

  it("coerces WORKER_ENABLED='true' (or anything else) to boolean true", () => {
    const env = parseEnv({ ...baseEnv, WORKER_ENABLED: "true" });
    expect(env.WORKER_ENABLED).toBe(true);
  });

  it("requires ALERT_EMAIL to be a valid email", () => {
    expect(() => parseEnv({ ...baseEnv, ALERT_EMAIL: "not-an-email" })).toThrow();
  });
});

describe("Phase 7a media envs", () => {
  const baseEnv = {
    DATABASE_URL: "postgresql://x",
    REDIS_URL: "redis://x",
    NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
    NEXTAUTH_SECRET: "a".repeat(32),
    ORDER_TOKEN_SECRET: "b".repeat(32),
    STRIPE_SECRET_KEY: "sk_test_x",
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_x",
    STRIPE_WEBHOOK_SECRET: "whsec_x",
    ALERT_EMAIL: "a@b.com",
    SHIPPING_PROVIDER: "mock",
  };

  it("parses MEDIA_STORAGE + MEDIA_STORAGE_PATH with defaults", () => {
    const env = parseEnv(baseEnv);
    expect(env.MEDIA_STORAGE).toBe("local");
    expect(env.MEDIA_STORAGE_PATH).toBe("/var/lib/ynot/media");
    expect(env.MEDIA_PUBLIC_BASE_URL).toBeUndefined();
  });

  it("rejects invalid MEDIA_STORAGE value", () => {
    const fn = () =>
      parseEnv({
        ...baseEnv,
        MEDIA_STORAGE: "azure",
      } as unknown as Record<string, string>);
    expect(fn).toThrow();
  });

  it("accepts overridden MEDIA_PUBLIC_BASE_URL", () => {
    const env = parseEnv({
      ...baseEnv,
      MEDIA_PUBLIC_BASE_URL: "https://media.ynotlondon.com",
    });
    expect(env.MEDIA_PUBLIC_BASE_URL).toBe("https://media.ynotlondon.com");
  });
});

describe("BUILD_PROD short-circuit", () => {
  it("parses partial env (missing required vars) when BUILD_PROD=1", () => {
    const minimal = { BUILD_PROD: "1" };
    expect(() => parseEnv(minimal)).not.toThrow();
    const e = parseEnv(minimal);
    // Required vars come back as undefined; defaults still apply
    expect(e.NEXT_PUBLIC_SITE_URL).toBeUndefined();
  });

  it("throws on missing required vars when BUILD_PROD is unset (existing behaviour)", () => {
    expect(() => parseEnv({})).toThrow();
  });
});
