# YNOT Backend Phase 8 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **NOTE:** Phase 8 mixes **code changes** (TDD-style) with **infrastructure / ops** (runbook-style). Tasks that touch code follow strict TDD. Tasks that run on the VPS or in third-party dashboards are sequential operator runbooks — no test exists for "did you click the right button in Stripe Dashboard." Each runbook task lists explicit verification commands.

**Goal:** Get `ynotlondon.com` live on production with TLS, automated CI/CD, monitoring, and backups, such that a real customer can place a Stripe Live order and receive shipment confirmation.

**Architecture:** Single AWS Lightsail VPS (London, $24/mo, already provisioned at `13.135.247.31`) runs Docker Compose stack: Caddy → Next.js app + worker + Postgres 16 + Redis 7. Caddy auto-obtains Let's Encrypt cert; Cloudflare proxies in front (Free plan, "Full (strict)" TLS, DDoS shield, free CDN). GitHub Actions builds multi-stage Docker images, pushes to `ghcr.io`, SSHs to VPS as `ynot` user, pulls images, runs `prisma migrate deploy`, restarts services with Compose-level zero-downtime. Production secrets live at `/etc/ynot/secrets.env` (root:600). Daily Postgres `pg_dump` + media `tar.czf` sync to Cloudflare R2 (free tier, 10 GB). Sentry catches errors; UptimeRobot pings homepage + `/api/health` every 5 min. Cutover is staged: bootstrap → first deploy on raw IP → Cloudflare proxy → GoDaddy NS swap to Cloudflare → Stripe Test mode smoke → Stripe Live cutover.

**Tech Stack:** Next.js 16 standalone output, Node.js 22 alpine Docker, Caddy 2, Postgres 16, Redis 7, GitHub Actions + ghcr.io, Cloudflare Free + R2, Sentry (`@sentry/nextjs`), UptimeRobot. Existing repo has `Dockerfile.worker` from Phase 5 + `docker-compose.yml` with stub `app:` service to be replaced.

**Spec:** `web/docs/superpowers/specs/2026-05-05-ynot-backend-phase-8-design.md`

**Existing artefacts at start:**
- AWS Lightsail VPS provisioned at `13.135.247.31` (London, Ubuntu 24.04.4 LTS, 2 vCPU, 4 GB RAM, 80 GB SSD)
- SSH access tested via `ssh ynot-prod` (PEM at `~/.ssh/ynot-prod.pem`, config in `~/.ssh/config`)
- $100 AWS Free Tier credit active until 2027-05-05
- GoDaddy domain `ynotlondon.com` registered, DNS still default GoDaddy parking
- Resend domain `ynotlondon.com` verified DKIM/SPF/MX
- DHL Express MyDHL API + Royal Mail Click & Drop API keys provisioned (Phase 5)
- All Phase 5 + 7a code merged to `main` (`25c9684`)

---

## File Structure

**New files:**

```
web/
├── Dockerfile                         ← multi-stage Next.js standalone build
├── docker-compose.prod.yml            ← prod-only override (env_file path, no published ports for postgres/redis)
├── caddy/
│   └── Caddyfile                      ← reverse proxy + Let's Encrypt config
├── docs/
│   └── deploy.md                      ← operator runbook
├── scripts/
│   ├── prod-bootstrap.sh              ← one-shot VPS init
│   ├── prod-backup-postgres.sh        ← nightly Postgres dump + R2 sync
│   ├── prod-backup-media.sh           ← nightly media tar + R2 sync
│   ├── prod-restore-postgres.sh       ← restore from R2
│   ├── env-prod-template.sh           ← prints expected secrets.env shape
│   └── prod-deploy-local.sh           ← manual fallback deploy if GH Actions broken
├── .github/
│   └── workflows/
│       ├── ci.yml                     ← PR pipeline (typecheck/lint/test/build)
│       └── deploy.yml                 ← main → ghcr.io → SSH → compose up
├── src/
│   ├── instrumentation.ts             ← MODIFIED: Sentry server init
│   └── instrumentation-client.ts      ← NEW: Sentry client init (Next.js 16 convention)
└── sentry.{server,edge,client}.config.ts ← NEW: Sentry config files
```

**Modified files:**

- `web/src/server/env.ts` — `BUILD_PROD=1` short-circuit
- `web/src/server/__tests__/env.test.ts` — covers BUILD_PROD path
- `web/src/app/api/health/route.ts` — extend `{ ok }` → `{ ok, db, redis, version }`
- `web/src/app/api/health/__tests__/route.test.ts` — assertions for new shape
- `web/docker-compose.yml` — replace `app:` + `nginx:` stubs with real Caddy + ghcr image refs; tighten postgres/redis port bindings in prod profile
- `web/Dockerfile.worker` — align with prod env handling (no major rewrite)
- `web/package.json` — adds `@sentry/nextjs` dep
- `web/.env.example` — adds Sentry + R2 + BUILD_PROD section
- `web/docs/manual-qa.md` — Phase 8 manual smoke section appended

---

## Conventions

**TDD where possible.** Tasks that change `env.ts`, `route.ts`, or shell scripts with testable logic follow strict TDD: failing test first → run → fail → implement → run → pass → commit.

**Runbook tasks** (those touching VPS, third-party dashboards, DNS, Stripe Dashboard) are sequential **operator instructions** — explicit commands and explicit verification. No test exists for "click button in CF Dashboard" but the verification step is concrete (e.g., `dig ns ynotlondon.com` shows Cloudflare NS).

**No worktree.** Phase 8 work happens on a feature branch directly off `main` because most artefacts are infrastructure (Docker, GH Actions, scripts) that don't conflict with Phase 7a-style worktree isolation needs. Single branch `feature/phase-8-production-launch`.

**One commit per task** unless the task explicitly bundles related changes.

**Working directory:** All `web/`-prefixed paths are relative to `/Users/batyrbekkuandyk/Desktop/ynot/web/`.

**SSH alias:** `ssh ynot-prod` works (configured in `~/.ssh/config` on the operator machine — added during instance provisioning).

**Branch:** `feature/phase-8-production-launch` off `main`. Push to origin after every group; squash-merge at the end.

---

## Task Index

**Group A — Local code changes (Tasks 1-9)** — TDD, runs in CI
**Group B — Dockerfile + Compose + Caddyfile (Tasks 10-14)** — code, builds locally
**Group C — Sentry integration (Tasks 15-17)** — code, builds locally
**Group D — Backup + restore scripts (Tasks 18-22)** — testable shell
**Group E — VPS bootstrap (Tasks 23-32)** — runbook, runs over SSH
**Group F — GitHub Actions CI + deploy (Tasks 33-38)** — code in repo, runs in GitHub
**Group G — First deploy on raw IP (Tasks 39-42)** — runbook, integration of code + ops
**Group H — Cloudflare setup (Tasks 43-46)** — runbook in CF Dashboard
**Group I — DNS migration (Tasks 47-49)** — runbook on GoDaddy
**Group J — Stripe Live cutover (Tasks 50-53)** — runbook in Stripe Dashboard + on VPS
**Group K — Final smoke + manual QA + Definition of Done (Tasks 54-56)**

Total: 56 tasks.

---

## Group A — Local Code Changes

### Task 1: Branch + check baseline

**Files:** none

- [ ] **Step 1: Create feature branch from main**

```bash
cd /Users/batyrbekkuandyk/Desktop/ynot/web
git status
git checkout main
git pull origin main
git checkout -b feature/phase-8-production-launch
```

- [ ] **Step 2: Verify baseline tests pass**

Run: `pnpm test 2>&1 | tail -3`
Expected: `Tests  950 passed (950)` (or equivalent post-Phase-7a baseline).

- [ ] **Step 3: No commit** (just setup).

---

### Task 2: Add `BUILD_PROD` short-circuit to env validator

**Files:**
- Modify: `web/src/server/env.ts`
- Modify: `web/src/server/__tests__/env.test.ts`

- [ ] **Step 1: Read current env.ts to find Zod schema location**

Run: `head -80 src/server/env.ts`
Note the structure — likely `export const env = z.object({...}).parse(process.env)`.

- [ ] **Step 2: Failing test**

Append to `web/src/server/__tests__/env.test.ts`:

```ts
describe('BUILD_PROD short-circuit', () => {
  it('parses partial env (missing required vars) when BUILD_PROD=1', () => {
    const minimal = { BUILD_PROD: '1' };
    expect(() => parseEnv(minimal)).not.toThrow();
    const e = parseEnv(minimal);
    // Required vars come back as undefined; defaults still apply
    expect(e.NEXT_PUBLIC_SITE_URL).toBeUndefined();
  });

  it('throws on missing required vars when BUILD_PROD is unset (existing behaviour)', () => {
    expect(() => parseEnv({})).toThrow();
  });
});
```

- [ ] **Step 3: Run — fail**

Run: `pnpm vitest run src/server/__tests__/env.test.ts -t "BUILD_PROD"`
Expected: FAIL — partial parse not allowed yet.

- [ ] **Step 4: Implement**

In `web/src/server/env.ts`, change the `parseEnv` function (or whatever name the file uses) so the final return becomes:

```ts
export function parseEnv(input: Record<string, string | undefined>) {
  const buildProd = input.BUILD_PROD === '1';
  return buildProd
    ? schema.partial().parse(input)
    : schema.parse(input);
}

export const env = parseEnv(process.env as Record<string, string | undefined>);
```

If the existing file already exports `env` directly without going through a named function, refactor:

```ts
const schema = z.object({ /* existing fields */ });

export type Env = z.output<typeof schema>;
export type PartialEnv = z.output<ReturnType<typeof schema.partial>>;

export function parseEnv(input: Record<string, string | undefined>): Env | PartialEnv {
  return input.BUILD_PROD === '1' ? schema.partial().parse(input) : schema.parse(input);
}

export const env = parseEnv(process.env as Record<string, string | undefined>) as Env;
```

The `as Env` cast at runtime is fine because `BUILD_PROD=1` only happens during `next build`, never at runtime — production runtime always has full env.

- [ ] **Step 5: Run — pass**

Run: `pnpm vitest run src/server/__tests__/env.test.ts`
Expected: all tests pass including new ones.

- [ ] **Step 6: Verify build now succeeds with BUILD_PROD=1**

Run: `BUILD_PROD=1 pnpm build 2>&1 | tail -10`
Expected: build completes without ZodError. Page-data collection no longer crashes.

- [ ] **Step 7: Commit**

```bash
git add src/server/env.ts src/server/__tests__/env.test.ts
git commit -m "feat(phase-8): BUILD_PROD short-circuit in env validator — unblocks Docker build"
```

---

### Task 3: Extend `/api/health` to return `{ db, redis, version }`

**Files:**
- Modify: `web/src/app/api/health/route.ts`
- Modify: `web/src/app/api/health/__tests__/route.test.ts`

- [ ] **Step 1: Read current route**

Run: `cat src/app/api/health/route.ts`
Likely returns `Response.json({ ok: true })`.

- [ ] **Step 2: Failing test**

Append to `web/src/app/api/health/__tests__/route.test.ts` (or create if missing):

```ts
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/server/db/client', () => ({
  prisma: { $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]) },
}));
vi.mock('@/server/redis', () => ({
  redis: { ping: vi.fn().mockResolvedValue('PONG') },
}));

import { GET } from '../route';

describe('GET /api/health', () => {
  it('returns ok+db+redis+version on success', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.db).toBe('up');
    expect(body.redis).toBe('up');
    expect(typeof body.version).toBe('string');
  });

  it('returns 503 when db is down', async () => {
    const { prisma } = await import('@/server/db/client');
    (prisma.$queryRaw as any).mockRejectedValueOnce(new Error('connection refused'));
    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.db).toBe('down');
  });
});
```

