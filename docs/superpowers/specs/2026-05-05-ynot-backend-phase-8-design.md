# YNOT London — Backend Phase 8 — Production Launch

**Date:** 2026-05-05
**Status:** Draft (awaiting user review)
**Scope:** Phase 8 of the YNOT roadmap — get `ynotlondon.com` live on production VPS with TLS, automated CI/CD, monitoring, backups, and Cloudflare in front, such that a real customer can place a Stripe Live order and receive shipment confirmation. Replaces every "Phase 8 will" deferral marker scattered through Phases 4–7a (build-time env validation, label/media storage backup, production secrets, DNS migration, Stripe Live keys swap).

---

## 1. Context

After Phases 1–7a, YNOT runs end-to-end on local Docker compose: storefront + admin + worker + Postgres + Redis. Stripe webhook works in test mode with `stripe listen`; DHL Express + Royal Mail Click & Drop API integrations work against real APIs (with sandbox-shaped test data); React Email templates render via Resend; the worker cron runs every 5 minutes; the admin panel manages catalog/CMS/promos.

**What's missing for first customer order:** a public HTTPS URL, real DNS, Stripe Live keys, real DHL/RM credentials swapped from `.env.local` into a hardened production secrets file, automated build/deploy of code changes, daily Postgres backups stored off-server, and an `Up` indicator the human can watch.

External infra committed before this spec was written:

| Item | Status |
|---|---|
| AWS Lightsail London `eu-west-2` instance | ✅ provisioned 2026-05-05; Public IP `13.135.247.31`; Ubuntu 24.04.4 LTS; 2 vCPU / 4 GB RAM / 80 GB SSD; SSH tested via `ssh ynot-prod` |
| Cloudflare account | ⏸ to be created in Phase 8 |
| GitHub Container Registry (`ghcr.io/batrbekk/ynot-*`) | ⏸ free with existing GitHub account |
| GoDaddy domain `ynotlondon.com` | ✅ owned; DNS still points at GoDaddy parking page |
| Resend domain `ynotlondon.com` | ✅ verified DKIM/SPF (Phase 5) |
| Royal Mail Click & Drop API key | ✅ active (Phase 5) |
| DHL Express MyDHL API + Landed Cost API | ✅ approved (Phase 5) |
| Stripe Live mode keys | ⏸ to be generated/copied during Phase 8 cutover |
| `$100` AWS Free Tier credit | ✅ active until 2027-05-05 (covers ~3.5 months Lightsail) |

**Subsequent phases (out of scope here):**
- **Phase 7b** — post-launch admin (newsletter, reviews moderation, audit log viewer, full reports, role invites, shipping zones editor, preorder batch UI). Deferred to post-launch when real metrics inform priorities.
- **Phase 9+** — VAT registration when YNOT crosses £90k turnover; expansion of test coverage to Playwright E2E against production-like browser; product analytics (Plausible / GoatCounter); A/B testing infra; image storage migration from Local FS to Cloudflare R2 (only if disk pressure shows up).

---

## 2. Goals

