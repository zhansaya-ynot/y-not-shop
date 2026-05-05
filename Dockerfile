# syntax=docker/dockerfile:1.7
# Phase 8 — multi-stage Next.js standalone build.
#
# Stages:
#   base    — node:22-alpine + corepack (so `pnpm` resolves)
#   deps    — install all dependencies (dev + prod) for the builder
#   builder — `pnpm build` with BUILD_PROD=1 so env validation short-circuits;
#             emits .next/standalone and .next/static
#   runner  — minimal runtime: standalone bundle + Prisma client + curl for
#             container HEALTHCHECK
#
# Final image targets ~250 MB. Built via:
#   docker build -t ynot-app:dev -f Dockerfile .

FROM node:22-alpine AS base
# Prisma's query engine is dynamically linked against OpenSSL — Alpine 3.18+
# only ships OpenSSL 3.x, and `libc6-compat` keeps glibc-targeted binaries happy.
RUN apk add --no-cache openssl libc6-compat \
    && corepack enable
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
# Sentry source-map upload — when this build-arg is provided, @sentry/nextjs's
# webpack plugin uploads source maps to Sentry during `pnpm build`. Empty string
# (the default) is a no-op: build still succeeds, source maps just aren't shipped.
# CI passes the real token via `docker build --build-arg SENTRY_AUTH_TOKEN=...`.
ARG SENTRY_AUTH_TOKEN=""
ENV SENTRY_AUTH_TOKEN=${SENTRY_AUTH_TOKEN}
# Build-time stubs: BUILD_PROD=1 already short-circuits the env validator, but
# Stripe + downstream SDKs eagerly call `new Stripe(key)` at module load during
# Next.js page-data collection. These dummy keys are *not* baked into runtime
# env (the runner stage drops them) — runtime values come from
# /etc/ynot/secrets.env via Compose env_file.
ENV STRIPE_SECRET_KEY=sk_test_build_stub
ENV NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_build_stub
ENV STRIPE_WEBHOOK_SECRET=whsec_build_stub
ENV NEXTAUTH_SECRET=build_stub_nextauth_secret_at_least_32_chars_long
ENV ORDER_TOKEN_SECRET=build_stub_order_token_secret_at_least_32_chars
ENV NEXT_PUBLIC_SITE_URL=https://ynotlondon.com
ENV DATABASE_URL=postgresql://stub:stub@buildonly:5432/stub
ENV REDIS_URL=redis://buildonly:6379
RUN pnpm prisma generate
RUN pnpm build

# ---- runner stage: only what runtime needs ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Bind the standalone server to all interfaces (default would be Docker's
# container hostname → only the assigned IP listens, so curl localhost fails
# both for the HEALTHCHECK and Caddy's reverse_proxy).
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
# `curl` for the HEALTHCHECK; `openssl` + `libc6-compat` for the Prisma engine.
RUN apk add --no-cache curl openssl libc6-compat

# Next.js standalone artefacts. The standalone bundler already traces Prisma
# query engines into .next/standalone/node_modules/.pnpm/@prisma+client*/...,
# so the runner needs no extra COPY for the runtime client.
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Prisma CLI for `prisma migrate deploy` on container start. The CLI is a
# devDep so it is *not* in the traced standalone bundle. Use `npm i -g` here
# (rather than copying pnpm's symlink graph) — adds ~25 MB but the resulting
# `prisma` binary is on PATH and works without pnpm's machinery.
RUN npm install -g prisma@5.22.0
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -fsSL http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