If the existing test file has different mock paths, adjust to match this codebase's actual import paths (`@/server/db/client` is the standard from prior phases; if `@/server/redis` import path differs, find with `rg "redis" src/server/ -l | head`).

- [ ] **Step 3: Run — fail**

Run: `pnpm vitest run src/app/api/health/__tests__/route.test.ts`
Expected: FAIL — route returns only `{ ok }`.

- [ ] **Step 4: Implement**

Replace `src/app/api/health/route.ts`:

```ts
import { prisma } from '@/server/db/client';
import { redis } from '@/server/redis';

const VERSION = process.env.GIT_SHA ?? process.env.IMAGE_TAG ?? 'dev';

export async function GET(): Promise<Response> {
  const checks: { db: 'up' | 'down'; redis: 'up' | 'down' } = { db: 'down', redis: 'down' };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.db = 'up';
  } catch {}

  try {
    const pong = await redis.ping();
    if (pong === 'PONG') checks.redis = 'up';
  } catch {}

  const allUp = checks.db === 'up' && checks.redis === 'up';
  return Response.json(
    { ok: allUp, db: checks.db, redis: checks.redis, version: VERSION },
    { status: allUp ? 200 : 503 },
  );
}
```

- [ ] **Step 5: Run — pass**

Run: `pnpm vitest run src/app/api/health/__tests__/route.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/health/route.ts src/app/api/health/__tests__/route.test.ts
git commit -m "feat(phase-8): /api/health returns db/redis/version for liveness probe"
```

---

### Task 4: Document `BUILD_PROD` env in .env.example

**Files:**
- Modify: `web/.env.example`

- [ ] **Step 1: Append section**

Append to `web/.env.example`:

```env

# ---- Build-time only (Phase 8) ----
# Set to 1 ONLY during Docker build (Dockerfile builder stage). At runtime, leave unset
# so env validation runs strict and fails fast on missing prod secrets.
# BUILD_PROD=1
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "docs(phase-8): document BUILD_PROD build-time-only env"
```

---

### Task 5: Add `@sentry/nextjs` dep

**Files:**
- Modify: `web/package.json`

- [ ] **Step 1: Install**

```bash
pnpm add @sentry/nextjs
```

- [ ] **Step 2: Verify version**

Run: `pnpm list @sentry/nextjs | head -3`
Expected: `@sentry/nextjs ^9.x` (or current stable).

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(phase-8): add @sentry/nextjs for error monitoring"
```

---

### Task 6: Sentry config files

**Files:**
- Create: `web/sentry.client.config.ts`
- Create: `web/sentry.server.config.ts`
- Create: `web/sentry.edge.config.ts`

- [ ] **Step 1: Create `sentry.client.config.ts`**

```ts
import * as Sentry from '@sentry/nextjs';

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
    environment: process.env.NODE_ENV,
    enabled: process.env.NODE_ENV === 'production',
  });
}
```

- [ ] **Step 2: Create `sentry.server.config.ts`**

```ts
import * as Sentry from '@sentry/nextjs';

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0.1,
    environment: process.env.NODE_ENV,
    enabled: process.env.NODE_ENV === 'production',
  });
}
```

- [ ] **Step 3: Create `sentry.edge.config.ts`**

```ts
import * as Sentry from '@sentry/nextjs';

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0.1,
    environment: process.env.NODE_ENV,
    enabled: process.env.NODE_ENV === 'production',
  });
}
```

- [ ] **Step 4: Commit**

```bash
git add sentry.client.config.ts sentry.server.config.ts sentry.edge.config.ts
git commit -m "feat(phase-8): Sentry init configs for client/server/edge runtimes"
```

---

### Task 7: Wire Sentry into Next.js via `instrumentation.ts`

**Files:**
- Create or modify: `web/src/instrumentation.ts`
- Create: `web/src/instrumentation-client.ts`

- [ ] **Step 1: Check if `instrumentation.ts` already exists**

Run: `ls src/instrumentation.ts 2>&1`

If it exists (Phase 5 may have added it), the new content extends rather than replaces.

- [ ] **Step 2: Write `src/instrumentation.ts`**

```ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}
```

If the file existed and had non-Sentry logic (e.g., worker init from Phase 5), preserve it and add the Sentry imports inside the existing `register` function.

- [ ] **Step 3: Write `src/instrumentation-client.ts`**

```ts
import '../sentry.client.config';
```

(Next.js 16 convention: `instrumentation-client.ts` runs once on first client-side hydration.)

- [ ] **Step 4: Verify typecheck still clean**

Run: `pnpm typecheck 2>&1 | tail -5`
Expected: same baseline as before (no new errors).

- [ ] **Step 5: Commit**

```bash
git add src/instrumentation.ts src/instrumentation-client.ts
git commit -m "feat(phase-8): wire Sentry into Next.js instrumentation"
```

---

### Task 8: Add Sentry-related vars to .env.example

**Files:**
- Modify: `web/.env.example`

- [ ] **Step 1: Append**

```env

# ---- Sentry (Phase 8 — error monitoring) ----
SENTRY_DSN="https://...@o000000.ingest.sentry.io/000000"
NEXT_PUBLIC_SENTRY_DSN="https://...@o000000.ingest.sentry.io/000000"
# Used by GitHub Actions to upload source maps; only needed in CI
# SENTRY_AUTH_TOKEN=...
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "docs(phase-8): document Sentry envs"
```

---

### Task 9: Add R2 backup envs to .env.example

**Files:**
- Modify: `web/.env.example`

- [ ] **Step 1: Append**

```env

# ---- Cloudflare R2 (Phase 8 — backups destination) ----
R2_ENDPOINT="https://<accountid>.r2.cloudflarestorage.com"
R2_ACCESS_KEY_ID=""
R2_SECRET_ACCESS_KEY=""
R2_BUCKET="ynot-backups"
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "docs(phase-8): document Cloudflare R2 backup envs"
```

---

## Group B — Dockerfile + Compose + Caddyfile

### Task 10: Multi-stage Dockerfile for Next.js standalone

**Files:**
- Create: `web/Dockerfile`

- [ ] **Step 1: Create the file**

```dockerfile
# syntax=docker/dockerfile:1.7
# Phase 8 — multi-stage Next.js standalone build.

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# ---- deps stage: install all dependencies ----
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

# ---- builder stage: compile + Next.js standalone output ----
FROM deps AS builder
COPY . .
ENV BUILD_PROD=1
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm prisma generate
RUN pnpm build

# ---- runner stage: only what runtime needs ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache curl

# Copy Next.js standalone artefacts
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Prisma client + generated artefacts (Next.js standalone bundles most but not Prisma)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -fsSL http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
```

- [ ] **Step 2: Verify Next.js standalone output is enabled**

Check `web/next.config.ts` (or `.js`) for `output: 'standalone'`. If missing, add:

```ts
const nextConfig: NextConfig = {
  output: 'standalone',
  // ...existing config...
};
```

If it was missing, this also needs a commit.

- [ ] **Step 3: Test build locally**

```bash
docker build -t ynot-app:dev -f Dockerfile .
```

Expected: completes within ~5-10 min on first build (subsequent ones use layer cache). Final image listed via `docker images ynot-app`.

If it fails on the `pnpm build` step due to env validation, that confirms `BUILD_PROD=1` isn't being set or `env.ts` patch from Task 2 isn't working — revisit.

- [ ] **Step 4: Verify image runs**

```bash
docker run --rm -p 3001:3000 \
  -e DATABASE_URL=postgresql://x \
  -e NEXTAUTH_SECRET=$(openssl rand -base64 32) \
  -e NEXT_PUBLIC_SITE_URL=http://localhost:3001 \
  -e ORDER_TOKEN_SECRET=$(openssl rand -base64 32) \
  -e STRIPE_SECRET_KEY=sk_test_x \
  -e NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_x \
  -e STRIPE_WEBHOOK_SECRET=whsec_x \
  -e ALERT_EMAIL=a@b.com \
  -e SHIPPING_PROVIDER=mock \
  ynot-app:dev &
sleep 8
curl -fsSL http://localhost:3001/api/health
docker stop $(docker ps -q --filter ancestor=ynot-app:dev)
```

Expected: `/api/health` returns JSON with `ok: false` (because `db: 'down'` — no Postgres running) but the route itself responds. That's enough — proves the image boots.

- [ ] **Step 5: Commit**

```bash
git add Dockerfile next.config.ts  # only include next.config if you modified it
git commit -m "feat(phase-8): multi-stage Dockerfile for Next.js standalone production image"
```

---

### Task 11: Create Caddyfile

**Files:**
- Create: `web/caddy/Caddyfile`

- [ ] **Step 1: Create file**

```
{
    email hello@ynotlondon.com
    # Use Cloudflare's resolvers for DNS-01 challenges if needed; HTTP-01 default works.
}

ynotlondon.com {
    encode gzip zstd

    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options nosniff
        Referrer-Policy strict-origin-when-cross-origin
        Permissions-Policy "geolocation=(), microphone=(), camera=()"
        -Server
    }

    reverse_proxy app:3000 {
        health_uri /api/health
        health_interval 30s
        health_timeout 5s
    }
}

www.ynotlondon.com {
    redir https://ynotlondon.com{uri} permanent
}
```

- [ ] **Step 2: Validate Caddyfile syntax**

```bash
docker run --rm -v $(pwd)/caddy/Caddyfile:/etc/caddy/Caddyfile:ro caddy:2-alpine \
  caddy validate --config /etc/caddy/Caddyfile
```

Expected: `Valid configuration`.

- [ ] **Step 3: Commit**

```bash
git add caddy/Caddyfile
git commit -m "feat(phase-8): Caddyfile — auto-TLS reverse proxy for ynotlondon.com"
```

---

### Task 12: Production-only docker-compose override

**Files:**
- Create: `web/docker-compose.prod.yml`

- [ ] **Step 1: Create file**

```yaml
# Phase 8 — production overrides applied via:
#   docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile prod up -d
#
# Differences from base docker-compose.yml:
# - postgres + redis: no host port binding (only internal Docker network)
# - app + worker: pull from ghcr.io instead of stub
# - caddy: real image with Caddyfile mount instead of nginx stub
# - env_file points at /etc/ynot/secrets.env (root:600 on host)

name: ynot