1. **Single Linux VPS hosts the full stack** via Docker Compose. Services: `app` (Next.js standalone build), `worker` (`node-cron` jobs), `postgres` (Postgres 16), `redis` (Redis 7), `caddy` (reverse proxy + TLS), with three named volumes (`postgres_data`, `media`, `labels`) and shared internal Docker network.
2. **`Dockerfile`** for the Next.js `app` service, multi-stage (deps → builder → runner) producing a `~250 MB` standalone image. Mirrors Next.js 16 docs for `output: 'standalone'`. Worker image already exists from Phase 5 (`Dockerfile.worker`).
3. **Caddy reverse proxy** terminates TLS for `ynotlondon.com` + `www.ynotlondon.com`, automatically obtains and renews Let's Encrypt certs, proxies `/` to `app:3000`, sets HSTS + sane security headers (`X-Content-Type-Options`, `Referrer-Policy`, etc.). One-line Caddyfile per host.
4. **GitHub Actions deploy pipeline** triggered on `push` to `main`: builds Docker images for `app` + `worker`, pushes to `ghcr.io` (private), SSHs to VPS, pulls latest, runs `prisma migrate deploy`, restarts services with zero-downtime via Caddy graceful reload. ~5 minute pipeline; full audit trail in Actions.
5. **Production secrets** in `/etc/ynot/secrets.env` (root:600 perms; mounted into containers via Docker Compose `env_file:`). Includes Stripe Live keys, DHL/RM/Resend production tokens, generated `NEXTAUTH_SECRET` + `ORDER_TOKEN_SECRET` (each from `openssl rand -base64 32`), `DATABASE_URL` with strong Postgres password, `MEDIA_PUBLIC_BASE_URL=https://ynotlondon.com/api/media`. Never in git, never in image.
6. **Build-time env validation fix.** Currently `pnpm build` fails because `src/server/env.ts` Zod schema validates at module-load and Next.js 16 collects page data during build with no env. Add `BUILD_PROD=1` short-circuit in env validator that allows missing required fields when `process.env.BUILD_PROD === '1'`; Dockerfile sets it during the `builder` stage; runtime container does NOT set it, so live runtime still validates strictly.
7. **Zero-downtime deploys.** Two-step within deploy script: (1) build + push image; (2) on VPS, `docker compose pull && docker compose up -d --no-deps app` — Compose performs blue-green swap (start new container, wait healthy, kill old). Caddy upstream pool sees the swap transparently.
8. **Cloudflare proxy in front** of the Lightsail IP. Free plan: orange cloud DNS records (`ynotlondon.com` and `www.ynotlondon.com` both proxied), Universal SSL strict-mode, "Always Use HTTPS" + "Automatic HTTPS Rewrites" turned on, basic WAF managed rules enabled, page rules cache static assets. Lightsail firewall locked to Cloudflare IP ranges only (no direct access from internet).
9. **Daily Postgres backup** via `pg_dump --format=custom` + `gzip`, written to `/var/backups/ynot/postgres/YYYY-MM-DD.dump.gz`, then synced off-VPS to Cloudflare R2 (free tier: 10 GB storage). Retention: last 30 days local + last 90 days remote. Worker container runs the backup cron at `0 3 * * *` UTC (3am London).
10. **Daily media volume backup.** `tar.czf` of `/var/lib/ynot/media` and `/var/lib/ynot/labels` → R2. Smaller volumes (label PDFs only ~50KB each, product images ~500KB each) — full backups feasible long-term.
11. **Sentry for error monitoring.** `@sentry/nextjs` integrated; `NEXT_PUBLIC_SENTRY_DSN` for client + `SENTRY_DSN` for server. Source maps uploaded during build. Free tier: 5k events/month — sufficient for early traffic.
12. **UptimeRobot** for external uptime check. Free plan: 50 monitors, 5-minute interval. Two HTTP(S) monitors: `https://ynotlondon.com` (homepage) + `https://ynotlondon.com/api/health` (existing health endpoint from Phase 1). Email alerts to `ALERT_EMAIL`.
13. **DNS migration is the last step.** Order of operations: (1) deploy works end-to-end on raw Lightsail IP `https://13.135.247.31` (with self-signed cert + `-k`-style override) → (2) Cloudflare gets Lightsail IP as origin → (3) GoDaddy NS records change to Cloudflare's NS → (4) propagation 5 min – 24 h → (5) verify everything still works → (6) Stripe Live keys cutover. Each step independently reversible.
14. **Stripe Live cutover plan.** First production deploy uses Stripe Test keys to verify the live URL + webhook delivery. Then swap `STRIPE_*` env vars to Live keys and update webhook endpoint URL in Stripe Dashboard from `https://stripe.cli/test` (CLI tunnel) → `https://ynotlondon.com/api/webhooks/stripe`. Update webhook signing secret. Done in `<10 minutes` — a dedicated staged rollout in section §11 below.
15. **Health endpoint expansion.** Existing `/api/health` from Phase 1 returns `{ ok: true }`. Phase 8 extends to also return `{ db, redis, version }` for proper liveness/readiness. Caddy uses it as origin healthcheck (passive: failed requests trip circuit).
16. **Deploy user separation.** `ubuntu` user keeps sudo access (initial setup only). Create `ynot` user with no sudo, owns `/srv/ynot/` checkout + Docker socket access. GitHub Actions SSHs as `ynot`, never `ubuntu`. Reduces blast radius if deploy key leaks.
17. **`docs/deploy.md` runbook.** Single doc covering: (a) initial VPS bootstrap (manual once-off), (b) every deploy step the GitHub Action does (so a human can repro without Actions), (c) DNS rollback procedure, (d) DB restore from backup, (e) common ops tasks (logs, container restart, ssh in).
18. **Real-Postgres tests stay green.** No CI changes that break local dev — the new GH Actions workflow runs `pnpm typecheck && pnpm lint && pnpm test && pnpm build` before deploy job; if those fail, deploy never runs. Test count stays at ~950 from Phase 7a.

---

## 3. Non-goals

- ❌ **Multi-server / horizontal scaling.** Single VPS is enough for first 1000 visitors/day. When traffic justifies, migrate to Lightsail container service or k8s; not now.
- ❌ **Database HA / read replicas.** Single Postgres container on the same VPS. If that container dies, recovery from yesterday's backup loses ≤24 h of orders. Acceptable risk for luxury startup with manual order entry as fallback. Phase 9+ revisits if order volume justifies managed RDS.
- ❌ **Blue-green at the VPS level.** Compose-level swap (Goal 7) is enough. Two-VPS blue-green needs load balancer + sticky sessions + DB migration coordination — way overkill at this scale.
- ❌ **Container orchestration (k8s, Nomad, ECS).** Docker Compose is enough.
- ❌ **CDN for `/api/media/*`.** Cloudflare proxy (Goal 8) caches what its WAF allows; bypassing the app for media is a Phase 9+ optimization. `/api/media` route has `Cache-Control: immutable` (Phase 7a) so first hit is from VPS, subsequent from Cloudflare edge.
- ❌ **CI matrix / multi-Node test.** Single Node 22 + Postgres 16 baseline matches local + production.
- ❌ **Pre-prod / staging environment.** Same VPS / same compose. Testing happens locally and in PR review. Spec §11 covers staged rollout in time, not in space.
- ❌ **Rotating Stripe webhook signing secret.** Use the value Stripe Dashboard generates; rotate manually if leaked. Auto-rotation infra is enterprise scale.
- ❌ **Rotating Postgres password.** Strong password generated once at bootstrap, kept in `/etc/ynot/secrets.env`, never logged. Manual rotation if compromised.
- ❌ **AWS Backup / EBS snapshots beyond Lightsail Automatic snapshots.** Lightsail's built-in daily snapshot suffices for instance-level recovery; our Postgres + media R2 backup covers data-level recovery.
- ❌ **OpenTelemetry, distributed tracing, structured log aggregation.** Sentry covers errors; Caddy + Docker logs cover ops. Loki/ELK stack are Phase 9+ if needed.
- ❌ **Deploy queue / lock.** GitHub Actions implicitly serializes by `concurrency:` group; no extra queue needed.
- ❌ **Pre-warming caches.** Storefront has minimal caching (mostly RSC dynamic). Cold start = first hit slow; acceptable.
- ❌ **GDPR cookie consent banner.** Already exists from Phase 8 UI work (storefront commit `e9b6bac` "feat(seo): add CookieBanner mounted globally with consent persistence").
- ❌ **Email tracking / open-rate analytics.** Resend dashboard provides basic metrics; advanced tracking is Phase 9+.
- ❌ **Application performance monitoring (APM).** Sentry's perf snapshots are minimal but enough.
- ❌ **DNSSEC, SPF/DMARC tightening beyond Resend defaults.** Resend manages SPF/DKIM; DMARC is at policy `none` initially, can tighten to `quarantine`/`reject` once email volume confirms zero false positives.

---

## 4. Stack

| Concern | Choice | Rationale |
|---|---|---|
| Hosting | **AWS Lightsail $24/mo (London)** | Decision in brainstorming; 4 GB RAM headroom for app+worker+postgres+redis+caddy on one box. London datacenter = ~5ms latency for UK customers. $100 credit covers ~3.5 months. |
| Reverse proxy + TLS | **Caddy 2** in `caddy:2-alpine` Docker image | Auto Let's Encrypt; one-line Caddyfile per host; reload-on-config-change is trivial. nginx + certbot would work but with 5× more config lines. |
| TLS in Cloudflare-fronted setup | **Cloudflare Full (strict)** between CF↔origin + Caddy's Let's Encrypt cert at origin | "Full (strict)" prevents customer-CF and CF-origin MITM both. Self-signed origin certs are not enough. |
| Container registry | **GitHub Container Registry (`ghcr.io`)** | Free for private repos; integrates with GitHub Actions zero config; `GITHUB_TOKEN` works as auth. Docker Hub free tier limits pulls — irritation for restart loops. |
| CI/CD | **GitHub Actions** | Already where the code lives; free 2000 minutes/month for private repos (sufficient — each deploy ~5 min); secrets management built-in. |
| Image build | **Multi-stage Docker** with Node 22 alpine + Next.js standalone output | ~250 MB final image; deterministic; no leftover devDependencies. |
| Secrets | **`/etc/ynot/secrets.env`** on VPS, root:600, mounted into containers via Compose `env_file:` | Simplest secure storage; doesn't require Vault/SOPS; backed up by Lightsail snapshot only. |
| Backups | **`pg_dump --format=custom` + `tar` for media, both → Cloudflare R2** | R2 free tier covers 10 GB storage + 1M Class B ops/month; $0 egress; vs S3 saves ~$5-10/year on egress at our scale. |
| Monitoring | **Sentry (errors) + UptimeRobot (HTTP uptime)** | Both have free tiers that comfortably cover early launch traffic. Loki/Grafana/Prometheus = Phase 9+. |
| Edge / WAF / CDN | **Cloudflare Free** | Free, must-have; DDoS shield + bot management + global CDN + free SSL = no-brainer. |
| Build-time env handling | **`BUILD_PROD=1` short-circuit in `env.ts` Zod parser** | Surgical: only skips strict validation when explicitly building. Runtime still validates. Avoids `--mode=skip-validation` infrastructure. |
| GitHub Actions runner OS | **`ubuntu-latest`** | Match production = no surprises during build. |
| Deploy access | **GitHub Actions SSHs as `ynot` user** with deploy key | `ynot` user has no sudo; only Docker socket access. Compromised deploy key = container restart, not root takeover. |