services:
  postgres:
    ports: !reset []
    environment:
      POSTGRES_USER: ynot
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ynot_prod

  redis:
    ports: !reset []

  app:
    image: ghcr.io/batrbekk/ynot-app:${IMAGE_TAG:-latest}
    profiles: ["prod"]
    container_name: ynot-app
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    env_file:
      - /etc/ynot/secrets.env
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://ynot:${POSTGRES_PASSWORD}@postgres:5432/ynot_prod?schema=public
      REDIS_URL: redis://redis:6379
      GIT_SHA: ${IMAGE_TAG:-unknown}
    volumes:
      - ynot-media:/var/lib/ynot/media
      - ynot-labels:/var/lib/ynot/labels
    healthcheck:
      test: ["CMD", "curl", "-fsSL", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 15s
    # No published ports — Caddy reaches it via Docker DNS (app:3000)
    expose:
      - "3000"

  ynot-worker:
    image: ghcr.io/batrbekk/ynot-worker:${IMAGE_TAG:-latest}

  caddy:
    image: caddy:2-alpine
    profiles: ["prod"]
    container_name: ynot-caddy
    restart: unless-stopped
    depends_on:
      app:
        condition: service_healthy
    ports:
      - "80:80"
      - "443:443"
      - "443:443/udp"  # HTTP/3
    volumes:
      - ./caddy/Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config

  nginx: !reset null

volumes:
  caddy_data:
  caddy_config:
```

> Note: `!reset` is Compose 2.20+ syntax to clear a parent value. `nginx: !reset null` removes the Phase 5 stub service entirely in prod. Verify your local Compose version supports it: `docker compose version` — needs ≥ 2.20.

- [ ] **Step 2: Validate Compose merge**

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml config 2>&1 | head -40
```

Expected: rendered config shows postgres+redis without host port bindings, app and worker pulling from ghcr.io, caddy with Caddyfile mount, nginx absent.

- [ ] **Step 3: Update parent `docker-compose.yml`**

The Phase 5 `docker-compose.yml` has stub `app:` and `nginx:` services. The Compose merge above uses `!reset` to override them. But to be clean, also remove the `command: sleep infinity` in the parent file's `app:` and let the prod override fully define it. **Don't** delete the parent stubs — they document what dev mode does. Just ensure they don't have published ports (security).

Open `docker-compose.yml` and confirm the parent `app:` service has no `command: sleep infinity` once Phase 8 lands. Replace its body with a comment "Defined via docker-compose.prod.yml in production".

If the parent file changes, include in this commit.

- [ ] **Step 4: Commit**

```bash
git add docker-compose.prod.yml docker-compose.yml
git commit -m "feat(phase-8): docker-compose.prod.yml — Caddy + ghcr images + tightened ports"
```

---

### Task 13: Update root docker-compose.yml — remove nginx stub, tighten dev port bindings

**Files:**
- Modify: `web/docker-compose.yml`

- [ ] **Step 1: Read current state**

```bash
grep -n "ports:\|profiles:\|nginx" docker-compose.yml | head -20
```

- [ ] **Step 2: Apply targeted changes**

In the parent `docker-compose.yml`:

- `postgres:` ports stay `5432:5432` only when `dev` profile is active (the stanza is shared today). Phase 8's prod-override `!reset []` covers prod. No change needed in parent file beyond ensuring no `nginx:` block remains as a sleep-infinity stub. If it has `command: sleep infinity ...`, change to:

```yaml
  nginx:
    image: nginx:1.27-alpine
    profiles: ["__never__"]
    # Removed in Phase 8 — Caddy replaces nginx (see docker-compose.prod.yml).
```

The `__never__` profile means it never runs unless explicitly named. Cleaner than deleting since git history reads better.

Same for `app:` — change profile to `__never__` and add comment:

```yaml
  app:
    image: node:22-alpine
    profiles: ["__never__"]
    # Replaced in Phase 8 by ghcr.io image — see docker-compose.prod.yml.
```

- [ ] **Step 3: Verify dev compose still works**

```bash
docker compose --profile dev up -d postgres redis
docker compose --profile dev ps
```

Expected: postgres + redis up; no nginx; no app stub.

```bash
docker compose --profile dev down
```

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml
git commit -m "refactor(phase-8): retire nginx + app sleep-infinity stubs from base compose"
```

---

### Task 14: Local end-to-end test — full Compose stack with Caddy

**Files:** none (verification)

- [ ] **Step 1: Build images locally**

```bash
docker build -t ghcr.io/batrbekk/ynot-app:local -f Dockerfile .
docker build -t ghcr.io/batrbekk/ynot-worker:local -f Dockerfile.worker .
```

- [ ] **Step 2: Tag for compose**

```bash
docker tag ghcr.io/batrbekk/ynot-app:local ghcr.io/batrbekk/ynot-app:latest
docker tag ghcr.io/batrbekk/ynot-worker:local ghcr.io/batrbekk/ynot-worker:latest
```

- [ ] **Step 3: Create stub `/etc/ynot/secrets.env` locally**

```bash
sudo mkdir -p /etc/ynot
sudo tee /etc/ynot/secrets.env > /dev/null <<EOF
NEXTAUTH_SECRET=$(openssl rand -base64 32)
ORDER_TOKEN_SECRET=$(openssl rand -base64 32)
POSTGRES_PASSWORD=local_pg_password_for_test
DATABASE_URL=postgresql://ynot:local_pg_password_for_test@postgres:5432/ynot_prod?schema=public
REDIS_URL=redis://redis:6379
STRIPE_SECRET_KEY=sk_test_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
ROYAL_MAIL_API_KEY=xxx
DHL_API_KEY=xxx
DHL_API_SECRET=xxx
DHL_ACCOUNT_NUMBER=230200799
RESEND_API_KEY=re_xxx
RESEND_FROM=hello@ynotlondon.com
LABEL_STORAGE=local
LABEL_STORAGE_PATH=/var/lib/ynot/labels
MEDIA_STORAGE=local
MEDIA_STORAGE_PATH=/var/lib/ynot/media
MEDIA_PUBLIC_BASE_URL=http://localhost/api/media
WORKER_ENABLED=true
ALERT_EMAIL=a@b.com
NEXT_PUBLIC_SITE_URL=http://localhost
SHIPPING_PROVIDER=mock
EOF
sudo chmod 600 /etc/ynot/secrets.env
```

- [ ] **Step 4: Run stack**

```bash
export POSTGRES_PASSWORD=local_pg_password_for_test
export IMAGE_TAG=latest
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile prod up -d
sleep 30
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile prod ps
```

Expected: postgres healthy, redis healthy, ynot-app healthy, ynot-worker running, ynot-caddy running.

- [ ] **Step 5: Run migrations on the running app container**

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile prod \
  exec app pnpm prisma migrate deploy
```

Expected: "All migrations have been successfully applied" or similar.

> Note: this requires `pnpm` in the runner image. The `Dockerfile` runner stage is minimalist — `pnpm` may not be there. **Workaround:** Run via a one-off `node` invocation:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile prod \
  run --rm app sh -c "npx prisma migrate deploy"
```

If neither works, that's a Dockerfile gap — add `pnpm install --frozen-lockfile --prod` to runner stage just for the prisma CLI bin OR copy `node_modules/prisma` from builder stage.

- [ ] **Step 6: Hit `/api/health` via Caddy on port 80**

```bash
curl -fsSL --max-time 10 http://localhost/api/health
```

Expected: JSON `{"ok": true, "db": "up", "redis": "up", "version": "latest"}`.

- [ ] **Step 7: Cleanup**

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile prod down
sudo rm -f /etc/ynot/secrets.env
```

- [ ] **Step 8: No commit** (verification only). If Dockerfile or compose file needed adjustments to make Step 5 work, those go into Tasks 10/12 (revisit before continuing).

---

## Group C — Sentry Integration (verified)

### Task 15: Verify Sentry config files compile

**Files:** none (typecheck only)

- [ ] **Step 1: Run typecheck**

Run: `pnpm typecheck 2>&1 | grep -E "sentry|instrumentation" | head -10`
Expected: no Sentry-related errors. Pre-existing 4 PNG-import errors stay.

- [ ] **Step 2: Run tests**

Run: `pnpm test 2>&1 | tail -3`
Expected: same baseline (~950 tests passing — Sentry init is no-op when `NODE_ENV !== 'production'`).

- [ ] **Step 3: No commit** (verification).

---

### Task 16: Add Sentry source-map upload to Dockerfile

**Files:**
- Modify: `web/Dockerfile`

- [ ] **Step 1: Add SENTRY_AUTH_TOKEN ARG/ENV in builder stage**

Modify the builder stage of the Dockerfile to look like:

```dockerfile
FROM deps AS builder
COPY . .
ENV BUILD_PROD=1
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ARG SENTRY_AUTH_TOKEN=""
ENV SENTRY_AUTH_TOKEN=${SENTRY_AUTH_TOKEN}
RUN pnpm prisma generate
RUN pnpm build
```

`@sentry/nextjs` automatically uploads source maps if `SENTRY_AUTH_TOKEN` is set during build. We pass it via `--build-arg` from GitHub Actions (Task 35).

- [ ] **Step 2: Test build still works without the token**

```bash
docker build -t ynot-app:dev -f Dockerfile .
```

Expected: succeeds, just doesn't upload source maps (since token is empty). No errors.

- [ ] **Step 3: Commit**

```bash
git add Dockerfile
git commit -m "feat(phase-8): wire SENTRY_AUTH_TOKEN build-arg into Dockerfile builder stage"
```

---

### Task 17: Document Sentry runbook in deploy.md (placeholder file)

**Files:**
- Create: `web/docs/deploy.md` (initial skeleton; expanded in Task 56)

- [ ] **Step 1: Write skeleton**

```markdown
# YNOT Production Deploy Runbook

## Sentry setup

1. Create Sentry account: https://sentry.io/signup/ (free tier, 5k events/month)
2. Create project → "Next.js" platform → name `ynot-london`
3. Copy DSN from Project Settings → Client Keys (DSN); paste into `/etc/ynot/secrets.env`:
   - `SENTRY_DSN=...`
   - `NEXT_PUBLIC_SENTRY_DSN=...`
4. Create auth token: Settings → Account → Auth Tokens → New (scope `project:write`)
5. Add to GitHub repo Secrets as `SENTRY_AUTH_TOKEN` (used by deploy workflow for source maps)

## UptimeRobot setup

1. Create UptimeRobot account: https://uptimerobot.com/signUp (free tier, 50 monitors)
2. Create monitor: HTTP(S), URL `https://ynotlondon.com`, interval 5 min
3. Create monitor: HTTP(S), URL `https://ynotlondon.com/api/health`, interval 5 min, alert when status code != 200
4. Add alert contact: email `alerts@ynotlondon.com`

(Full runbook expanded in later tasks — bootstrap, deploy, rollback, restore.)
```

- [ ] **Step 2: Commit**

```bash
git add docs/deploy.md
git commit -m "docs(phase-8): start deploy runbook with Sentry + UptimeRobot setup"
```

---

## Group D — Backup + Restore Scripts

### Task 18: AWS CLI compatibility for R2

**Files:** none (verification + design choice)

R2 is S3-compatible, so the standard `aws` CLI works against it via `--endpoint-url`. The worker image needs `aws-cli` installed for backup scripts.

- [ ] **Step 1: Add `aws-cli` to Dockerfile.worker**

Modify `web/Dockerfile.worker`:

```dockerfile
FROM node:22-alpine
RUN apk add --no-cache curl bash aws-cli
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile
RUN pnpm prisma generate
COPY . .
ENV NODE_ENV=production
CMD ["pnpm", "tsx", "src/worker/index.ts"]
```

Plus install `postgresql-client` for `pg_dump` access:

```dockerfile
RUN apk add --no-cache curl bash aws-cli postgresql16-client
```

- [ ] **Step 2: Test build**

```bash
docker build -t ynot-worker:dev -f Dockerfile.worker .
docker run --rm ynot-worker:dev sh -c "aws --version && pg_dump --version"
```

Expected: both print versions.

- [ ] **Step 3: Commit**

```bash
git add Dockerfile.worker
git commit -m "feat(phase-8): add aws-cli + postgresql-client to worker image for backups"
```

---

### Task 19: prod-backup-postgres.sh

**Files:**
- Create: `web/scripts/prod-backup-postgres.sh`

- [ ] **Step 1: Write script**

```bash
#!/usr/bin/env bash
# Phase 8 — daily Postgres backup → /var/backups + Cloudflare R2
# Runs inside ynot-worker container at 03:00 UTC via node-cron.
set -euo pipefail

DATE=$(date -u +%F)
BACKUP_DIR="/var/backups/ynot/postgres"
DUMP_FILE="${BACKUP_DIR}/${DATE}.dump"

mkdir -p "$BACKUP_DIR"

# Use DATABASE_URL (already in env) so we don't duplicate creds
export PGPASSWORD=$(echo "$DATABASE_URL" | sed -E 's|.*://[^:]+:([^@]+)@.*|\1|')
PGUSER=$(echo "$DATABASE_URL" | sed -E 's|.*://([^:]+):.*|\1|')
PGHOST=$(echo "$DATABASE_URL" | sed -E 's|.*@([^:/]+).*|\1|')
PGDB=$(echo "$DATABASE_URL" | sed -E 's|.*/([^?]+)(\?.*)?|\1|')

pg_dump -h "$PGHOST" -U "$PGUSER" -F custom -f "$DUMP_FILE" "$PGDB"
gzip -9 "$DUMP_FILE"
DUMP_FILE_GZ="${DUMP_FILE}.gz"

# Upload to R2 (S3-compatible)
aws s3 cp "$DUMP_FILE_GZ" "s3://${R2_BUCKET}/postgres/${DATE}.dump.gz" \
  --endpoint-url "$R2_ENDPOINT" \
  --no-progress

# Local retention: keep last 30 days
find "$BACKUP_DIR" -name '*.dump.gz' -mtime +30 -delete

echo "[backup-postgres] OK ${DATE}"
```

- [ ] **Step 2: Make executable**

```bash
chmod +x scripts/prod-backup-postgres.sh
```

- [ ] **Step 3: Commit**

```bash
git add scripts/prod-backup-postgres.sh
git commit -m "feat(phase-8): nightly Postgres backup script — pg_dump + gzip + R2 sync"
```

---

### Task 20: prod-backup-media.sh

**Files:**
- Create: `web/scripts/prod-backup-media.sh`

- [ ] **Step 1: Write script**

```bash
#!/usr/bin/env bash
# Phase 8 — daily media + labels backup → R2
set -euo pipefail

DATE=$(date -u +%F)
BACKUP_DIR="/var/backups/ynot/media"
TAR_FILE="${BACKUP_DIR}/${DATE}.tar.gz"

mkdir -p "$BACKUP_DIR"

# Tar product images + label PDFs together (small total volume early on)
tar -czf "$TAR_FILE" \
  -C /var/lib/ynot media labels 2>/dev/null || true

aws s3 cp "$TAR_FILE" "s3://${R2_BUCKET}/media/${DATE}.tar.gz" \
  --endpoint-url "$R2_ENDPOINT" \
  --no-progress

find "$BACKUP_DIR" -name '*.tar.gz' -mtime +14 -delete

echo "[backup-media] OK ${DATE}"
```

- [ ] **Step 2: chmod + commit**

```bash
chmod +x scripts/prod-backup-media.sh
git add scripts/prod-backup-media.sh
git commit -m "feat(phase-8): nightly media + labels backup script — tar + R2 sync"
```

---

### Task 21: prod-restore-postgres.sh

**Files:**
- Create: `web/scripts/prod-restore-postgres.sh`

- [ ] **Step 1: Write script**

```bash
#!/usr/bin/env bash
# Phase 8 — restore Postgres from a R2 dump.
# Usage: ./scripts/prod-restore-postgres.sh 2026-05-04
set -euo pipefail

if [[ -z "${1:-}" ]]; then
  echo "Usage: $0 YYYY-MM-DD" >&2
  exit 1
fi

DATE="$1"
TMP="/tmp/ynot-restore-${DATE}"
mkdir -p "$TMP"
DUMP_GZ="${TMP}/${DATE}.dump.gz"

aws s3 cp "s3://${R2_BUCKET}/postgres/${DATE}.dump.gz" "$DUMP_GZ" \
  --endpoint-url "$R2_ENDPOINT" \
  --no-progress

gunzip -f "$DUMP_GZ"
DUMP="${TMP}/${DATE}.dump"

export PGPASSWORD=$(echo "$DATABASE_URL" | sed -E 's|.*://[^:]+:([^@]+)@.*|\1|')
PGUSER=$(echo "$DATABASE_URL" | sed -E 's|.*://([^:]+):.*|\1|')
PGHOST=$(echo "$DATABASE_URL" | sed -E 's|.*@([^:/]+).*|\1|')
PGDB=$(echo "$DATABASE_URL" | sed -E 's|.*/([^?]+)(\?.*)?|\1|')

echo "[restore] About to restore ${DATE} into ${PGDB}@${PGHOST}. Existing data will be dropped."
read -p "Type 'yes' to proceed: " confirm
if [[ "$confirm" != "yes" ]]; then
  echo "[restore] Aborted."
  exit 1
fi

pg_restore -h "$PGHOST" -U "$PGUSER" -d "$PGDB" --clean --if-exists "$DUMP"

rm -rf "$TMP"
echo "[restore] OK ${DATE}"
```

- [ ] **Step 2: chmod + commit**

```bash
chmod +x scripts/prod-restore-postgres.sh
git add scripts/prod-restore-postgres.sh
git commit -m "feat(phase-8): Postgres restore-from-R2 script with confirm prompt"
```

---

### Task 22: Worker — schedule the backup scripts

**Files:**
- Modify: `web/src/worker/index.ts`

- [ ] **Step 1: Read current worker registrations**

Run: `cat src/worker/index.ts | head -30`
Phase 5 cron schedules are already wired.

- [ ] **Step 2: Add two new cron schedules**

In `src/worker/index.ts`, after existing `cron.schedule(...)` calls, append:

```ts
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
const execp = promisify(exec);

// Phase 8 — daily backups (only run in production)
if (process.env.NODE_ENV === 'production') {
  cron.schedule('0 3 * * *', async () => {
    try {
      const { stdout, stderr } = await execp('/app/scripts/prod-backup-postgres.sh');
      console.log(stdout);
      if (stderr) console.error(stderr);
    } catch (e) {
      console.error('[worker] postgres backup failed:', e);
    }
  });

  cron.schedule('30 3 * * *', async () => {
    try {
      const { stdout, stderr } = await execp('/app/scripts/prod-backup-media.sh');
      console.log(stdout);
      if (stderr) console.error(stderr);
    } catch (e) {
      console.error('[worker] media backup failed:', e);
    }
  });

  console.log('[ynot-worker] backup schedules registered (postgres 03:00 UTC, media 03:30 UTC)');
}
```

- [ ] **Step 3: Test worker boots without error**

```bash
WORKER_ENABLED=true NODE_ENV=development pnpm tsx src/worker/index.ts &
sleep 3
kill %1
```

Expected: standard worker boot logs, no crash. Backup schedules NOT logged (because `NODE_ENV !== 'production'`).

- [ ] **Step 4: Commit**

```bash
git add src/worker/index.ts
git commit -m "feat(phase-8): worker schedules nightly Postgres + media backups in prod"
```

---

## Group E — VPS Bootstrap

> **All Group E tasks run over `ssh ynot-prod`. They're sequential ops; verification is by command output.**

### Task 23: Initial server hardening — apt update, fail2ban, ufw

**Files:** none (runs on VPS)

- [ ] **Step 1: SSH in**

```bash
ssh ynot-prod
```

- [ ] **Step 2: Update + install hardening tools**

On VPS:

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y fail2ban ufw curl ca-certificates gnupg
```

- [ ] **Step 3: Configure ufw**

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
echo "y" | sudo ufw enable
sudo ufw status verbose
```

Expected: ufw active, allowing 22/80/443/tcp.

- [ ] **Step 4: Enable + start fail2ban**

```bash
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
sudo fail2ban-client status
```

Expected: `Status: ... Number of jail: 1 ... sshd`

- [ ] **Step 5: Verify still SSH-able**

Open a new terminal locally; try `ssh ynot-prod 'echo still up'`. Expected: success.

- [ ] **Step 6: Run journal to confirm no errors**

```bash
sudo journalctl -u fail2ban -n 20 --no-pager
```

Expected: no errors.

---

### Task 24: Install Docker + docker compose plugin

**Files:** none

- [ ] **Step 1: SSH and run official Docker install**

```bash
ssh ynot-prod
curl -fsSL https://get.docker.com | sudo sh
```

- [ ] **Step 2: Verify**

```bash
sudo docker --version
sudo docker compose version
```

Expected: Docker >= 27, Compose >= 2.20.

- [ ] **Step 3: Test docker works**

```bash
sudo docker run --rm hello-world
```

Expected: "Hello from Docker!" message.

---

### Task 25: Create `ynot` deploy user

**Files:** none

- [ ] **Step 1: Create user**

```bash
ssh ynot-prod
sudo adduser --disabled-password --gecos "" ynot
sudo usermod -aG docker ynot
sudo mkdir -p /home/ynot/.ssh
sudo cp ~/.ssh/authorized_keys /home/ynot/.ssh/  # initial: same key as ubuntu
sudo chown -R ynot:ynot /home/ynot/.ssh
sudo chmod 700 /home/ynot/.ssh
sudo chmod 600 /home/ynot/.ssh/authorized_keys
```

- [ ] **Step 2: Verify SSH as ynot from local machine**

Locally:

```bash
ssh ynot@13.135.247.31 "whoami && groups"
```

Expected: `ynot` and `ynot docker`.

- [ ] **Step 3: Update local SSH config**

In `~/.ssh/config`, change `User ubuntu` → `User ynot` for the `ynot-prod` host. Test:

```bash
ssh ynot-prod whoami
```

Expected: `ynot`.

- [ ] **Step 4: Verify ynot can run docker**

```bash
ssh ynot-prod "docker ps"
```

Expected: empty list (no containers yet) — but no permission error.

---

### Task 26: Create deploy SSH key for GitHub Actions

**Files:** none (key material captured for GH Secrets)

- [ ] **Step 1: Generate key locally (NOT on VPS)**

```bash
ssh-keygen -t ed25519 -f ~/.ssh/ynot-deploy -N "" -C "github-actions-deploy@ynot"
```

Creates `~/.ssh/ynot-deploy` (private) and `~/.ssh/ynot-deploy.pub` (public).

- [ ] **Step 2: Push public key to VPS `ynot` user**

```bash
cat ~/.ssh/ynot-deploy.pub | ssh ynot-prod "cat >> /home/ynot/.ssh/authorized_keys"
```

- [ ] **Step 3: Verify the deploy key works**

```bash
ssh -i ~/.ssh/ynot-deploy ynot@13.135.247.31 "whoami"
```

Expected: `ynot`.

- [ ] **Step 4: Print private key contents for GH Secrets**

```bash
cat ~/.ssh/ynot-deploy
```

Copy entire output (including `-----BEGIN OPENSSH PRIVATE KEY-----` to `-----END OPENSSH PRIVATE KEY-----`). Paste into GitHub repo `Settings → Secrets and variables → Actions → New repository secret`:
- Name: `SSH_PRIVATE_KEY`
- Value: paste private key content

Also add:
- `SSH_HOST` = `13.135.247.31`
- `SSH_USER` = `ynot`

> Don't commit the private key to git or memory.

---

### Task 27: Create deploy directory structure

**Files:** none

- [ ] **Step 1: SSH in**

```bash
ssh ynot-prod
```

- [ ] **Step 2: Create dirs**

```bash
sudo mkdir -p /srv/ynot
sudo chown -R ynot:ynot /srv/ynot
sudo mkdir -p /var/lib/ynot/{media,labels} /var/backups/ynot/{postgres,media} /etc/ynot
sudo chown -R ynot:ynot /var/lib/ynot /var/backups/ynot
sudo chmod 700 /etc/ynot
sudo chown root:root /etc/ynot
```

- [ ] **Step 3: Clone repo into /srv/ynot**

```bash
cd /srv
sudo -u ynot git clone https://github.com/Batrbekk/ynot.git ynot
cd ynot/web
git rev-parse HEAD
```

Expected: prints latest `main` SHA.

- [ ] **Step 4: Verify**

```bash
ls -la /srv/ynot/web/Dockerfile  # should exist after Group A+B merge
```

If `Dockerfile` doesn't exist yet, that's because Phase 8 work hasn't been merged. For Stage B / first deploy (Group G) we need it merged. For now, just verifies the clone succeeded.

---

### Task 28: Generate production secrets file

**Files:** none (creates `/etc/ynot/secrets.env` on VPS)

- [ ] **Step 1: SSH in**

```bash
ssh ynot-prod
```

- [ ] **Step 2: Build secrets.env locally first to inspect, then push**

On the local Mac:

```bash
cat > /tmp/ynot-secrets-template.env <<'EOF'
# Generated 2026-05-05 by Phase 8 bootstrap
NEXTAUTH_SECRET=__GENERATED__
ORDER_TOKEN_SECRET=__GENERATED__
POSTGRES_PASSWORD=__GENERATED__
DATABASE_URL=postgresql://ynot:__POSTGRES_PASSWORD__@postgres:5432/ynot_prod?schema=public
REDIS_URL=redis://redis:6379

# Stripe (TEST mode for first deploy; cutover to LIVE in Stage E)
STRIPE_SECRET_KEY=sk_test_<paste-from-Stripe-Dashboard>
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_<paste-from-Stripe-Dashboard>
STRIPE_WEBHOOK_SECRET=whsec_<configured-after-CF-DNS-cutover>

# Carrier
ROYAL_MAIL_API_KEY=<from-.env.local>
DHL_API_KEY=<from-.env.local>
DHL_API_SECRET=<from-.env.local>
DHL_ACCOUNT_NUMBER=230200799

# Email
RESEND_API_KEY=<from-.env.local>
RESEND_FROM=YNOT London <hello@ynotlondon.com>

# Storage
LABEL_STORAGE=local
LABEL_STORAGE_PATH=/var/lib/ynot/labels
MEDIA_STORAGE=local
MEDIA_STORAGE_PATH=/var/lib/ynot/media
MEDIA_PUBLIC_BASE_URL=https://ynotlondon.com/api/media

# Worker
WORKER_ENABLED=true

# Operational
ALERT_EMAIL=alerts@ynotlondon.com
NEXT_PUBLIC_SITE_URL=https://ynotlondon.com
SHIPPING_PROVIDER=mock

# Sentry (Stage A — fill once Sentry project created)
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=

# R2 backups (Stage A — fill once R2 bucket created)
R2_ENDPOINT=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=ynot-backups
EOF
```

- [ ] **Step 3: Generate the random secrets**

```bash
NEXTAUTH=$(openssl rand -base64 32)
ORDER_TOKEN=$(openssl rand -base64 32)
PG_PASS=$(openssl rand -hex 32)

sed -i.bak \
  -e "s|NEXTAUTH_SECRET=__GENERATED__|NEXTAUTH_SECRET=${NEXTAUTH}|" \
  -e "s|ORDER_TOKEN_SECRET=__GENERATED__|ORDER_TOKEN_SECRET=${ORDER_TOKEN}|" \
  -e "s|POSTGRES_PASSWORD=__GENERATED__|POSTGRES_PASSWORD=${PG_PASS}|" \
  -e "s|__POSTGRES_PASSWORD__|${PG_PASS}|" \
  /tmp/ynot-secrets-template.env

rm /tmp/ynot-secrets-template.env.bak
```

- [ ] **Step 4: Manually fill the carrier + email + Stripe Test secrets**

Open `/tmp/ynot-secrets-template.env` in a local editor. Copy the values from `web/.env.local` (which has Stripe Test + DHL + RM + Resend keys from prior phases) into the placeholders.

- [ ] **Step 5: Push to VPS as root-owned**

```bash
scp /tmp/ynot-secrets-template.env ynot-prod:/tmp/secrets.env.new
ssh ynot-prod "sudo install -o root -g root -m 600 /tmp/secrets.env.new /etc/ynot/secrets.env && rm /tmp/secrets.env.new && sudo ls -la /etc/ynot/secrets.env"
```

Expected: `-rw------- 1 root root ... /etc/ynot/secrets.env`.

- [ ] **Step 6: Wipe local copy**

```bash
shred -u /tmp/ynot-secrets-template.env || rm -P /tmp/ynot-secrets-template.env
```

- [ ] **Step 7: Capture POSTGRES_PASSWORD into a separate dotfile for compose env**

Compose substitutes `${POSTGRES_PASSWORD}` from its environment, not from `env_file`. We need the value reachable when running `docker compose ...`. Options:

- Easiest: write `/srv/ynot/.env` (chmod 600, owned by `ynot` user) with `POSTGRES_PASSWORD=...`. Compose auto-loads `.env` from `--project-directory`.

```bash
ssh ynot-prod "echo 'POSTGRES_PASSWORD=${PG_PASS}' > /srv/ynot/.env && chmod 600 /srv/ynot/.env"
```

> ⚠️ Don't run that command directly via `ssh` — `${PG_PASS}` is a local var in our shell; on the VPS this would be empty. Better: SSH in, run `sudo cat /etc/ynot/secrets.env | grep POSTGRES_PASSWORD` to get it, then write to `/srv/ynot/.env`. But sudo for ynot user not granted. Workaround:
>
> SSH in as `ubuntu` (still has sudo), copy the password line manually:
> `sudo grep POSTGRES_PASSWORD /etc/ynot/secrets.env | sudo tee /srv/ynot/.env`
> `sudo chown ynot:ynot /srv/ynot/.env && sudo chmod 600 /srv/ynot/.env`

---

### Task 29: Bootstrap script `scripts/prod-bootstrap.sh` (committed for future re-builds)

**Files:**
- Create: `web/scripts/prod-bootstrap.sh`

This task captures Tasks 23-28 as a runnable script for future server rebuilds. We've already done the manual steps; the script is documentation + replay tool.

- [ ] **Step 1: Write file**

```bash
#!/usr/bin/env bash
# Phase 8 — one-shot VPS bootstrap. Run as `ubuntu` user with sudo on a fresh
# Ubuntu 24.04 Lightsail instance. Idempotent: rerunning is safe.
set -euo pipefail

if [[ "$(id -un)" != "ubuntu" ]]; then
  echo "Run as ubuntu user." >&2
  exit 1
fi

echo "==> apt update + hardening"
sudo apt update
sudo apt upgrade -y
sudo apt install -y fail2ban ufw curl ca-certificates gnupg

echo "==> ufw"
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
echo "y" | sudo ufw enable

echo "==> fail2ban"
sudo systemctl enable --now fail2ban

echo "==> Docker"
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sudo sh
fi

echo "==> ynot user"
if ! id ynot &>/dev/null; then
  sudo adduser --disabled-password --gecos "" ynot
  sudo usermod -aG docker ynot
  sudo mkdir -p /home/ynot/.ssh
  sudo cp ~/.ssh/authorized_keys /home/ynot/.ssh/
  sudo chown -R ynot:ynot /home/ynot/.ssh
  sudo chmod 700 /home/ynot/.ssh
  sudo chmod 600 /home/ynot/.ssh/authorized_keys
fi

echo "==> dirs"
sudo mkdir -p /srv/ynot
sudo chown -R ynot:ynot /srv/ynot
sudo mkdir -p /var/lib/ynot/{media,labels} /var/backups/ynot/{postgres,media} /etc/ynot
sudo chown -R ynot:ynot /var/lib/ynot /var/backups/ynot
sudo chmod 700 /etc/ynot
sudo chown root:root /etc/ynot

echo "==> repo clone"
if [[ ! -d /srv/ynot/.git ]]; then
  sudo -u ynot git clone https://github.com/Batrbekk/ynot.git /srv/ynot
fi

echo "==> reminder"
echo "  Manual remaining steps:"
echo "  1. Generate /etc/ynot/secrets.env (root:600). See scripts/env-prod-template.sh."
echo "  2. Generate /srv/ynot/.env with POSTGRES_PASSWORD line (chmod 600, owner ynot)."
echo "  3. Add deploy SSH key to /home/ynot/.ssh/authorized_keys"
echo "  4. Add SSH_PRIVATE_KEY + SSH_HOST + SSH_USER + GHCR_PAT to GitHub repo Secrets."

echo "==> Done."
```

- [ ] **Step 2: chmod + commit**

```bash
chmod +x scripts/prod-bootstrap.sh
git add scripts/prod-bootstrap.sh
git commit -m "feat(phase-8): VPS bootstrap script (replays Tasks 23-27)"
```

---

### Task 30: env-prod-template.sh

**Files:**
- Create: `web/scripts/env-prod-template.sh`

- [ ] **Step 1: Write script that prints the secrets template**

```bash
#!/usr/bin/env bash
# Phase 8 — print the expected /etc/ynot/secrets.env shape with placeholders.
# Use during operator bootstrap to generate a fillable template.
cat <<'EOF'
NEXTAUTH_SECRET=
ORDER_TOKEN_SECRET=
POSTGRES_PASSWORD=
DATABASE_URL=postgresql://ynot:CHANGEME@postgres:5432/ynot_prod?schema=public
REDIS_URL=redis://redis:6379
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
ROYAL_MAIL_API_KEY=
DHL_API_KEY=
DHL_API_SECRET=
DHL_ACCOUNT_NUMBER=230200799
RESEND_API_KEY=
RESEND_FROM=YNOT London <hello@ynotlondon.com>
LABEL_STORAGE=local
LABEL_STORAGE_PATH=/var/lib/ynot/labels
MEDIA_STORAGE=local
MEDIA_STORAGE_PATH=/var/lib/ynot/media
MEDIA_PUBLIC_BASE_URL=https://ynotlondon.com/api/media
WORKER_ENABLED=true
ALERT_EMAIL=alerts@ynotlondon.com
NEXT_PUBLIC_SITE_URL=https://ynotlondon.com
SHIPPING_PROVIDER=mock
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=
R2_ENDPOINT=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=ynot-backups
EOF
```

- [ ] **Step 2: chmod + commit**

```bash
chmod +x scripts/env-prod-template.sh
git add scripts/env-prod-template.sh
git commit -m "feat(phase-8): env-prod-template.sh — operator bootstrap helper"
```

---

### Task 31: prod-deploy-local.sh — fallback manual deploy

**Files:**
- Create: `web/scripts/prod-deploy-local.sh`

- [ ] **Step 1: Write script**

```bash
#!/usr/bin/env bash
# Phase 8 — manual deploy fallback when GitHub Actions broken.
# Runs locally; SSHs to VPS and pulls the latest images.
set -euo pipefail

SSH_TARGET="${SSH_TARGET:-ynot-prod}"
TAG="${1:-latest}"

echo "[deploy] target=$SSH_TARGET tag=$TAG"

ssh "$SSH_TARGET" <<EOF
set -euo pipefail
cd /srv/ynot
git fetch origin main
git reset --hard origin/main
cd web
export IMAGE_TAG=$TAG
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile prod pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile prod \
  run --rm app sh -c "npx prisma migrate deploy"
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile prod \
  up -d --no-deps --remove-orphans app worker caddy
sleep 12
curl -fsSL --max-time 10 http://localhost/api/health
EOF
echo "[deploy] OK"
```

- [ ] **Step 2: chmod + commit**

```bash
chmod +x scripts/prod-deploy-local.sh
git add scripts/prod-deploy-local.sh
git commit -m "feat(phase-8): manual deploy fallback script (when GH Actions unavailable)"
```

---

### Task 32: Push branch + verify lint/typecheck/test on the feature branch

**Files:** none

- [ ] **Step 1: Push branch**

```bash
git push -u origin feature/phase-8-production-launch
```

- [ ] **Step 2: Run full local verification**

```bash
pnpm typecheck 2>&1 | tail -3
pnpm lint 2>&1 | tail -3
pnpm test 2>&1 | tail -3
BUILD_PROD=1 pnpm build 2>&1 | tail -3
```

Expected: all clean. Build now succeeds (was previously broken on `main`).

- [ ] **Step 3: Note any unexpected breakage** — escalate as DONE_WITH_CONCERNS in subagent context.

---

## Group F — GitHub Actions CI + Deploy

### Task 33: CI workflow (`.github/workflows/ci.yml`)

**Files:**
- Create: `web/.github/workflows/ci.yml`

**Important location detail:** GitHub Actions reads workflows from `.github/workflows/` at the **repo root**, NOT from `web/.github/workflows/`. Adjust path if the repo has a `web/` subdir layout. From the earlier explore — Phase 5 files are under `web/`, suggesting the repo root is `/Users/batyrbekkuandyk/Desktop/ynot/web/` itself (i.e., the git root is the `web/` dir). Verify with:

```bash
ls /Users/batyrbekkuandyk/Desktop/ynot/web/.git
```

If `.git` exists in `web/`, the workflows go in `web/.github/workflows/` (which is the repo root for git). If `.git` is in `/Users/batyrbekkuandyk/Desktop/ynot/`, then workflows go in `/Users/batyrbekkuandyk/Desktop/ynot/.github/workflows/`. Pick the right path.

- [ ] **Step 1: Create workflows directory**

Run from repo root:

```bash
mkdir -p .github/workflows
```

- [ ] **Step 2: Write `ci.yml`**

```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: ynot
          POSTGRES_PASSWORD: ynot_test_password
          POSTGRES_DB: ynot_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U ynot"
          --health-interval 5s
          --health-retries 10
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'
          cache-dependency-path: pnpm-lock.yaml

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Set up test env
        run: |
          cp .env.example .env.test
          # Override the seeded URL to match the GH Actions Postgres service
          sed -i 's|^DATABASE_URL=.*|DATABASE_URL=postgresql://ynot:ynot_test_password@localhost:5432/ynot_test?schema=public|' .env.test

      - name: Apply migrations
        run: pnpm prisma migrate deploy
        env:
          DATABASE_URL: postgresql://ynot:ynot_test_password@localhost:5432/ynot_test?schema=public

      - run: pnpm typecheck
      - run: pnpm lint
      - name: Test
        run: pnpm test
        env:
          DATABASE_URL: postgresql://ynot:ynot_test_password@localhost:5432/ynot_test?schema=public
          REDIS_URL: redis://localhost:6379

      - name: Build
        run: pnpm build
        env:
          BUILD_PROD: '1'
```

- [ ] **Step 3: Verify YAML syntax**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))" && echo OK
```

Expected: `OK`.

- [ ] **Step 4: Commit + push**

```bash
git add .github/workflows/ci.yml
git commit -m "feat(phase-8): CI workflow — typecheck/lint/test/build on PR + main"
git push
```

- [ ] **Step 5: Watch the run**

Open https://github.com/Batrbekk/ynot/actions — the push should trigger CI. Wait ~5-10 min. If green, ✅. If red, fix the issue and re-push.

---

### Task 34: GitHub Container Registry — Personal Access Token

**Files:** none (operator action in GitHub UI)

- [ ] **Step 1: Generate PAT**

Visit https://github.com/settings/tokens?type=beta (Fine-grained tokens) OR https://github.com/settings/tokens (Classic):
- **Token name:** `ynot-deploy-ghcr`
- **Expiration:** 1 year (renewable)
- **Repository access:** Only select repos → `Batrbekk/ynot`
- **Permissions → Repository:** `Contents: Read`
- **Permissions → Account:** `Packages: Write`

(For Classic tokens: enable `write:packages`, `read:packages`, `delete:packages`.)

- [ ] **Step 2: Save PAT to GitHub repo secrets**

GitHub → repo `Batrbekk/ynot` → Settings → Secrets and variables → Actions → New repository secret:
- **Name:** `GHCR_PAT`
- **Value:** paste the PAT

> ⚠️ Don't commit the PAT to git. Don't share. If leaked, regenerate immediately.

- [ ] **Step 3: Verify GH Secrets list**

GitHub UI → repo Secrets list should show:
- `GHCR_PAT`
- `SSH_PRIVATE_KEY` (from Task 26)
- `SSH_HOST`
- `SSH_USER`

If `SENTRY_AUTH_TOKEN` is added (later), it'll appear too.

---

### Task 35: Deploy workflow (`.github/workflows/deploy.yml`)

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Write file**

```yaml
name: Deploy

on:
  push:
    branches: [main]

concurrency:
  group: deploy-prod
  cancel-in-progress: false

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    outputs:
      image_tag: ${{ steps.meta.outputs.tag }}
    steps:
      - uses: actions/checkout@v4

      - id: meta
        run: echo "tag=${GITHUB_SHA::12}" >> "$GITHUB_OUTPUT"

      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GHCR_PAT }}

      - name: Build + push app image
        uses: docker/build-push-action@v5
        with:
          context: .
          file: Dockerfile
          tags: |
            ghcr.io/batrbekk/ynot-app:${{ steps.meta.outputs.tag }}
            ghcr.io/batrbekk/ynot-app:latest
          push: true
          cache-from: type=gha
          cache-to: type=gha,mode=max
          build-args: |
            SENTRY_AUTH_TOKEN=${{ secrets.SENTRY_AUTH_TOKEN }}

      - name: Build + push worker image
        uses: docker/build-push-action@v5
        with:
          context: .
          file: Dockerfile.worker
          tags: |
            ghcr.io/batrbekk/ynot-worker:${{ steps.meta.outputs.tag }}
            ghcr.io/batrbekk/ynot-worker:latest
          push: true
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    steps:
      - name: SSH agent setup
        uses: webfactory/ssh-agent@v0.9.0
        with:
          ssh-private-key: ${{ secrets.SSH_PRIVATE_KEY }}

      - name: Deploy to VPS
        env:
          IMAGE_TAG: ${{ needs.build-and-push.outputs.image_tag }}
          SSH_HOST: ${{ secrets.SSH_HOST }}
          SSH_USER: ${{ secrets.SSH_USER }}
        run: |
          ssh -o StrictHostKeyChecking=accept-new "$SSH_USER@$SSH_HOST" bash -s <<EOF
            set -euo pipefail
            cd /srv/ynot
            git fetch origin main
            git reset --hard origin/main
            cd web
            export IMAGE_TAG=$IMAGE_TAG
            docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile prod pull
            docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile prod \
              run --rm app sh -c "npx prisma migrate deploy"
            docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile prod \
              up -d --no-deps --remove-orphans app ynot-worker caddy
            sleep 15
            curl -fsSL --max-time 10 http://localhost/api/health
          EOF
```

- [ ] **Step 2: Commit + push**

```bash
git add .github/workflows/deploy.yml
git commit -m "feat(phase-8): deploy workflow — build, push to ghcr, SSH deploy on main push"
git push
```

> Note: this push will trigger BOTH ci.yml and deploy.yml. CI runs in parallel. Deploy will likely fail this time because:
> 1. The VPS doesn't have Phase 8 code yet (need Group G to seed it)
> 2. Image push works regardless — that's a useful early test

- [ ] **Step 3: Watch run**

Watch https://github.com/Batrbekk/ynot/actions:
- CI: should pass
- Deploy build-and-push: should succeed → `ghcr.io/batrbekk/ynot-app:<sha>` and `:latest` available
- Deploy deploy: will fail at SSH or compose step — that's expected; Group G fixes it

---

### Task 36: Confirm images in ghcr.io

**Files:** none

- [ ] **Step 1: Check ghcr.io**

Visit https://github.com/Batrbekk?tab=packages — you should see two packages:
- `ynot-app`
- `ynot-worker`

Both with tags matching the latest commit SHA + `latest`.

- [ ] **Step 2: Pull image on VPS to verify access**

```bash
ssh ynot-prod
echo "<GHCR_PAT>" | docker login ghcr.io -u Batrbekk --password-stdin
docker pull ghcr.io/batrbekk/ynot-app:latest
docker images ghcr.io/batrbekk/ynot-app
```

> Replace `<GHCR_PAT>` with the actual PAT from Task 34. After this initial login, `docker login` credentials persist in `/home/ynot/.docker/config.json` so subsequent pulls don't need re-auth.

Expected: image pulled successfully, listed.

> If pull fails with "denied", verify the package is set to private + the PAT has `read:packages` scope.

- [ ] **Step 3: No commit** (verification).

---

### Task 37: Lightsail firewall — restrict to Cloudflare IPs

**Files:** none (Lightsail Console UI action)

This task happens AFTER Cloudflare DNS migration is complete (so we know which IPs to allow). For now, leave Lightsail firewall open on 80+443 to all IPs. **Mark task complete only after Group H + I done.**

- [ ] **Step 1 (deferred): After Cloudflare DNS migration in Group I, return here.**

In Lightsail Console:
- Open `ynot-prod` instance → Networking tab
- Find IPv4 firewall rules
- For TCP 80 + 443: change "Source" from "Anywhere (0.0.0.0/0)" → list of Cloudflare IPv4 ranges from https://www.cloudflare.com/ips-v4 (currently 15 CIDRs):

```
173.245.48.0/20
103.21.244.0/22
103.22.200.0/22
103.31.4.0/22
141.101.64.0/18
108.162.192.0/18
190.93.240.0/20
188.114.96.0/20
197.234.240.0/22
198.41.128.0/17
162.158.0.0/15
104.16.0.0/13
104.24.0.0/14
172.64.0.0/13
131.0.72.0/22
```

> Lightsail firewall UI may not accept multiple CIDRs per port — workaround: add rule per CIDR. Tedious; alternative is to skip and rely on ufw + Cloudflare's managed proxy alone (acceptable on Free tier).

- [ ] **Step 2: SSH 22 — restrict to operator's home IP**

Find your home IP via `curl -fsSL https://ifconfig.me` from local terminal. Lightsail firewall → port 22 → restrict to that IP/32.

> If your IP rotates (most home ISPs), this becomes annoying. Alternative: leave SSH open + rely on fail2ban + key-only auth (already in place).

---

### Task 38: Document Sentry + UptimeRobot setup in deploy.md

**Files:**
- Modify: `web/docs/deploy.md`

- [ ] **Step 1: Append more detailed runbook**

Append to `web/docs/deploy.md`:

```markdown
## Deploy flow (after Phase 8 lands)

1. Code merged to `main` → GitHub Actions:
   - CI: `pnpm typecheck && lint && test && build`. Must pass.
   - Deploy: builds Docker images, pushes to ghcr.io, SSHs to VPS, pulls, runs `prisma migrate deploy`, `docker compose up -d` for app+worker+caddy.
   - Total: ~5-7 minutes. Health check via `/api/health` confirms success.

2. Manual fallback: `./scripts/prod-deploy-local.sh <git-sha-12-chars>` from operator Mac.

## Rollback

- **Recent breakage:** `git revert <bad-sha> && git push origin main`. Re-runs deploy with previous image (~5 min).
- **Emergency:** `ssh ynot-prod`, `cd /srv/ynot/web`, `IMAGE_TAG=<previous-sha> docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile prod up -d`. Bypasses migration replay.

## Restore from backup

1. SSH to VPS as `ynot` user.
2. `./scripts/prod-restore-postgres.sh YYYY-MM-DD` — restores Postgres from R2.
3. For media: `aws s3 cp s3://ynot-backups/media/YYYY-MM-DD.tar.gz . --endpoint-url $R2_ENDPOINT && sudo tar -xzf YYYY-MM-DD.tar.gz -C /`.

## Common ops

- View logs: `ssh ynot-prod 'docker compose -f /srv/ynot/web/docker-compose.yml -f /srv/ynot/web/docker-compose.prod.yml logs -f --tail=200 app'`
- Restart all: `ssh ynot-prod 'cd /srv/ynot/web && docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile prod restart'`
- Connect to Postgres: `ssh ynot-prod 'docker exec -it ynot-postgres psql -U ynot ynot_prod'`
- Worker logs: `ssh ynot-prod 'docker logs --tail=100 ynot-worker'`

## DNS rollback

If Cloudflare proxy breaks something:
1. CF Dashboard → DNS → flip orange cloud to grey for `@` and `www` records (DNS-only, bypasses proxy).
2. If still broken: GoDaddy → Domains → `ynotlondon.com` → Nameservers → revert to default GoDaddy NS values. Propagation 5min – 24h.
```

- [ ] **Step 2: Commit + push**

```bash
git add docs/deploy.md
git commit -m "docs(phase-8): expand deploy runbook with rollback + restore + common ops"
git push
```

---

## Group G — First Deploy on Raw IP

### Task 39: Merge feature branch to main

**Files:** none (git operation)

- [ ] **Step 1: Locally squash-merge feature/phase-8-production-launch → main**

```bash
git checkout main
git pull
git merge --squash feature/phase-8-production-launch
git commit -m "feat(phase-8): production launch infrastructure (#TBD)

- Multi-stage Dockerfile + Caddyfile + docker-compose.prod.yml override
- BUILD_PROD env validator short-circuit (unblocks Docker build)
- /api/health extended with db+redis+version
- Sentry integrated for error monitoring (server + client + edge)
- GitHub Actions CI + deploy (build → ghcr.io → SSH → compose up)
- Backup scripts (Postgres + media) wired to worker cron
- Restore + manual-deploy fallback scripts
- Bootstrap script for fresh VPS replays
- Operator runbook in docs/deploy.md
"
git push origin main
```

> Use a real PR if you prefer; squash is simplest given the operator is solo.

- [ ] **Step 2: Watch GH Actions**

Watch https://github.com/Batrbekk/ynot/actions:
- CI runs and (must) pass
- Deploy runs:
  - build-and-push → ghcr.io updated with new SHA tag
  - deploy job → SSHs to VPS, runs migrations, restarts services

Expected: Both jobs green ✅.

- [ ] **Step 3: If deploy fails**

Most likely failures:
- VPS Docker not yet logged in to ghcr.io with PAT — fix: as documented in Task 36, run `docker login ghcr.io` once on VPS.
- `/etc/ynot/secrets.env` missing required key — check VPS `sudo cat /etc/ynot/secrets.env | head -10`.
- `/srv/ynot/.env` missing `POSTGRES_PASSWORD` — fix: see Task 28 step 7.

Re-run failed deploy from GitHub Actions UI ("Re-run jobs").

---

### Task 40: Verify health endpoint over Caddy + IP

**Files:** none

- [ ] **Step 1: From operator Mac**

```bash
curl -k -H "Host: ynotlondon.com" https://13.135.247.31/api/health
```

Note: `-k` because Caddy issues a Let's Encrypt cert for `ynotlondon.com` but we're hitting via raw IP — cert is valid for the hostname but TLS handshake against IP raises a name mismatch warning. `-k` skips verification.

Expected: JSON `{"ok":true,"db":"up","redis":"up","version":"<sha-12>"}`.

- [ ] **Step 2: From VPS internally**

```bash
ssh ynot-prod 'curl -fsSL http://localhost/api/health'
```

Expected: same JSON (Caddy listens on 80 too, with HTTP redirect to HTTPS for hostname match — but local `Host:` header preserves).

- [ ] **Step 3: Check container status**

```bash
ssh ynot-prod 'cd /srv/ynot/web && docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile prod ps'
```

Expected: all 5 services (postgres, redis, app, ynot-worker, caddy) Up + healthy.

---

### Task 41: First deploy verification — storefront responds

**Files:** none

- [ ] **Step 1: Hit homepage with `Host:` header trick**

```bash
curl -k -H "Host: ynotlondon.com" -L https://13.135.247.31/ | head -50
```

Expected: HTML with `<title>YNOT London</title>` (or similar) and storefront content.

- [ ] **Step 2: If 5xx**

Logs: `ssh ynot-prod 'docker logs --tail 100 ynot-app'`. Common: missing env, Prisma migrate didn't run, image tag wrong.

- [ ] **Step 3: No commit** (verification).

---

### Task 42: Worker verification

**Files:** none

- [ ] **Step 1: Check worker logs**

```bash
ssh ynot-prod 'docker logs --tail 50 ynot-worker'
```

Expected: lines like `[ynot-worker] all jobs scheduled` and (if `NODE_ENV=production`) `[ynot-worker] backup schedules registered`.

- [ ] **Step 2: Trigger a backup manually to verify R2 connectivity**

> First add R2 envs to `/etc/ynot/secrets.env` if not yet done (and fill `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` — sign up Cloudflare R2 in dashboard, create bucket `ynot-backups`, generate API token with `Object Read and Write` scope).

```bash
ssh ynot-prod 'docker exec ynot-worker /app/scripts/prod-backup-postgres.sh'
```

Expected: `[backup-postgres] OK <date>` and the file appears in R2 bucket (`ynot-backups/postgres/<date>.dump.gz`). Verify in Cloudflare R2 Dashboard → bucket browser.

- [ ] **Step 3: No commit**.

---

## Group H — Cloudflare Setup

> All Group H tasks happen in **Cloudflare Dashboard** (https://dash.cloudflare.com).

### Task 43: Sign up Cloudflare + add site

**Files:** none

- [ ] **Step 1: Sign up at https://dash.cloudflare.com/sign-up** (free tier).

- [ ] **Step 2: Add a Site → enter `ynotlondon.com` → Free plan.**

- [ ] **Step 3: Cloudflare scans existing GoDaddy DNS records** and shows what it found. Review:
- `A @` → likely points to GoDaddy parking IP
- `CNAME www` → likely points to `@`

- [ ] **Step 4: Add/update records:**
- `A @` → `13.135.247.31` → Proxy: orange cloud ON (proxied)
- `A www` → `13.135.247.31` → Proxy: orange cloud ON (proxied)

> Other records (MX for Resend if any, TXT for SPF/DKIM) — leave alone, copy from current GoDaddy zone.

- [ ] **Step 5: Continue setup wizard.**

---

### Task 44: Cloudflare SSL/TLS configuration

**Files:** none

- [ ] **Step 1: SSL/TLS → Overview**
- Encryption mode: **Full (strict)**

- [ ] **Step 2: SSL/TLS → Edge Certificates**
- Always Use HTTPS: **ON**
- Automatic HTTPS Rewrites: **ON**
- Minimum TLS Version: **TLS 1.2**

- [ ] **Step 3: SSL/TLS → Origin Server**
- (Optional) Generate origin certificate to install on Caddy. Skip for now — Let's Encrypt cert from Caddy works with Full (strict). Add if Cloudflare reports cert errors during DNS migration.

---

### Task 45: Cloudflare performance + security defaults

**Files:** none

- [ ] **Step 1: Speed → Optimization**
- Brotli: **ON**
- Auto Minify (CSS/JS/HTML): leave default OFF (Next.js already minifies)

- [ ] **Step 2: Caching → Configuration**
- Browser Cache TTL: 4 hours (default)
- Always Online: ON

- [ ] **Step 3: Security → WAF**
- Managed Rules: enable Cloudflare Managed Ruleset (free tier OK)
- (Phase 9+) Add custom rule to rate-limit `/api/*` if abuse appears

- [ ] **Step 4: Security → Bots**
- Bot Fight Mode: ON (free)

---

### Task 46: Cloudflare R2 bucket for backups

**Files:** none

- [ ] **Step 1: R2 → Overview → Create bucket**
- Name: `ynot-backups`
- Location: choose nearest (`eu-west` if available)

- [ ] **Step 2: R2 → Manage R2 API Tokens → Create API Token**
- Token name: `ynot-backups`
- Permissions: Object Read & Write
- TTL: never expires (or 1 year)
- Bucket scope: only `ynot-backups`

- [ ] **Step 3: Save the credentials**

The token UI shows once:
- Token value (= `R2_SECRET_ACCESS_KEY`)
- Access Key ID (= `R2_ACCESS_KEY_ID`)
- Endpoint (= `R2_ENDPOINT`, looks like `https://<accountid>.r2.cloudflarestorage.com`)

- [ ] **Step 4: Push to VPS secrets file**

```bash
# Locally edit /tmp/r2-update.env
R2_ENDPOINT=https://abc123.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=ynot-backups
```

```bash
scp /tmp/r2-update.env ynot-prod:/tmp/r2.env
ssh ynot-prod 'sudo bash -c "cat /tmp/r2.env >> /etc/ynot/secrets.env && sort -u /etc/ynot/secrets.env > /tmp/sorted.env && install -o root -g root -m 600 /tmp/sorted.env /etc/ynot/secrets.env && rm /tmp/r2.env /tmp/sorted.env"'
shred -u /tmp/r2-update.env
```

> Sort+install dance ensures only one copy of each var (cleans up if re-run).

- [ ] **Step 5: Restart worker to pick up new env**

```bash
ssh ynot-prod 'cd /srv/ynot/web && docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile prod restart ynot-worker'
```

- [ ] **Step 6: Test backup**

```bash
ssh ynot-prod 'docker exec ynot-worker /app/scripts/prod-backup-postgres.sh'
```

Expected: success; file appears in R2 bucket.

---

## Group I — DNS Migration

### Task 47: Cloudflare nameservers (copy from Cloudflare Dashboard)

**Files:** none

- [ ] **Step 1: Cloudflare Dashboard → ynotlondon.com → DNS → Cloudflare Nameservers** shows two nameservers, e.g.:
- `kim.ns.cloudflare.com`
- `bob.ns.cloudflare.com`

(Names vary — Cloudflare assigns them per account.)

- [ ] **Step 2: Note them down.**

---

### Task 48: GoDaddy NS swap

**Files:** none

- [ ] **Step 1: GoDaddy Dashboard → My Products → Domains → ynotlondon.com → DNS Management → Nameservers section.**

- [ ] **Step 2: Edit Nameservers → Custom → enter the two Cloudflare NS from Task 47.**

- [ ] **Step 3: Save.**

- [ ] **Step 4: Verify propagation**

From local Mac:

```bash
dig ns ynotlondon.com +short
```

Expected: shows Cloudflare NS once propagation completes (5 min – 24 h, usually <1h).

```bash
dig a ynotlondon.com +short
```

Expected: returns Cloudflare-proxy IP (NOT `13.135.247.31` directly — Cloudflare proxies it).

---

### Task 49: Verify ynotlondon.com serves the site

**Files:** none

- [ ] **Step 1: Once `dig ns` shows Cloudflare**

```bash
curl -fsSL https://ynotlondon.com/api/health
```

Expected: JSON `{"ok":true,...,"version":"<sha>"}` — same as raw-IP test, but now via Cloudflare → Caddy → app.

- [ ] **Step 2: Browser test**

Open https://ynotlondon.com in browser. Expected: storefront homepage with green padlock; cert issued by Cloudflare; no warnings.

Inspect cert:
- macOS Safari: Click padlock → Show Certificate → see Cloudflare-issued cert
- Or: `openssl s_client -connect ynotlondon.com:443 -servername ynotlondon.com 2>/dev/null | grep -E "issuer|subject"`

- [ ] **Step 3: Verify www → bare canonical**

```bash
curl -fsSL -o /dev/null -w "%{http_code} %{url_effective}\n" https://www.ynotlondon.com
```

Expected: `200 https://ynotlondon.com/` after redirect.

- [ ] **Step 4: Site is now live in TEST mode.** Customers can browse, add to cart, checkout — but only with Stripe test cards. Real payments don't work yet.

---

## Group J — Stripe Live Cutover

### Task 50: Generate Stripe Live keys

**Files:** none (Stripe Dashboard)

- [ ] **Step 1: Stripe Dashboard → top-right toggle from "Test mode" → "Live mode"**.

- [ ] **Step 2: Developers → API Keys**
- Copy `Publishable key` (`pk_live_...`)
- Reveal + copy `Secret key` (`sk_live_...`)

- [ ] **Step 3: Developers → Webhooks → Add endpoint**
- URL: `https://ynotlondon.com/api/webhooks/stripe`
- Events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`
- Save → reveals **Signing secret** (`whsec_...`) — copy this too

- [ ] **Step 4: Save all three values somewhere safe locally** (a local password manager, NOT git).

---

### Task 51: Update production secrets file with Live keys

**Files:** none (writes `/etc/ynot/secrets.env` on VPS)

- [ ] **Step 1: Build update file locally**

```bash
cat > /tmp/stripe-live.env <<EOF
STRIPE_SECRET_KEY=sk_live_<paste>
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_<paste>
STRIPE_WEBHOOK_SECRET=whsec_<paste>
EOF
```

Edit and fill in actual values from Task 50.

- [ ] **Step 2: Push to VPS, replacing existing Stripe lines**

```bash
scp /tmp/stripe-live.env ynot-prod:/tmp/stripe-live.env
ssh ynot-prod bash -s <<'EOF'
sudo sed -i \
  -e '/^STRIPE_SECRET_KEY=/d' \
  -e '/^NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=/d' \
  -e '/^STRIPE_WEBHOOK_SECRET=/d' \
  /etc/ynot/secrets.env
sudo cat /tmp/stripe-live.env | sudo tee -a /etc/ynot/secrets.env > /dev/null
sudo chown root:root /etc/ynot/secrets.env
sudo chmod 600 /etc/ynot/secrets.env
sudo grep "^STRIPE_" /etc/ynot/secrets.env  # verify
sudo rm /tmp/stripe-live.env
EOF
shred -u /tmp/stripe-live.env
```

- [ ] **Step 3: Restart app + worker to pick up new env**

```bash
ssh ynot-prod 'cd /srv/ynot/web && docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile prod restart app ynot-worker'
sleep 10
curl -fsSL https://ynotlondon.com/api/health
```

Expected: still `ok:true,db:up,redis:up`.

---

### Task 52: Smoke test Stripe Live with £1 transaction

**Files:** none

- [ ] **Step 1: Open browser → ynotlondon.com → product → add to cart**

Pick the cheapest possible product (or temporarily seed a £1 product in admin).

- [ ] **Step 2: Checkout with a real card** (your own card, ideally; have £1 to spare).

Complete the order — enter shipping address, real card number, real CVV.

- [ ] **Step 3: Wait for confirmation**

Expected within 30s:
- Browser → success page with order number
- Inbox → OrderReceipt email arrives at the address you entered

- [ ] **Step 4: Verify Stripe Dashboard**

Stripe Dashboard (still in Live mode) → Payments → see the £1 charge with status "Succeeded".

- [ ] **Step 5: Verify webhook delivery**

Stripe Dashboard → Webhooks → ynotlondon.com endpoint → see "200 OK" delivery for `payment_intent.succeeded`.

- [ ] **Step 6: Verify admin sees the order**

Open https://ynotlondon.com/admin/orders → log in as Жансая (OWNER user — seed if not yet via `pnpm tsx scripts/seed.ts` on VPS). See the £1 order in the list.

- [ ] **Step 7: Refund the £1**

In `/admin/orders/[id]` click "Cancel order" → expect:
- Stripe shows £1 refund in Dashboard
- Customer email arrives with OrderCancelled message
- Card refund appears within 1-3 working days

- [ ] **Step 8: If anything fails — rollback**

Edit `/etc/ynot/secrets.env` to put Stripe Test keys back; restart; debug.

If smoke passes — **YNOT is live for paying customers**.

---

### Task 53: Tighten Lightsail firewall to Cloudflare IPs (if not done)

(See Task 37 — defer until cutover stable. Do this 24-48h after launch when smoke is confirmed clean.)

---

## Group K — Final Smoke + Manual QA + DoD

### Task 54: UptimeRobot monitors

**Files:** none

- [ ] **Step 1: Sign up https://uptimerobot.com/signUp**

- [ ] **Step 2: Add Monitor #1**
- Type: HTTPS
- URL: `https://ynotlondon.com`
- Friendly name: `ynot-storefront`
- Interval: 5 minutes
- Alert contacts: email `alerts@ynotlondon.com`

- [ ] **Step 3: Add Monitor #2**
- Type: HTTPS
- URL: `https://ynotlondon.com/api/health`
- Friendly name: `ynot-health`
- Interval: 5 minutes
- Keyword filter: keyword exists `"ok":true` (alerts if status code OK but body shows degraded)
- Alert contacts: email `alerts@ynotlondon.com`

- [ ] **Step 4: Verify both monitors green** within 10 minutes.

---

### Task 55: Sentry first-error verification

**Files:** none

- [ ] **Step 1: From local browser, hit a deliberately bad URL on production**

```bash
curl https://ynotlondon.com/this-route-does-not-exist
```

This should 404 in Next.js. 404s aren't errors — try:

```bash
curl https://ynotlondon.com/api/admin/orders/nonexistent-id
```

This should fail auth (403) — not an error either.

To force a real error: temporarily seed an admin endpoint that throws, OR examine Sentry dashboard for any real errors that have already occurred from real traffic.

- [ ] **Step 2: Sentry Dashboard → ynot-london project → Issues**

Expected: zero unresolved errors after 24h of live traffic. If any real errors appear, triage + fix.

---

### Task 56: Update manual-qa.md + Definition of Done verification

**Files:**
- Modify: `web/docs/manual-qa.md`

- [ ] **Step 1: Append Phase 8 manual smoke results**

Add to `web/docs/manual-qa.md`:

```markdown
## Phase 8 — Production launch (status: ✅ launched 2026-MM-DD)

- [x] `pnpm typecheck && lint && test` all green on main
- [x] `BUILD_PROD=1 pnpm build` succeeds
- [x] `https://ynotlondon.com` serves storefront with valid Cloudflare cert
- [x] `https://ynotlondon.com/api/health` returns `{ok:true,db:up,redis:up,version:<sha>}`
- [x] Stripe Test card → checkout → success page → OrderReceipt email arrives
- [x] Stripe Live £1 → real refund verified
- [x] Resend email lands in inbox (not spam)
- [x] First daily Postgres backup file in R2 within 24h
- [x] UptimeRobot dashboard green for both monitors
- [x] Sentry dashboard shows no critical errors after 24h live traffic
- [x] `git push` to main triggers successful deploy end-to-end
- [x] Stripe Dashboard webhook delivery shows successful events
- [x] Lightsail Automatic Snapshots enabled + first daily snapshot taken
- [x] Cloudflare WAF dashboard shows zero customer-blocking false positives
- [x] Smoke test by Жансая on her phone real network: place + receive order
- [x] `docs/deploy.md` runbook complete

YNOT is open for business 🎉
```

- [ ] **Step 2: Verify Definition of Done — all 16 items in spec §14 ticked.**

- [ ] **Step 3: Commit**

```bash
git add docs/manual-qa.md
git commit -m "docs(phase-8): mark Phase 8 launch complete in manual-qa.md"
git push
```

---

## Self-Review

**1. Spec coverage:**

| Spec § | Goal | Task(s) |
|---|---|---|
| §2.1 Single VPS Compose stack | 12, 13, 14 |
| §2.2 Multi-stage Dockerfile | 10, 16 |
| §2.3 Caddy + Let's Encrypt | 11, 12 |
| §2.4 GitHub Actions deploy | 33, 35, 39 |
| §2.5 Production secrets | 28, 30, 51 |
| §2.6 Build-time env fix | 2 |
| §2.7 Zero-downtime deploys | 35 (`--no-deps`) |
| §2.8 Cloudflare proxy | 43, 44, 45 |
| §2.9 Postgres backup | 19, 22, 42 |
| §2.10 Media backup | 20, 22 |
| §2.11 Sentry | 5, 6, 7, 16 |
| §2.12 UptimeRobot | 54 |
| §2.13 DNS migration last | 47, 48 |
| §2.14 Stripe Live cutover | 50, 51, 52 |
| §2.15 Health endpoint | 3 |
| §2.16 Deploy user | 25, 26 |
| §2.17 deploy.md runbook | 17, 38 |
| §2.18 Tests stay green | 32, 33 |
| §11 staged rollout (A-F) | Group E (A) → Group G (B) → Group H (C) → Group I (D) → Group J (E) → Group K (F) |
| §14 DoD 16 items | 56 |

All spec goals covered.

**2. Placeholder scan:** No "TBD", "implement later", "fill in details" outside Task 28's `<paste-from-Stripe-Dashboard>` — those are deliberate operator placeholders for secrets the spec explicitly says are filled at runtime.

**3. Type consistency:** `parseEnv`, `BUILD_PROD`, `IMAGE_TAG`, `R2_*`, `SENTRY_DSN`, `STRIPE_*` are referenced consistently across tasks. The `ynot-app`/`ynot-worker` container names match between docker-compose, deploy script, and runbook.

---

## Plan complete

Plan saved to `web/docs/superpowers/plans/2026-05-05-ynot-backend-phase-8.md`. Two execution options:

**1. Subagent-Driven (recommended for code-heavy tasks)** — Dispatch fresh subagents for Groups A–D + F (TDD code work). Groups E + G–K are runbook tasks that the operator must execute manually (SSH, AWS Console, Cloudflare Dashboard, Stripe Dashboard, GoDaddy DNS) — no code; subagents won't help.

**2. Inline Execution** — Hybrid: I dispatch subagents for Groups A–D + F (code), then walk you through Groups E + G–K step-by-step interactively (since they need your hands on Lightsail / Cloudflare / Stripe / GoDaddy UIs).

**Which approach?**