---

## 5. Architecture

### 5.1 Topology

```
                         ┌─────────────────────────┐
                         │     Cloudflare Edge     │
                         │  (proxy, CDN, WAF)      │
                         └────────────┬────────────┘
                                      │ Full (strict) TLS
                                      ↓
              ┌───────────────────────────────────────────┐
              │   AWS Lightsail London — Ubuntu 24.04     │
              │      (Public IP 13.135.247.31)            │
              │                                            │
              │   Lightsail Firewall: only 22 from me,    │
              │   80+443 from Cloudflare IPs              │
              │                                            │
              │   ┌────────── Docker Network ──────────┐  │
              │   │                                     │  │
              │   │  caddy ─→ app (Next.js :3000)       │  │
              │   │             ↓                       │  │
              │   │           postgres (5432)           │  │
              │   │             ↑                       │  │
              │   │           redis (6379)              │  │
              │   │             ↑                       │  │
              │   │           worker (cron)             │  │
              │   │                                     │  │
              │   └─────────────────────────────────────┘  │
              │                                            │
              │   Volumes:                                 │
              │     ynot_postgres_data → /var/lib/postgresql/data
              │     ynot_media → /var/lib/ynot/media       │
              │     ynot_labels → /var/lib/ynot/labels     │
              │     caddy_data, caddy_config (TLS certs)   │
              └───────────────────────────────────────────┘
                                      ↓ daily 03:00 UTC
                         ┌─────────────────────────┐
                         │  Cloudflare R2 backups  │
                         │  postgres + media tars  │
                         └─────────────────────────┘

              ┌──────────────────────────────────────────┐
              │          Sentry (errors)                  │
              │          UptimeRobot (HTTP uptime)        │
              │          Resend (transactional email)     │
              │          Stripe (payments + webhooks)     │
              │          DHL + Royal Mail (shipping)      │
              └──────────────────────────────────────────┘
```

### 5.2 Code layout (additions to repo)

```
web/
├── Dockerfile                    ← NEW: multi-stage Next.js standalone image
├── Dockerfile.worker             ← MODIFIED: align with prod env vars
├── docker-compose.yml            ← MODIFIED: replace stub `app:` and `nginx:` with real Caddy + app image refs
├── docker-compose.prod.yml       ← NEW: prod-only overrides (env_file path, no published ports for postgres/redis)
├── caddy/
│   └── Caddyfile                 ← NEW: ynotlondon.com + www
├── docs/
│   └── deploy.md                 ← NEW: runbook for initial bootstrap + deploy + rollback + restore
├── scripts/
│   ├── prod-bootstrap.sh         ← NEW: one-shot VPS init (Docker install, ynot user, dirs, fail2ban, ufw)
│   ├── prod-backup-postgres.sh   ← NEW: pg_dump + R2 sync; runs in worker container daily at 03:00 UTC
│   ├── prod-backup-media.sh      ← NEW: tar + R2 sync; daily at 03:30 UTC
│   ├── prod-restore-postgres.sh  ← NEW: idempotent restore from R2 dump
│   └── env-prod-template.sh      ← NEW: prints expected /etc/ynot/secrets.env shape with empty values
├── .github/
│   └── workflows/
│       ├── ci.yml                ← NEW: pull-request CI (typecheck, lint, test, build)
│       └── deploy.yml            ← NEW: main-branch deploy (build, push, ssh deploy)
└── src/
    ├── server/
    │   └── env.ts                ← MODIFIED: BUILD_PROD short-circuit
    ├── instrumentation.ts        ← MODIFIED or NEW: Sentry init server-side
    └── instrumentation-client.ts ← NEW: Sentry init client-side (Next.js 16 convention)
```

### 5.3 docker-compose.yml — final shape

The current `docker-compose.yml` has `app:` + `nginx:` as `sleep infinity` stubs. Phase 8 replaces them with real services:

- `postgres:` — Postgres 16 alpine; `restart: unless-stopped`; **no host port binding in prod profile**; only volume mount + healthcheck.
- `redis:` — Redis 7 alpine; same shape; **no host port binding in prod**.
- `app:` — `image: ghcr.io/batrbekk/ynot-app:${IMAGE_TAG:-latest}`; `env_file: /etc/ynot/secrets.env`; depends on postgres healthy + redis healthy; volumes: `ynot_media:/var/lib/ynot/media`, `ynot_labels:/var/lib/ynot/labels`; healthcheck against `/api/health`; **no host port binding** (only Caddy talks to it via Docker DNS `app:3000`).
- `worker:` — `image: ghcr.io/batrbekk/ynot-worker:${IMAGE_TAG:-latest}`; `env_file: /etc/ynot/secrets.env`; depends on postgres + redis; volumes for label/media access (worker generates label PDFs).
- `caddy:` — `image: caddy:2-alpine`; `env_file: /etc/ynot/secrets.env` (for `CADDY_LE_EMAIL`); volumes: `./caddy/Caddyfile:/etc/caddy/Caddyfile:ro`, `caddy_data:/data`, `caddy_config:/config`; published ports `80:80` + `443:443`.

`profiles: ["prod"]` on app/worker/caddy. `dev` profile keeps Postgres+Redis with their published ports for local `pnpm dev`.

### 5.4 Caddyfile

```
{
    email hello@ynotlondon.com
}

ynotlondon.com, www.ynotlondon.com {
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

# Redirect non-canonical to canonical
www.ynotlondon.com {
    redir https://ynotlondon.com{uri} permanent
}
```

> Note: The two `ynotlondon.com, www.ynotlondon.com {...}` and `www.ynotlondon.com { redir ... }` blocks above are illustrative; pick one shape — either both hosts proxy together, or `www` redirects to bare. Final spec uses **bare domain canonical** (`ynotlondon.com`), `www` redirects.

---

## 6. Secrets

`/etc/ynot/secrets.env` on VPS (root:600 perms; never in git, never in image):

```env
# Generated once via openssl rand -base64 32
NEXTAUTH_SECRET=<32-byte base64>
ORDER_TOKEN_SECRET=<32-byte base64>

# Postgres (set during bootstrap; password generated via openssl rand -hex 32)
POSTGRES_PASSWORD=<64-hex>
DATABASE_URL=postgresql://ynot:<POSTGRES_PASSWORD>@postgres:5432/ynot_prod?schema=public

# Redis (no auth on internal Docker network — locked by ufw)
REDIS_URL=redis://redis:6379

# Stripe Live (after cutover)
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Royal Mail Click & Drop (production key — same as Phase 5 dev or new prod key)
ROYAL_MAIL_API_KEY=...

# DHL Express (production credentials)
DHL_API_KEY=...
DHL_API_SECRET=...
DHL_ACCOUNT_NUMBER=230200799

# Resend (production)
RESEND_API_KEY=re_...
RESEND_FROM=YNOT London <hello@ynotlondon.com>

# Storage paths (on VPS)
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

# Sentry
SENTRY_DSN=https://...@o000000.ingest.sentry.io/000000
NEXT_PUBLIC_SENTRY_DSN=https://...@o000000.ingest.sentry.io/000000
SENTRY_AUTH_TOKEN=...

# Cloudflare R2 (for backups)
R2_ENDPOINT=https://<account>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=ynot-backups

# Build-time skip flag (NOT set at runtime — only during Docker build stage)
# BUILD_PROD=1
```

GitHub Actions secrets (separate, in repo Settings → Secrets):
- `SSH_PRIVATE_KEY` — deploy key for `ynot@13.135.247.31` user (generated once during bootstrap)
- `SSH_HOST` — `13.135.247.31`
- `SSH_USER` — `ynot`
- `GHCR_PAT` — Personal Access Token with `write:packages` scope (push images to ghcr.io)

---

## 7. Build-time env validator fix

Current `src/server/env.ts` (simplified):

```ts
export const env = z.object({ /* ... */ }).parse(process.env);
```

This explodes during `next build` because Stripe/RM/DHL keys aren't set. Phase 8 patch:

```ts
const SKIP = process.env.BUILD_PROD === '1';

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  // ... full schema as today ...
});

export const env = SKIP
  ? schema.partial().parse(process.env)   // accept missing required fields
  : schema.parse(process.env);            // strict: missing keys throw
```

`Dockerfile` builder stage:

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile
ENV BUILD_PROD=1
RUN pnpm prisma generate && pnpm build
```

Runtime stage does **not** set `BUILD_PROD`, so `env.ts` runs the strict schema at app startup and crashes early on misconfig — exactly what we want.

---

## 8. Lightsail firewall + ufw

### 8.1 Lightsail console firewall (instance Networking tab)

- TCP **22** — restrict to **My IP** (operator's home IP); update if home IP changes
- TCP **80** — restrict to **Cloudflare IPv4 ranges** (15 CIDRs published at https://www.cloudflare.com/ips-v4)
- TCP **443** — same as 80
- TCP **6** (ICMP) — allow for ping
- All other inbound — denied by default

### 8.2 ufw on the VPS (defence in depth)

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

> Belt-and-suspenders: even if Lightsail firewall misconfigures, ufw stays. fail2ban added for SSH brute-force protection.

---

## 9. CI/CD pipeline

### 9.1 `.github/workflows/ci.yml` — runs on every PR

```yaml
name: CI
on:
  pull_request:
    branches: [main]

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
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U ynot"
          --health-interval 5s --health-retries 10
      redis:
        image: redis:7-alpine
        ports: ["6379:6379"]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'
          cache-dependency-path: web/pnpm-lock.yaml
      - working-directory: web
        run: |
          pnpm install --frozen-lockfile
          cp .env.example .env.test
          pnpm prisma migrate deploy
          pnpm typecheck
          pnpm lint
          pnpm test
          BUILD_PROD=1 pnpm build
```

### 9.2 `.github/workflows/deploy.yml` — runs on push to `main`

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
        run: echo "tag=${GITHUB_SHA::12}" >> $GITHUB_OUTPUT
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v5
        with:
          context: web
          file: web/Dockerfile
          tags: |
            ghcr.io/batrbekk/ynot-app:${{ steps.meta.outputs.tag }}
            ghcr.io/batrbekk/ynot-app:latest
          push: true
          cache-from: type=gha
          cache-to: type=gha,mode=max
      - uses: docker/build-push-action@v5
        with:
          context: web
          file: web/Dockerfile.worker
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
      - uses: webfactory/ssh-agent@v0.9.0
        with:
          ssh-private-key: ${{ secrets.SSH_PRIVATE_KEY }}
      - run: |
          ssh -o StrictHostKeyChecking=accept-new ${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }} <<EOF
            set -euo pipefail
            cd /srv/ynot/web
            git fetch origin main
            git reset --hard origin/main
            export IMAGE_TAG=${{ needs.build-and-push.outputs.image_tag }}
            docker compose --profile prod pull
            docker compose --profile prod run --rm app pnpm prisma migrate deploy
            docker compose --profile prod up -d --no-deps --remove-orphans app worker caddy
            sleep 10
            curl -fsSL https://ynotlondon.com/api/health
          EOF
```

### 9.3 Rollback

`git revert <bad-sha>` + `git push origin main` → re-runs deploy with previous image. ~5 min total.

For emergency: `ssh ynot-prod` → `cd /srv/ynot/web && IMAGE_TAG=<previous-good-sha> docker compose --profile prod up -d`. Direct Docker image-tag override; bypasses migration replay if needed.

---

## 10. Backups + restore

### 10.1 Postgres daily backup

`scripts/prod-backup-postgres.sh` invoked at 03:00 UTC by worker container's cron:

```bash
#!/usr/bin/env bash
set -euo pipefail
DATE=$(date -u +%F)
DUMP_FILE="/var/backups/ynot/postgres/${DATE}.dump"
mkdir -p "$(dirname "$DUMP_FILE")"
docker exec ynot-postgres pg_dump -U ynot -F custom -f "$DUMP_FILE" ynot_prod
gzip -9 "$DUMP_FILE"
aws s3 cp "${DUMP_FILE}.gz" "s3://${R2_BUCKET}/postgres/${DATE}.dump.gz" \
  --endpoint-url "$R2_ENDPOINT"
# Retention: keep last 30 local + 90 remote
find /var/backups/ynot/postgres -name '*.dump.gz' -mtime +30 -delete
```

Worker's `node-cron` calls this via `child_process.exec` daily.

### 10.2 Media + labels daily backup

`scripts/prod-backup-media.sh` at 03:30 UTC:

```bash
#!/usr/bin/env bash
set -euo pipefail
DATE=$(date -u +%F)
TAR_FILE="/var/backups/ynot/media/${DATE}.tar.gz"
mkdir -p "$(dirname "$TAR_FILE")"
tar -czf "$TAR_FILE" /var/lib/ynot/media /var/lib/ynot/labels
aws s3 cp "$TAR_FILE" "s3://${R2_BUCKET}/media/${DATE}.tar.gz" \
  --endpoint-url "$R2_ENDPOINT"
find /var/backups/ynot/media -name '*.tar.gz' -mtime +14 -delete
```

### 10.3 Restore

Documented in `docs/deploy.md`. Quick path:

```bash
ssh ynot-prod
cd /srv/ynot/web

# Postgres restore from R2
aws s3 cp s3://ynot-backups/postgres/2026-05-04.dump.gz . --endpoint-url $R2_ENDPOINT
gunzip 2026-05-04.dump.gz
docker compose --profile prod stop app worker
docker exec -i ynot-postgres pg_restore -U ynot -d ynot_prod --clean < 2026-05-04.dump
docker compose --profile prod start app worker

# Media restore
aws s3 cp s3://ynot-backups/media/2026-05-04.tar.gz . --endpoint-url $R2_ENDPOINT
tar -xzf 2026-05-04.tar.gz -C /
```

---

## 11. Cutover plan — staged rollout

Order of operations, each step independently verifiable + reversible:

### Stage A — Server bootstrap (no customer impact)
1. SSH to fresh VPS (today: ✅ already done).
2. Run `scripts/prod-bootstrap.sh` — installs Docker, creates `ynot` user, generates SSH deploy key, sets up firewall, creates `/etc/ynot/secrets.env` skeleton.
3. Operator fills `/etc/ynot/secrets.env` with **TEST** Stripe + DHL/RM credentials (still safe to use Stripe Test mode, swap to Live in Stage E).
4. Verify by SSH'ing in and confirming the file exists with correct perms.

### Stage B — First successful deploy (no DNS, raw IP)
1. Manually trigger first GitHub Actions workflow on `main` (already at `25c9684` after Phase 7a merge).
2. Build pushes images to ghcr.io, deploy job SSHs in, runs migrate, starts services.
3. Verify `https://13.135.247.31/api/health` returns `{ ok: true, db: 'up', redis: 'up' }` from `curl -k` (self-signed cert at this stage).
4. Visit storefront via `curl -k -H "Host: ynotlondon.com" https://13.135.247.31/` and confirm HTML returned.
5. Rollback path: if anything broken, `git reset --hard <prev>` + push triggers re-deploy.

### Stage C — Cloudflare in front, still test mode
1. Sign up Cloudflare; add `ynotlondon.com` site (Free plan).
2. Cloudflare auto-detects existing GoDaddy DNS records and copies them. Manually edit:
   - `A @` → `13.135.247.31` (Cloudflare proxy ON — orange cloud)
   - `A www` → `13.135.247.31` (orange cloud)
3. SSL/TLS mode → **Full (strict)**.
4. **DON'T change GoDaddy nameservers yet** — site is still served by GoDaddy's DNS at this point; Cloudflare records are dormant.
5. Configure Cloudflare:
   - Always Use HTTPS = ON
   - Automatic HTTPS Rewrites = ON
   - Brotli compression = ON
   - WAF Managed Rules = enabled (default rule set)
6. Test by overriding `ynotlondon.com` in `/etc/hosts` to point at one of Cloudflare's IPs, hit https — should serve our app via Cloudflare without DNS migration.

### Stage D — DNS migration on GoDaddy
1. Inside Cloudflare, copy the two nameservers it assigns (e.g., `kim.ns.cloudflare.com`, `bob.ns.cloudflare.com`).
2. GoDaddy → `Domains` → `ynotlondon.com` → `DNS` → `Nameservers` → change from default GoDaddy NS to Cloudflare's two NS values.
3. Save. Propagation: 5 min – 24 h (usually <1h for GoDaddy → Cloudflare).
4. Verify with `dig ns ynotlondon.com` showing Cloudflare nameservers.
5. After propagation, hitting `https://ynotlondon.com` from any browser globally = served by Cloudflare → AWS Lightsail → app.
6. **Site is technically live but in Stripe Test mode.** Customers cannot actually transact yet.

### Stage E — Stripe Live cutover
1. Stripe Dashboard → switch from Test to Live mode.
2. Generate Live keys: `sk_live_*`, `pk_live_*`.
3. Stripe Dashboard → Developers → Webhooks → Add endpoint:
   - URL: `https://ynotlondon.com/api/webhooks/stripe`
   - Events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`
   - Save → reveals signing secret `whsec_*`
4. Update `/etc/ynot/secrets.env` with the three new values; do **NOT** touch the file directly via SSH — instead:
   - Edit local copy of the secrets file template
   - `scp /tmp/secrets.env ynot-prod:/tmp/secrets.env.new`
   - `ssh ynot-prod 'sudo install -o root -g root -m 600 /tmp/secrets.env.new /etc/ynot/secrets.env && rm /tmp/secrets.env.new'`
5. Trigger a deploy (push a small no-op commit OR manually `docker compose restart`) to pick up new env.
6. **Smoke test: real card transaction.**
   - Place a £1 test order (real card, real charge) — verify it completes end-to-end: order → Stripe → webhook → email → admin order page.
   - Refund the £1 immediately via admin panel — verify refund email + Stripe Live refund.
7. If smoke fails: revert `/etc/ynot/secrets.env` to Test keys (keep backup), restart, debug.

### Stage F — Open for business
1. Update `web/docs/manual-qa.md` Phase 8 manual QA section with smoke results.
2. Tweet/announce/whatever — first real customer can buy.

---

## 12. Failure handling

| Failure | Detection | Recovery |
|---|---|---|
| GitHub Actions deploy fails at build | Action workflow red ❌ | Fix code, push again. Production unaffected (no deploy yet). |
| Deploy succeeds but new container unhealthy | Caddy `health_uri` fails; Compose's `up -d` returns non-zero in our pipeline; smoke `curl /api/health` after deploy returns non-2xx | Pipeline fails; old container still running (Compose hasn't killed old until new is healthy on `--no-deps`). Operator: `git revert` + redeploy. |
| Postgres container crashes | Caddy 502 + `/api/health` returns `{db: 'down'}`; Sentry alert on connection errors | Lightsail snapshot restore is last-resort; usually `docker restart ynot-postgres` is enough. |
| Lightsail VPS dies entirely | UptimeRobot alert (5-minute interval) | Lightsail console → Restart instance. If disk corrupt, restore from automatic snapshot (max 24h data loss). Restore Postgres + media from R2 backup. |
| Stripe webhook delivery fails | Stripe Dashboard webhook attempts page red | Cloudflare WAF may have blocked Stripe IPs — whitelist Stripe IP ranges in Cloudflare WAF. |
| Cloudflare goes down | Customers see 522/523 errors | Cloudflare dashboard → temporarily set DNS records to "DNS only" (grey cloud) — exposes Lightsail directly until CF recovers. |
| Disk fills up (media accumulating) | Lightsail metric alerts at 80%; manual `df -h` | Add new Lightsail block storage (50 GB, $5/mo); migrate media volume; or set up R2 storage backend (Phase 7a interface ready) and prune local. |
| Lightsail snapshot scheduled-fails | Lightsail console shows red | Manual snapshot `aws lightsail create-instance-snapshot` from local terminal. |
| `/etc/ynot/secrets.env` accidentally `git add`-ed | n/a (file isn't in the repo) | Verify `.gitignore` includes `*.env` (already is); `pnpm git-hooks` includes pre-commit secret scanner (out of Phase 8 scope). |
| Stripe Live key leaked publicly | Operator notices on grep / GitHub secret scan alert | Stripe Dashboard → roll the key; update `/etc/ynot/secrets.env`; `docker compose restart app worker`. ~5 min. |

---

## 13. Costs

Annualised (post-credit, ~Aug 2026 onward):

| Line | Annual | Notes |
|---|---|---|
| Lightsail $24/mo | $288 | London, 4GB RAM |
| Lightsail snapshots | $48 | $4/mo |
| Cloudflare R2 backup storage | $0 | <10GB usage on free tier |
| GitHub Actions | $0 | <2000 min/mo on free tier |
| GitHub Container Registry | $0 | private repos free |
| Cloudflare Free | $0 | DDoS + CDN + DNS |
| Domain (GoDaddy) | $20 | renewal annual |
| Sentry Free | $0 | <5k events/month |
| UptimeRobot Free | $0 | 50 monitors, 5-min intervals |
| Stripe (variable, transactional) | varies | 1.5% + £0.20 per UK card; 2.5% + £0.20 EU/Intl |
| **Total infra** | **~$356 (~£280)/year** | excluding Stripe transaction fees |

First 3.5 months covered by $100 AWS credit → **~$0 until ~Aug 2026**.

---

## 14. Definition of done

Phase 8 is complete when:

1. ✅ `pnpm typecheck && pnpm lint && pnpm test` all green on `main`.
2. ✅ `pnpm build` (with `BUILD_PROD=1`) succeeds.
3. ✅ `https://ynotlondon.com` serves the storefront homepage with valid Cloudflare-issued cert (browser shows green padlock).
4. ✅ `https://ynotlondon.com/api/health` returns `{ ok: true, db: 'up', redis: 'up', version: '<git-sha>' }`.
5. ✅ Stripe Test card → checkout → success page → real OrderReceipt email arrives in inbox → admin order detail shows the order.
6. ✅ Stripe Live card → repeat above with real £1 → refund via admin → £1 returned to card.
7. ✅ Resend email sent from `hello@ynotlondon.com` lands in customer inbox (not spam).
8. ✅ Daily Postgres backup file appears in R2 bucket within 24h of cutover.
9. ✅ UptimeRobot dashboard shows green for both monitors.
10. ✅ Sentry dashboard shows no critical errors after 24h of live traffic.
11. ✅ `docs/deploy.md` runbook is complete and a fresh operator could rebuild from scratch using only it.
12. ✅ Stripe Dashboard webhook delivery shows successful events (no failed deliveries).
13. ✅ Lightsail Automatic Snapshots are enabled and the first daily snapshot has been taken.
14. ✅ Cloudflare WAF dashboard shows zero customer-blocking false positives in first 24h.
15. ✅ `git push` to `main` triggers a successful deploy end-to-end without operator intervention.
16. ✅ A smoke-test customer (Жансая on her phone, real network) can place a £1 order and receive the confirmation email + tracking number.

Once all 16 boxes ticked, YNOT is **open for business**.
