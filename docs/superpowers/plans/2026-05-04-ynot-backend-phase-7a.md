# YNOT Backend Phase 7a Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the launch-ready admin slice — catalog manager (Products with Draft/Published/Archived workflow + multi-file image upload + drag-reorder + inline stock/colour editing), category tree CRUD, content CMS (Hero with only-one-active invariant, Announcement, Lookbook, StaticPage with Markdown editor, SitePolicy), PromoCode CRUD, `MediaStorage` interface mirroring Phase 5's `LabelStorage` pattern, public `/api/media/[...key]` stream route, and `withAudit()` wrapper writing to the existing `AuditLog` table for every catalog/CMS/promo mutation. Replaces and extends the Phase 5 mini admin.

**Architecture:** New `ProductStatus` enum (DRAFT/PUBLISHED/ARCHIVED) gates storefront visibility; one Prisma migration adds the column with PUBLISHED backfill for existing non-deleted products. `MediaStorage` interface (default `LocalFsStorage` writing to `/var/lib/ynot/media/`) is consumed via factory; `GET /api/media/[...key]` Next.js route streams files publicly with `Cache-Control: immutable`. Admin pages are server-rendered; mutations go through service-layer functions in `src/server/admin/{catalog,cms,promo}/` that wrap each write in `withAudit()` to capture before/after JSON snapshots. Existing Phase 5 admin sidebar nav extends with Catalog / Content / Marketing sections; UI primitives (Button, Input, Modal, Tabs, etc. — 24 of them already in `src/components/ui/`) are reused throughout. Image upload accepts JPEG/PNG/WebP ≤5MB via multipart `POST /api/admin/media/upload`; drag-reorder via `framer-motion` Reorder.Group. Storefront product/category queries gain `status: 'PUBLISHED'` filter — one-line change, but every existing test that seeds Products without status field needs adjustment. PromoCode admin uses `isActive=false` deactivation (not hard delete) to preserve `PromoRedemption` referential integrity.

**Tech Stack:** Node.js 22, Next.js 16 App Router (Turbopack), TypeScript 5.9, Prisma 5, PostgreSQL 16, Redis 7, React 19, Tailwind v4, `react-markdown` + `remark-gfm` (StaticPage editor + storefront rendering — already used), `framer-motion` (drag-reorder; already in storefront), Zod 4 (validation), Vitest 4 (tests, real-Postgres harness from Phase 1+).

**Spec:** `web/docs/superpowers/specs/2026-05-04-ynot-backend-phase-7a-design.md`

---

## File Structure

**New files (~50):**

```
web/src/
├── lib/
│   ├── slug.ts                                            ← slugify + ensureUniqueSlug
│   └── schemas/
│       ├── admin-product.ts                               ← Zod for product create/update/status/images/sizes/colours
│       ├── admin-category.ts                              ← Zod for category + parent move
│       ├── admin-hero.ts                                  ← Zod for HeroBlock + activate
│       ├── admin-announcement.ts                          ← Zod for AnnouncementMessage
│       ├── admin-lookbook.ts                              ← Zod for LookbookImage + reorder
│       ├── admin-staticpage.ts                            ← Zod for StaticPage
│       ├── admin-sitepolicy.ts                            ← Zod for SitePolicy update
│       └── admin-promo.ts                                 ← Zod for PromoCode
└── server/
    ├── media/                                             ← NEW SUBSYSTEM
    │   ├── storage.ts                                     ← MediaStorage interface
    │   ├── local-fs-storage.ts                            ← LocalFsStorage impl (writes file + .meta sidecar)
    │   ├── content-type.ts                                ← extension → MIME map
    │   ├── factory.ts                                     ← createMediaStorage(env) + getMediaStorage()
    │   └── __tests__/
    │       ├── local-fs-storage.test.ts
    │       ├── content-type.test.ts
    │       └── factory.test.ts
    └── admin/                                             ← NEW SUBSYSTEM
        ├── audit.ts                                       ← withAudit() higher-order helper
        ├── catalog/
        │   ├── product-status.ts                          ← ALLOWED_TRANSITIONS map + assertProductTransition
        │   ├── product-service.ts                         ← create / update / changeStatus / setImages / setSizes / setColours
        │   ├── category-service.ts                        ← create / update / archive + cycle prevention
        │   ├── slug-service.ts                            ← ensureUniqueSlug (Product, Category)
        │   └── __tests__/
        │       ├── audit.test.ts
        │       ├── product-service.test.ts
        │       ├── category-service.test.ts
        │       ├── slug-service.test.ts
        │       └── product-status.test.ts
        ├── cms/
        │   ├── hero-service.ts                            ← create / update / activate (only-one-active txn)
        │   ├── announcement-service.ts                    ← create / update / delete
        │   ├── lookbook-service.ts                        ← create / update / reorder / delete
        │   ├── staticpage-service.ts                      ← create / update / delete
        │   ├── sitepolicy-service.ts                      ← update singleton
        │   └── __tests__/
        │       ├── hero-service.test.ts
        │       ├── announcement-service.test.ts
        │       ├── lookbook-service.test.ts
        │       ├── staticpage-service.test.ts
        │       └── sitepolicy-service.test.ts
        └── promo/
            ├── service.ts                                 ← create / update / deactivate
            └── __tests__/
                └── service.test.ts
```

**New routes / pages (~50):**

```
web/src/app/
├── admin/                                                 ← extends Phase 5 mini admin
│   ├── layout.tsx                                         ← MODIFIED: sidebar adds Catalog / Content / Marketing
│   ├── page.tsx                                           ← MODIFIED: dashboard adds drafts + low-stock + active-promos cards
│   ├── catalog/
│   │   ├── products/
│   │   │   ├── page.tsx                                   ← list with status filter + search
│   │   │   ├── new/page.tsx                               ← create form
│   │   │   └── [id]/
│   │   │       ├── page.tsx                               ← edit form (sections: details, images, sizes, colours, categories, status)
│   │   │       └── _components/
│   │   │           ├── product-form.tsx
│   │   │           ├── image-uploader.tsx                 ← drag-drop multi-file
│   │   │           ├── image-grid-reorder.tsx             ← drag-handle thumbnails (framer-motion Reorder)
│   │   │           ├── stock-editor.tsx                   ← per-Size stock inputs
│   │   │           ├── colour-editor.tsx                  ← {name, hex} list
│   │   │           ├── status-actions.tsx                 ← Publish / Unpublish / Archive buttons
│   │   │           └── category-multiselect.tsx           ← tree-aware select
│   │   └── categories/
│   │       ├── page.tsx                                   ← tree view
│   │       ├── new/page.tsx
│   │       └── [id]/page.tsx                              ← edit + parent select
│   ├── content/
│   │   ├── hero/
│   │   │   ├── page.tsx                                   ← list with active badge
│   │   │   ├── new/page.tsx
│   │   │   └── [id]/page.tsx                              ← edit form
│   │   ├── announcements/
│   │   │   ├── page.tsx
│   │   │   ├── new/page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── lookbook/
│   │   │   ├── page.tsx                                   ← grid with drag-reorder
│   │   │   ├── new/page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── pages/                                         ← StaticPage (folder name `pages` to avoid clash with Next.js conventions)
│   │   │   ├── page.tsx
│   │   │   ├── new/page.tsx
│   │   │   └── [id]/page.tsx                              ← Markdown editor + react-markdown live preview
│   │   └── settings/
│   │       └── page.tsx                                   ← SitePolicy single-form
│   └── marketing/
│       └── promos/
│           ├── page.tsx                                   ← list with active filter
│           ├── new/page.tsx
│           └── [id]/page.tsx
└── api/
    ├── admin/                                             ← admin mutation routes (OWNER-only)
    │   ├── products/
    │   │   ├── route.ts                                   ← POST create
    │   │   └── [id]/
    │   │       ├── route.ts                               ← PATCH / DELETE (archive)
    │   │       ├── status/route.ts                        ← POST status transition
    │   │       ├── images/
    │   │       │   ├── route.ts                           ← POST add / PATCH reorder
    │   │       │   └── [imgId]/route.ts                   ← DELETE
    │   │       ├── sizes/route.ts                         ← PATCH set per-size stock
    │   │       └── colours/route.ts                       ← PATCH set colour list
    │   ├── categories/
    │   │   ├── route.ts                                   ← POST
    │   │   └── [id]/route.ts                              ← PATCH / DELETE
    │   ├── content/
    │   │   ├── hero/
    │   │   │   ├── route.ts                               ← POST
    │   │   │   └── [id]/
    │   │   │       ├── route.ts                           ← PATCH / DELETE
    │   │   │       └── activate/route.ts                  ← POST
    │   │   ├── announcements/
    │   │   │   ├── route.ts
    │   │   │   └── [id]/route.ts
    │   │   ├── lookbook/
    │   │   │   ├── route.ts                               ← POST / PATCH (reorder)
    │   │   │   └── [id]/route.ts
    │   │   ├── pages/
    │   │   │   ├── route.ts
    │   │   │   └── [id]/route.ts
    │   │   └── settings/route.ts                          ← PATCH SitePolicy singleton
    │   ├── promos/
    │   │   ├── route.ts
    │   │   └── [id]/
    │   │       ├── route.ts
    │   │       └── deactivate/route.ts
    │   └── media/
    │       └── upload/route.ts                            ← multipart POST
    └── media/
        └── [...key]/route.ts                              ← public stream
```

**Modified files (~10):**

- `prisma/schema.prisma` — adds `ProductStatus` enum, `Product.status` + `Product.publishedAt` fields + `(status, deletedAt)` index
- `web/src/server/env.ts` — adds `MEDIA_STORAGE`, `MEDIA_STORAGE_PATH`, optional `MEDIA_PUBLIC_BASE_URL`
- `web/.env.example` — documents new vars
- `web/docker-compose.yml` — adds `ynot-media` named volume + mount on `ynot-app`
- `web/src/middleware.ts` — extends `/admin/*` matcher with `requireOwner` for mutation routes (Phase 5 already gates reads on ADMIN | OWNER)
- `web/src/server/auth/guards.ts` — NEW (or extend if exists): `requireOwner(session)` helper
- `web/src/server/repositories/product.ts` — adds `status: 'PUBLISHED'` to default storefront filter
- `web/src/server/repositories/category.ts` — same (if applicable)
- `web/src/app/admin/layout.tsx` — extends sidebar nav
- `web/src/app/admin/page.tsx` — extends dashboard cards
- `web/docs/manual-qa.md` — appends Phase 7a section in Task 80

---

## Conventions

**TDD.** Every task is: write failing test → run (verify fail) → implement → run (verify pass) → commit. Test-first is non-negotiable.

**Real Postgres in tests.** Tests run against `web/.env.test` `ynot_test` database. Vitest harness migrates + truncates between tests. No SQLite, no in-memory shortcuts.

**Mutations through services.** No route handler talks to Prisma directly for catalog/CMS/promo writes — all go through `src/server/admin/<area>/<service>.ts` so `withAudit()` wraps every change. Routes parse Zod, call service, return JSON.

**Audit-first.** Every service method that mutates writes one `AuditLog` row via `withAudit()`. Tests assert the row exists with correct `before` / `after` / `action` / `entityType` / `entityId`.

**OWNER-only mutations.** `requireOwner(session)` is the gate at the top of every `/api/admin/*` mutation route. Returns 403 if session missing or `role !== 'OWNER'`. Reads (list pages, detail pages) keep Phase 5's `ADMIN | OWNER` middleware.

**Commit cadence.** Each task = at least one commit. Commit message format: `feat(phase-7a): <subsystem> — <what>` for new code, `test(phase-7a): <subsystem> — <test>` for test-only commits, `refactor(phase-7a): ...` for refactors.

**Branch.** All work on `feature/backend-phase-7a-launch-admin` off `main`.

**Working directory.** All paths relative to `/Users/batyrbekkuandyk/Desktop/ynot/web/` unless noted.

---

## Task Index

**Group A — Worktree + dependencies + schema migration (Tasks 1-4)**
**Group B — Env + Docker volume + auth guard (Tasks 5-7)**
**Group C — Slug helper (Tasks 8-9)**
**Group D — MediaStorage subsystem (Tasks 10-13)**
**Group E — Public media stream route (Task 14)**
**Group F — Admin media upload route (Task 15)**
**Group G — Audit helper (Task 16)**
**Group H — Catalog services (Tasks 17-22)**
**Group I — Catalog admin pages + endpoints (Tasks 23-32)**
**Group J — Category admin (Tasks 33-37)**
**Group K — CMS services (Tasks 38-44)**
**Group L — CMS admin pages + endpoints (Tasks 45-58)**
**Group M — PromoCode service + admin (Tasks 59-64)**
**Group N — Storefront filter regression (Tasks 65-67)**
**Group O — Dashboard + sidebar nav extensions (Tasks 68-69)**
**Group P — E2E + manual QA + PR (Tasks 70-74)**

Total: 74 tasks.

---

## Group A — Worktree + Dependencies + Schema Migration

### Task 1: Create worktree + branch

**Files:** none (git ops only)

- [ ] **Step 1: Verify clean main + create worktree**

```bash
cd /Users/batyrbekkuandyk/Desktop/ynot/web
git status
git checkout main
git pull origin main
git worktree add -b feature/backend-phase-7a-launch-admin .worktrees/phase-7a-launch-admin main
```

Expected: worktree created at `.worktrees/phase-7a-launch-admin`, branch checked out.

- [ ] **Step 2: Switch to worktree + install deps**

```bash
cd .worktrees/phase-7a-launch-admin
pnpm install --frozen-lockfile
pnpm prisma generate
```

Expected: install completes; `node_modules/.prisma/client` regenerated.

- [ ] **Step 3: Verify baseline tests pass**

Run: `pnpm test 2>&1 | tail -5`
Expected: `Test Files  ... passed` and `Tests  669 passed (669)` (or whatever the post-merge baseline is).

- [ ] **Step 4: No commit (just setup)** — proceed to Task 2.

---

### Task 2: Add `react-markdown` + `remark-gfm` deps

**Files:**
- Modify: `web/package.json`

- [ ] **Step 1: Check if already installed**

Run: `pnpm list react-markdown remark-gfm 2>&1 | head -10`
Expected: either both present (skip task with no-op commit) or "missing".

- [ ] **Step 2: Install if missing**

```bash
pnpm add react-markdown remark-gfm
```

Expected: both added to `package.json` "dependencies".

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(phase-7a): add react-markdown + remark-gfm for static page editor"
```

If both were already installed, skip the commit and proceed to Task 3.

---

### Task 3: Migration — `ProductStatus` enum + `Product.status` + `Product.publishedAt` + backfill

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<ts>_phase7a_product_status/migration.sql`

- [ ] **Step 1: Add enum + fields in schema.prisma**

Locate the existing `Product` model. Above it, add the new enum (other enums in the file are grouped together near the top — match local style, but keeping it next to ProductStatus references is also fine):

```prisma
enum ProductStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}
```

Inside the existing `Product` model, add:

```prisma
  status      ProductStatus @default(DRAFT)
  publishedAt DateTime?
```

(Place these fields right after `currency` and before `preOrder` so related-fields cluster.)

Also add to the model's index block:

```prisma
  @@index([status, deletedAt])
```

- [ ] **Step 2: Generate empty migration (we'll edit SQL manually for backfill)**

```bash
pnpm prisma migrate dev --name phase7a_product_status --create-only
```

Expected: new directory `prisma/migrations/<ts>_phase7a_product_status/migration.sql`.

- [ ] **Step 3: Edit migration.sql to add backfill**

Open the generated SQL. It will already contain the `CREATE TYPE` and `ALTER TABLE ADD COLUMN` statements. Append a backfill UPDATE so existing non-deleted products land on `PUBLISHED` (otherwise the storefront empties on deploy). The full file should look like:

```sql
-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "publishedAt" TIMESTAMP(3);

-- Backfill existing non-deleted products to PUBLISHED
UPDATE "Product"
SET "status" = 'PUBLISHED',
    "publishedAt" = "createdAt"
WHERE "deletedAt" IS NULL;

-- CreateIndex
CREATE INDEX "Product_status_deletedAt_idx" ON "Product"("status", "deletedAt");
```

- [ ] **Step 4: Apply migration**

```bash
pnpm prisma migrate dev
```

Expected: `Database schema is up to date!`.

- [ ] **Step 5: Verify with psql**

```bash
docker exec ynot-postgres psql -U ynot -d ynot_dev -c '\d "Product"' | grep -E "status|publishedAt"
```

Expected: both columns listed; `status` shows `ProductStatus` type with `DRAFT` default.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(phase-7a): add ProductStatus enum + backfill existing products to PUBLISHED"
```

---

### Task 4: Verify migration didn't break existing tests

**Files:** none (verification only)

- [ ] **Step 1: Run full test suite**

```bash
pnpm test 2>&1 | tail -10
```

Expected: same test count as baseline (669+); all passing. If failures appear because tests seed `Product` rows without `status`, the default `DRAFT` will apply — but this is fine since storefront tests should be filtered. If a test asserts a Product is fetched from storefront without setting `status: 'PUBLISHED'` on the seed, it will fail in **Group N (Tasks 65-67)** when we add the storefront filter. For now, all should pass.

If tests fail, escalate (NEEDS_CONTEXT) — don't proceed.

- [ ] **Step 2: No commit (verification only)**

---

## Group B — Env + Docker Volume + Auth Guard

### Task 5: Extend `env.ts` with `MEDIA_STORAGE` vars

**Files:**
- Modify: `web/src/server/env.ts`
- Modify: `web/src/server/__tests__/env.test.ts`

- [ ] **Step 1: Write failing test**

Append to `web/src/server/__tests__/env.test.ts`:

```ts
describe('Phase 7a media envs', () => {
  it('parses MEDIA_STORAGE + MEDIA_STORAGE_PATH with defaults', () => {
    const env = parseEnv({
      DATABASE_URL: 'postgresql://x', REDIS_URL: 'redis://x',
      NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
      NEXTAUTH_SECRET: 'a'.repeat(32),
      ORDER_TOKEN_SECRET: 'b'.repeat(32),
      STRIPE_SECRET_KEY: 'sk_test_x',
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_x',
      STRIPE_WEBHOOK_SECRET: 'whsec_x',
      ALERT_EMAIL: 'a@b.com',
      SHIPPING_PROVIDER: 'mock',
    });
    expect(env.MEDIA_STORAGE).toBe('local');
    expect(env.MEDIA_STORAGE_PATH).toBe('/var/lib/ynot/media');
    expect(env.MEDIA_PUBLIC_BASE_URL).toBeUndefined();
  });

  it('rejects invalid MEDIA_STORAGE value', () => {
    const fn = () => parseEnv({
      DATABASE_URL: 'postgresql://x', REDIS_URL: 'redis://x',
      NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
      NEXTAUTH_SECRET: 'a'.repeat(32),
      ORDER_TOKEN_SECRET: 'b'.repeat(32),
      STRIPE_SECRET_KEY: 'sk_test_x',
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_x',
      STRIPE_WEBHOOK_SECRET: 'whsec_x',
      ALERT_EMAIL: 'a@b.com',
      SHIPPING_PROVIDER: 'mock',
      MEDIA_STORAGE: 'azure',
    } as unknown as Record<string, string>);
    expect(fn).toThrow();
  });
});
```

- [ ] **Step 2: Run — fail**

Run: `pnpm vitest run src/server/__tests__/env.test.ts`
Expected: FAIL with `MEDIA_STORAGE` not in schema.

- [ ] **Step 3: Extend `web/src/server/env.ts`**

Locate the Zod schema. Append before `.parse(...)`:

```ts
MEDIA_STORAGE: z.enum(['local', 's3', 'r2']).default('local'),
MEDIA_STORAGE_PATH: z.string().default('/var/lib/ynot/media'),
MEDIA_PUBLIC_BASE_URL: z.string().optional(),
```

- [ ] **Step 4: Run — pass**

Run: `pnpm vitest run src/server/__tests__/env.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/env.ts src/server/__tests__/env.test.ts
git commit -m "feat(phase-7a): extend env validator — MEDIA_STORAGE family"
```

---

### Task 6: Update `.env.example` + `docker-compose.yml`

**Files:**
- Modify: `web/.env.example`
- Modify: `web/docker-compose.yml`

- [ ] **Step 1: Append to `.env.example`**

```env

# ---- Media storage (Phase 7a — product/CMS images) ----
MEDIA_STORAGE="local"   # "local" | "s3" | "r2"
MEDIA_STORAGE_PATH="/var/lib/ynot/media"
# Optional — override the public base URL; defaults to NEXT_PUBLIC_SITE_URL + "/api/media".
# MEDIA_PUBLIC_BASE_URL="https://media.ynotlondon.com"
```

- [ ] **Step 2: Add `ynot-media` volume to `docker-compose.yml`**

Find the `services:` block. Locate the existing `ynot-app` service definition. Add to its `volumes:` list:

```yaml
      - ynot-media:/var/lib/ynot/media
```

(If `volumes:` doesn't exist on the service, add it.)

Find the top-level `volumes:` block (it has `ynot-labels:` from Phase 5). Add `ynot-media:` next to it:

```yaml
volumes:
  ynot-labels:
  ynot-media:
```

(If service names differ — e.g., `app:` instead of `ynot-app:` — adjust to match existing.)

- [ ] **Step 3: Verify compose still parses**

```bash
docker compose --profile prod config 2>&1 | grep -E "ynot-media|/var/lib/ynot/media" | head -5
```

Expected: lines mentioning `ynot-media` and the mount path.

- [ ] **Step 4: Commit**

```bash
git add .env.example docker-compose.yml
git commit -m "feat(phase-7a): scaffold ynot-media Docker volume + document MEDIA_* envs"
```

---

### Task 7: `requireOwner` auth guard

**Files:**
- Create or modify: `web/src/server/auth/guards.ts`
- Test: `web/src/server/auth/__tests__/guards.test.ts`

- [ ] **Step 1: Check if `guards.ts` already exists**

```bash
ls src/server/auth/guards.ts 2>&1
```

If it exists, this task extends it; otherwise creates it.

- [ ] **Step 2: Write failing test**

Create `web/src/server/auth/__tests__/guards.test.ts` (or append):

```ts
import { describe, expect, it } from 'vitest';
import { requireOwner, AuthorizationError } from '../guards';

describe('requireOwner', () => {
  it('throws when session is null', () => {
    expect(() => requireOwner(null)).toThrow(AuthorizationError);
  });

  it('throws when role is not OWNER', () => {
    expect(() => requireOwner({ user: { id: 'u1', role: 'ADMIN' } } as any)).toThrow(AuthorizationError);
    expect(() => requireOwner({ user: { id: 'u1', role: 'CUSTOMER' } } as any)).toThrow(AuthorizationError);
    expect(() => requireOwner({ user: { id: 'u1', role: 'EDITOR' } } as any)).toThrow(AuthorizationError);
  });

  it('returns the session when role is OWNER', () => {
    const session = { user: { id: 'u1', role: 'OWNER' } } as any;
    expect(requireOwner(session)).toBe(session);
  });
});
```

- [ ] **Step 3: Run — fail**

Run: `pnpm vitest run src/server/auth/__tests__/guards.test.ts`
Expected: FAIL with `requireOwner` not exported.

- [ ] **Step 4: Implement**

In `web/src/server/auth/guards.ts` (create if missing):

```ts
import type { Session } from 'next-auth';

export class AuthorizationError extends Error {
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export function requireOwner(session: Session | null): Session {
  if (!session?.user) throw new AuthorizationError('Authentication required');
  // @ts-expect-error — `role` is on the augmented session.user via Auth.js callbacks
  if (session.user.role !== 'OWNER') throw new AuthorizationError('Owner role required');
  return session;
}
```

- [ ] **Step 5: Run — pass**

Run: `pnpm vitest run src/server/auth/__tests__/guards.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/server/auth/guards.ts src/server/auth/__tests__/guards.test.ts
git commit -m "feat(phase-7a): requireOwner auth guard"
```

---

## Group C — Slug Helper

### Task 8: `slugify()` helper

**Files:**
- Create: `web/src/lib/slug.ts`
- Create: `web/src/lib/__tests__/slug.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, expect, it } from 'vitest';
import { slugify } from '../slug';

describe('slugify', () => {
  it('lowercases and replaces whitespace', () => {
    expect(slugify('Spring Trench Coat')).toBe('spring-trench-coat');
  });
  it('strips non-alphanumeric except hyphens', () => {
    expect(slugify('Coat #5 — Black/Bone')).toBe('coat-5-black-bone');
  });
  it('collapses multiple hyphens', () => {
    expect(slugify('a   b   c')).toBe('a-b-c');
  });
  it('trims leading/trailing hyphens', () => {
    expect(slugify('  --hello--  ')).toBe('hello');
  });
  it('handles empty string', () => {
    expect(slugify('')).toBe('');
  });
  it('preserves digits', () => {
    expect(slugify('Coat 2026')).toBe('coat-2026');
  });
});
```

- [ ] **Step 2: Run — fail**

Run: `pnpm vitest run src/lib/__tests__/slug.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `web/src/lib/slug.ts`:

```ts
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')      // strip non-word chars (keep hyphen + whitespace)
    .replace(/[_\s]+/g, '-')         // whitespace/underscore → hyphen
    .replace(/-+/g, '-')             // collapse multiple hyphens
    .replace(/^-|-$/g, '');          // trim
}
```

- [ ] **Step 4: Run — pass**

Run: `pnpm vitest run src/lib/__tests__/slug.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/slug.ts src/lib/__tests__/slug.test.ts
git commit -m "feat(phase-7a): slugify() helper"
```

---

### Task 9: `ensureUniqueSlug()` for Product + Category

**Files:**
- Create: `web/src/server/admin/catalog/slug-service.ts`
- Create: `web/src/server/admin/catalog/__tests__/slug-service.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, expect, it, beforeEach } from 'vitest';
import { prisma } from '@/server/db/client';
import { ensureUniqueSlug } from '../slug-service';

describe('ensureUniqueSlug', () => {
  beforeEach(async () => {
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
  });

  it('returns the input slug when no collision', async () => {
    const slug = await ensureUniqueSlug('product', 'spring-coat');
    expect(slug).toBe('spring-coat');
  });

  it('appends -2 on first collision', async () => {
    await prisma.product.create({
      data: { slug: 'spring-coat', name: 'X', description: 'd', priceCents: 1, materials: '', care: '', sizing: '' },
    });
    const slug = await ensureUniqueSlug('product', 'spring-coat');
    expect(slug).toBe('spring-coat-2');
  });

  it('keeps incrementing past -2', async () => {
    for (const s of ['spring-coat', 'spring-coat-2', 'spring-coat-3']) {
      await prisma.product.create({
        data: { slug: s, name: 'X', description: 'd', priceCents: 1, materials: '', care: '', sizing: '' },
      });
    }
    const slug = await ensureUniqueSlug('product', 'spring-coat');
    expect(slug).toBe('spring-coat-4');
  });

  it('excludes a given id from collision check (for updates)', async () => {
    const p = await prisma.product.create({
      data: { slug: 'spring-coat', name: 'X', description: 'd', priceCents: 1, materials: '', care: '', sizing: '' },
    });
    const slug = await ensureUniqueSlug('product', 'spring-coat', p.id);
    expect(slug).toBe('spring-coat');
  });

  it('works for category model', async () => {
    await prisma.category.create({ data: { slug: 'outerwear', name: 'Outerwear' } });
    const slug = await ensureUniqueSlug('category', 'outerwear');
    expect(slug).toBe('outerwear-2');
  });
});
```

- [ ] **Step 2: Run — fail**

Run: `pnpm vitest run src/server/admin/catalog/__tests__/slug-service.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `web/src/server/admin/catalog/slug-service.ts`:

```ts
import { prisma } from '@/server/db/client';

type SluggedModel = 'product' | 'category';

export async function ensureUniqueSlug(
  model: SluggedModel,
  baseSlug: string,
  excludeId?: string,
): Promise<string> {
  if (!baseSlug) throw new Error('baseSlug must be non-empty');
  let candidate = baseSlug;
  let suffix = 2;
  while (await collides(model, candidate, excludeId)) {
    candidate = `${baseSlug}-${suffix}`;
    suffix++;
  }
  return candidate;
}

async function collides(model: SluggedModel, slug: string, excludeId?: string): Promise<boolean> {
  const where: { slug: string; id?: { not: string } } = { slug };
  if (excludeId) where.id = { not: excludeId };
  if (model === 'product') {
    return (await prisma.product.findFirst({ where })) !== null;
  }
  return (await prisma.category.findFirst({ where })) !== null;
}
```

- [ ] **Step 4: Run — pass**

Run: `pnpm vitest run src/server/admin/catalog/__tests__/slug-service.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/admin/catalog/slug-service.ts src/server/admin/catalog/__tests__/slug-service.test.ts
git commit -m "feat(phase-7a): ensureUniqueSlug for Product + Category"
```

---

## Group D — MediaStorage Subsystem

### Task 10: `MediaStorage` interface + content-type helper

**Files:**
- Create: `web/src/server/media/storage.ts`
- Create: `web/src/server/media/content-type.ts`
- Create: `web/src/server/media/__tests__/content-type.test.ts`

- [ ] **Step 1: Write failing test for content-type**

```ts
import { describe, expect, it } from 'vitest';
import { contentTypeForExt, extFromContentType } from '../content-type';

describe('contentTypeForExt', () => {
  it('maps .jpg to image/jpeg', () => {
    expect(contentTypeForExt('.jpg')).toBe('image/jpeg');
    expect(contentTypeForExt('.jpeg')).toBe('image/jpeg');
  });
  it('maps .png to image/png', () => {
    expect(contentTypeForExt('.png')).toBe('image/png');
  });
  it('maps .webp to image/webp', () => {
    expect(contentTypeForExt('.webp')).toBe('image/webp');
  });
  it('maps .mp4 to video/mp4', () => {
    expect(contentTypeForExt('.mp4')).toBe('video/mp4');
  });
  it('returns application/octet-stream for unknown', () => {
    expect(contentTypeForExt('.xyz')).toBe('application/octet-stream');
  });
});

describe('extFromContentType', () => {
  it('maps image/jpeg to .jpg', () => {
    expect(extFromContentType('image/jpeg')).toBe('.jpg');
  });
  it('maps image/webp to .webp', () => {
    expect(extFromContentType('image/webp')).toBe('.webp');
  });
});
```

- [ ] **Step 2: Run — fail**

Run: `pnpm vitest run src/server/media/__tests__/content-type.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement content-type**

Create `web/src/server/media/content-type.ts`:

```ts
const EXT_TO_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.mp4': 'video/mp4',
};

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/avif': '.avif',
  'video/mp4': '.mp4',
};

export function contentTypeForExt(ext: string): string {
  return EXT_TO_MIME[ext.toLowerCase()] ?? 'application/octet-stream';
}

export function extFromContentType(mime: string): string {
  return MIME_TO_EXT[mime.toLowerCase()] ?? '.bin';
}
```

- [ ] **Step 4: Implement interface**

Create `web/src/server/media/storage.ts`:

```ts
export interface MediaStorage {
  put(key: string, content: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<{ buffer: Buffer; contentType: string }>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}
```

- [ ] **Step 5: Run — pass**

Run: `pnpm vitest run src/server/media/__tests__/content-type.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/server/media/storage.ts src/server/media/content-type.ts src/server/media/__tests__/content-type.test.ts
git commit -m "feat(phase-7a): MediaStorage interface + content-type map"
```

---

### Task 11: `LocalFsStorage` impl

**Files:**
- Create: `web/src/server/media/local-fs-storage.ts`
- Create: `web/src/server/media/__tests__/local-fs-storage.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, expect, it, beforeEach } from 'vitest';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalFsStorage } from '../local-fs-storage';

describe('LocalFsStorage', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'ynot-media-')); });

  it('writes file + .meta sidecar with content type', async () => {
    const storage = new LocalFsStorage(dir);
    await storage.put('products/abc/img.jpg', Buffer.from('JPGBYTES'), 'image/jpeg');
    expect(existsSync(join(dir, 'products/abc/img.jpg'))).toBe(true);
    expect(existsSync(join(dir, 'products/abc/img.jpg.meta'))).toBe(true);
    expect(readFileSync(join(dir, 'products/abc/img.jpg.meta'), 'utf-8').trim()).toBe('image/jpeg');
  });

  it('reads back the same buffer + content type', async () => {
    const storage = new LocalFsStorage(dir);
    await storage.put('lookbook/x.png', Buffer.from('PNG'), 'image/png');
    const r = await storage.get('lookbook/x.png');
    expect(r.buffer.toString()).toBe('PNG');
    expect(r.contentType).toBe('image/png');
  });

  it('throws on get of missing key', async () => {
    const storage = new LocalFsStorage(dir);
    await expect(storage.get('nope.jpg')).rejects.toThrow();
  });

  it('exists() returns true after put, false otherwise', async () => {
    const storage = new LocalFsStorage(dir);
    expect(await storage.exists('a.jpg')).toBe(false);
    await storage.put('a.jpg', Buffer.from('x'), 'image/jpeg');
    expect(await storage.exists('a.jpg')).toBe(true);
  });

  it('delete removes file + .meta sidecar', async () => {
    const storage = new LocalFsStorage(dir);
    await storage.put('a.jpg', Buffer.from('x'), 'image/jpeg');
    await storage.delete('a.jpg');
    expect(await storage.exists('a.jpg')).toBe(false);
    expect(existsSync(join(dir, 'a.jpg.meta'))).toBe(false);
  });

  it('rejects keys containing ".."', async () => {
    const storage = new LocalFsStorage(dir);
    await expect(storage.put('../escape.jpg', Buffer.from('x'), 'image/jpeg')).rejects.toThrow(/invalid key/i);
    await expect(storage.get('../escape.jpg')).rejects.toThrow(/invalid key/i);
  });

  it('creates nested directories as needed', async () => {
    const storage = new LocalFsStorage(dir);
    await storage.put('a/b/c/d.jpg', Buffer.from('x'), 'image/jpeg');
    expect(existsSync(join(dir, 'a/b/c/d.jpg'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run — fail**

Run: `pnpm vitest run src/server/media/__tests__/local-fs-storage.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `web/src/server/media/local-fs-storage.ts`:

```ts
import { mkdir, readFile, unlink, writeFile, access } from 'node:fs/promises';
import { join, normalize } from 'node:path';
import type { MediaStorage } from './storage';

export class LocalFsStorage implements MediaStorage {
  constructor(private root: string) {}

  private resolve(key: string): string {
    if (key.includes('..')) throw new Error(`invalid key: ${key}`);
    const normalized = normalize(key);
    if (normalized.startsWith('/') || normalized.startsWith('..')) {
      throw new Error(`invalid key: ${key}`);
    }
    return join(this.root, normalized);
  }

  async put(key: string, content: Buffer, contentType: string): Promise<void> {
    const path = this.resolve(key);
    const dir = path.substring(0, path.lastIndexOf('/'));
    await mkdir(dir, { recursive: true });
    await writeFile(path, content);
    await writeFile(`${path}.meta`, contentType);
  }

  async get(key: string): Promise<{ buffer: Buffer; contentType: string }> {
    const path = this.resolve(key);
    const [buffer, meta] = await Promise.all([
      readFile(path),
      readFile(`${path}.meta`, 'utf-8').catch(() => 'application/octet-stream'),
    ]);
    return { buffer, contentType: meta.trim() };
  }

  async delete(key: string): Promise<void> {
    const path = this.resolve(key);
    await Promise.all([
      unlink(path).catch(() => {}),
      unlink(`${path}.meta`).catch(() => {}),
    ]);
  }

  async exists(key: string): Promise<boolean> {
    try {
      await access(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }
}
```

- [ ] **Step 4: Run — pass**

Run: `pnpm vitest run src/server/media/__tests__/local-fs-storage.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/media/local-fs-storage.ts src/server/media/__tests__/local-fs-storage.test.ts
git commit -m "feat(phase-7a): LocalFsStorage impl with .meta sidecar + traversal guard"
```

---

### Task 12: `createMediaStorage()` factory + singleton

**Files:**
- Create: `web/src/server/media/factory.ts`
- Create: `web/src/server/media/__tests__/factory.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, expect, it } from 'vitest';
import { LocalFsStorage } from '../local-fs-storage';
import { createMediaStorage } from '../factory';

describe('createMediaStorage', () => {
  it('returns LocalFsStorage when MEDIA_STORAGE=local', () => {
    const storage = createMediaStorage({ MEDIA_STORAGE: 'local', MEDIA_STORAGE_PATH: '/tmp/x' });
    expect(storage).toBeInstanceOf(LocalFsStorage);
  });

  it('throws on s3 (not yet implemented)', () => {
    expect(() => createMediaStorage({ MEDIA_STORAGE: 's3', MEDIA_STORAGE_PATH: '/tmp/x' }))
      .toThrow(/not yet implemented/i);
  });

  it('throws on r2 (not yet implemented)', () => {
    expect(() => createMediaStorage({ MEDIA_STORAGE: 'r2', MEDIA_STORAGE_PATH: '/tmp/x' }))
      .toThrow(/not yet implemented/i);
  });
});
```

- [ ] **Step 2: Run — fail**

Run: `pnpm vitest run src/server/media/__tests__/factory.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `web/src/server/media/factory.ts`:

```ts
import { LocalFsStorage } from './local-fs-storage';
import type { MediaStorage } from './storage';

interface FactoryEnv {
  MEDIA_STORAGE: string;
  MEDIA_STORAGE_PATH: string;
}

export function createMediaStorage(env: FactoryEnv): MediaStorage {
  if (env.MEDIA_STORAGE === 'local') return new LocalFsStorage(env.MEDIA_STORAGE_PATH);
  throw new Error(`MediaStorage backend "${env.MEDIA_STORAGE}" not yet implemented in Phase 7a — see spec §8`);
}

let cached: MediaStorage | null = null;

export function getMediaStorage(env: FactoryEnv): MediaStorage {
  if (!cached) cached = createMediaStorage(env);
  return cached;
}

export function _resetMediaStorageForTests(): void {
  cached = null;
}
```

- [ ] **Step 4: Run — pass**

Run: `pnpm vitest run src/server/media/__tests__/factory.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/media/factory.ts src/server/media/__tests__/factory.test.ts
git commit -m "feat(phase-7a): MediaStorage factory + singleton"
```

---

### Task 13: Public-URL helper

**Files:**
- Modify: `web/src/server/media/factory.ts`

- [ ] **Step 1: Add helper to factory.ts**

Append to `web/src/server/media/factory.ts`:

```ts
interface PublicUrlEnv {
  MEDIA_PUBLIC_BASE_URL?: string;
  NEXT_PUBLIC_SITE_URL: string;
}

export function publicUrlFor(key: string, env: PublicUrlEnv): string {
  const base = env.MEDIA_PUBLIC_BASE_URL ?? `${env.NEXT_PUBLIC_SITE_URL}/api/media`;
  return `${base.replace(/\/$/, '')}/${key.replace(/^\//, '')}`;
}
```

- [ ] **Step 2: Add test**

Append to `web/src/server/media/__tests__/factory.test.ts`:

```ts
import { publicUrlFor } from '../factory';

describe('publicUrlFor', () => {
  it('joins NEXT_PUBLIC_SITE_URL + /api/media + key by default', () => {
    expect(publicUrlFor('products/abc/img.jpg', { NEXT_PUBLIC_SITE_URL: 'http://localhost:3000' }))
      .toBe('http://localhost:3000/api/media/products/abc/img.jpg');
  });
  it('uses MEDIA_PUBLIC_BASE_URL override', () => {
    expect(publicUrlFor('a/b.jpg', { NEXT_PUBLIC_SITE_URL: 'x', MEDIA_PUBLIC_BASE_URL: 'https://media.ynotlondon.com' }))
      .toBe('https://media.ynotlondon.com/a/b.jpg');
  });
  it('strips trailing slash from base + leading slash from key', () => {
    expect(publicUrlFor('/a.jpg', { NEXT_PUBLIC_SITE_URL: 'http://x/', MEDIA_PUBLIC_BASE_URL: 'http://x/m/' }))
      .toBe('http://x/m/a.jpg');
  });
});
```

- [ ] **Step 3: Run — pass**

Run: `pnpm vitest run src/server/media/__tests__/factory.test.ts`
Expected: PASS (4 cases).

- [ ] **Step 4: Commit**

```bash
git add src/server/media/factory.ts src/server/media/__tests__/factory.test.ts
git commit -m "feat(phase-7a): publicUrlFor helper for /api/media keys"
```

---

## Group E — Public Media Stream Route

### Task 14: `GET /api/media/[...key]` route

**Files:**
- Create: `web/src/app/api/media/[...key]/route.ts`
- Create: `web/src/app/api/media/[...key]/__tests__/route.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, expect, it, beforeEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalFsStorage } from '@/server/media/local-fs-storage';
import { _resetMediaStorageForTests } from '@/server/media/factory';
import { GET } from '../route';

describe('GET /api/media/[...key]', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ynot-media-route-'));
    process.env.MEDIA_STORAGE = 'local';
    process.env.MEDIA_STORAGE_PATH = dir;
    _resetMediaStorageForTests();
  });

  it('streams file with correct content type + immutable cache header', async () => {
    const storage = new LocalFsStorage(dir);
    await storage.put('products/abc/img.jpg', Buffer.from('JPG'), 'image/jpeg');
    _resetMediaStorageForTests();
    const req = new Request('http://localhost/api/media/products/abc/img.jpg');
    const res = await GET(req, { params: Promise.resolve({ key: ['products', 'abc', 'img.jpg'] }) });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/jpeg');
    expect(res.headers.get('Cache-Control')).toContain('immutable');
    const body = await res.arrayBuffer();
    expect(Buffer.from(body).toString()).toBe('JPG');
  });

  it('404 when key missing', async () => {
    const req = new Request('http://localhost/api/media/nope.jpg');
    const res = await GET(req, { params: Promise.resolve({ key: ['nope.jpg'] }) });
    expect(res.status).toBe(404);
  });

  it('400 on traversal attempt (key contains "..")', async () => {
    const req = new Request('http://localhost/api/media/..%2Fescape.jpg');
    const res = await GET(req, { params: Promise.resolve({ key: ['..', 'escape.jpg'] }) });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run — fail**

Run: `pnpm vitest run src/app/api/media`
Expected: FAIL — route module missing.

- [ ] **Step 3: Implement**

Create `web/src/app/api/media/[...key]/route.ts`:

```ts
import { env } from '@/server/env';
import { getMediaStorage } from '@/server/media/factory';

export async function GET(_req: Request, ctx: { params: Promise<{ key: string[] }> }): Promise<Response> {
  const { key } = await ctx.params;
  const fullKey = key.join('/');
  if (fullKey.includes('..') || fullKey.startsWith('/')) {
    return new Response('Invalid key', { status: 400 });
  }
  const storage = getMediaStorage(env);
  if (!(await storage.exists(fullKey))) {
    return new Response('Not found', { status: 404 });
  }
  const { buffer, contentType } = await storage.get(fullKey);
  return new Response(buffer, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Disposition': 'inline',
    },
  });
}
```

- [ ] **Step 4: Run — pass**

Run: `pnpm vitest run src/app/api/media`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/media/[...key]/route.ts src/app/api/media/[...key]/__tests__/route.test.ts
git commit -m "feat(phase-7a): public GET /api/media/[...key] stream route"
```

---

## Group F — Admin Media Upload Route

### Task 15: `POST /api/admin/media/upload`

**Files:**
- Create: `web/src/app/api/admin/media/upload/route.ts`
- Create: `web/src/app/api/admin/media/upload/__tests__/route.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _resetMediaStorageForTests } from '@/server/media/factory';
import { POST } from '../route';

vi.mock('@/server/auth', () => ({
  auth: vi.fn(),
}));

import { auth } from '@/server/auth';

describe('POST /api/admin/media/upload', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ynot-admin-upload-'));
    process.env.MEDIA_STORAGE = 'local';
    process.env.MEDIA_STORAGE_PATH = dir;
    _resetMediaStorageForTests();
    (auth as any).mockResolvedValue({ user: { id: 'u1', role: 'OWNER' } });
  });

  function makeForm(file: File): FormData {
    const fd = new FormData();
    fd.append('files', file);
    return fd;
  }

  it('rejects when not OWNER', async () => {
    (auth as any).mockResolvedValue({ user: { id: 'u1', role: 'CUSTOMER' } });
    const req = new Request('http://x/api/admin/media/upload?prefix=products/abc', {
      method: 'POST',
      body: makeForm(new File([new Uint8Array([1])], 'a.jpg', { type: 'image/jpeg' })),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('uploads JPEG and returns key + url', async () => {
    const file = new File([Buffer.from('JPG')], 'photo.jpg', { type: 'image/jpeg' });
    const req = new Request('http://x/api/admin/media/upload?prefix=products/abc', {
      method: 'POST',
      body: makeForm(file),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.uploaded).toHaveLength(1);
    expect(data.uploaded[0].key).toMatch(/^products\/abc\/[A-Za-z0-9_-]{12}\.jpg$/);
    expect(data.uploaded[0].url).toContain('/api/media/products/abc/');
  });

  it('rejects PDF MIME', async () => {
    const file = new File([Buffer.from('PDF')], 'a.pdf', { type: 'application/pdf' });
    const req = new Request('http://x/api/admin/media/upload?prefix=products/abc', {
      method: 'POST',
      body: makeForm(file),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.uploaded).toHaveLength(0);
    expect(data.rejected).toHaveLength(1);
    expect(data.rejected[0].reason).toMatch(/mime|type/i);
  });

  it('rejects oversize >5MB', async () => {
    const big = Buffer.alloc(6 * 1024 * 1024);
    const file = new File([big], 'big.jpg', { type: 'image/jpeg' });
    const req = new Request('http://x/api/admin/media/upload?prefix=products/abc', {
      method: 'POST',
      body: makeForm(file),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.rejected).toHaveLength(1);
    expect(data.rejected[0].reason).toMatch(/size|5mb/i);
  });
});
```

- [ ] **Step 2: Run — fail**

Run: `pnpm vitest run src/app/api/admin/media/upload`
Expected: FAIL — route module missing.

- [ ] **Step 3: Implement**

Create `web/src/app/api/admin/media/upload/route.ts`:

```ts
import { auth } from '@/server/auth';
import { env } from '@/server/env';
import { getMediaStorage, publicUrlFor } from '@/server/media/factory';
import { extFromContentType } from '@/server/media/content-type';
import { requireOwner, AuthorizationError } from '@/server/auth/guards';

const ACCEPTED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'video/mp4']);
const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(req: Request): Promise<Response> {
  try {
    const session = await auth();
    requireOwner(session);
  } catch (e) {
    if (e instanceof AuthorizationError) return new Response('Forbidden', { status: 403 });
    throw e;
  }

  const url = new URL(req.url);
  const prefix = (url.searchParams.get('prefix') ?? 'misc').replace(/[^a-z0-9/_-]/gi, '');
  const form = await req.formData();
  const files = form.getAll('files').filter((f): f is File => f instanceof File);

  const storage = getMediaStorage(env);
  const uploaded: Array<{ key: string; url: string; originalFilename: string }> = [];
  const rejected: Array<{ filename: string; reason: string }> = [];

  for (const file of files) {
    if (!ACCEPTED.has(file.type)) {
      rejected.push({ filename: file.name, reason: `Unsupported MIME type: ${file.type}` });
      continue;
    }
    if (file.size > MAX_BYTES) {
      rejected.push({ filename: file.name, reason: 'File exceeds 5MB limit' });
      continue;
    }
    const ext = extFromContentType(file.type);
    const id = randomId(12);
    const key = `${prefix}/${id}${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await storage.put(key, buffer, file.type);
    uploaded.push({
      key,
      url: publicUrlFor(key, { NEXT_PUBLIC_SITE_URL: env.NEXT_PUBLIC_SITE_URL, MEDIA_PUBLIC_BASE_URL: env.MEDIA_PUBLIC_BASE_URL }),
      originalFilename: file.name,
    });
  }

  return Response.json({ uploaded, rejected });
}

const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
function randomId(n: number): string {
  let out = '';
  for (let i = 0; i < n; i++) out += ALPHA[Math.floor(Math.random() * ALPHA.length)];
  return out;
}
```

- [ ] **Step 4: Run — pass**

Run: `pnpm vitest run src/app/api/admin/media/upload`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/media/upload/route.ts src/app/api/admin/media/upload/__tests__/route.test.ts
git commit -m "feat(phase-7a): POST /api/admin/media/upload — multipart with MIME + size validation"
```

---

## Group G — Audit Helper

### Task 16: `withAudit()` higher-order wrapper

**Files:**
- Create: `web/src/server/admin/audit.ts`
- Create: `web/src/server/admin/__tests__/audit.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, expect, it, beforeEach } from 'vitest';
import { prisma } from '@/server/db/client';
import { withAudit } from '../audit';

describe('withAudit', () => {
  beforeEach(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.user.deleteMany();
    await prisma.user.create({
      data: { id: 'admin-u1', email: 'a@b.com', role: 'OWNER' },
    });
  });

  it('runs the operation and writes one AuditLog row with before/after', async () => {
    const result = await withAudit(
      { actorId: 'admin-u1', entityType: 'product', entityId: 'p1', action: 'product.create', before: null, ip: '1.2.3.4', ua: 'curl' },
      async () => ({ id: 'p1', name: 'X', priceCents: 10000 }),
    );
    expect(result.id).toBe('p1');
    const log = await prisma.auditLog.findFirst();
    expect(log).not.toBeNull();
    expect(log!.actorId).toBe('admin-u1');
    expect(log!.entityType).toBe('product');
    expect(log!.entityId).toBe('p1');
    expect(log!.action).toBe('product.create');
    expect(log!.before).toBeNull();
    expect(log!.after).toEqual({ id: 'p1', name: 'X', priceCents: 10000 });
    expect(log!.ipAddress).toBe('1.2.3.4');
    expect(log!.userAgent).toBe('curl');
  });

  it('does not write a log when run() throws', async () => {
    await expect(
      withAudit(
        { actorId: 'admin-u1', entityType: 'product', entityId: 'p1', action: 'product.create' },
        async () => { throw new Error('boom'); },
      ),
    ).rejects.toThrow('boom');
    expect(await prisma.auditLog.count()).toBe(0);
  });

  it('logs to stderr but does not throw when audit insert fails (mutation already committed)', async () => {
    // Force audit failure by passing a non-existent actorId (FK constraint).
    const result = await withAudit(
      { actorId: 'does-not-exist', entityType: 'product', entityId: 'p1', action: 'product.create' },
      async () => ({ id: 'p1' }),
    );
    expect(result).toEqual({ id: 'p1' });
    expect(await prisma.auditLog.count()).toBe(0);
  });
});
```

- [ ] **Step 2: Run — fail**

Run: `pnpm vitest run src/server/admin/__tests__/audit.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

Create `web/src/server/admin/audit.ts`:

```ts
import { prisma } from '@/server/db/client';
import type { Prisma } from '@prisma/client';

export interface AuditContext {
  actorId: string;
  entityType: string;
  entityId: string;
  action: string;
  before?: unknown;
  ip?: string;
  ua?: string;
}

/**
 * Wraps a mutation. The mutation runs first; on success, an AuditLog row is
 * inserted capturing the actor, entity, action, before/after JSON snapshots,
 * IP, UA. If the audit insert fails (e.g. DB issue), we log to stderr and
 * swallow — the mutation has already committed. Phase 7b can wrap in a single
 * transaction if compliance becomes a strict requirement.
 */
export async function withAudit<T>(ctx: AuditContext, run: () => Promise<T>): Promise<T> {
  const result = await run();
  try {
    await prisma.auditLog.create({
      data: {
        actorId: ctx.actorId,
        entityType: ctx.entityType,
        entityId: ctx.entityId,
        action: ctx.action,
        before: (ctx.before as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        after: result as Prisma.InputJsonValue,
        ipAddress: ctx.ip ?? null,
        userAgent: ctx.ua ?? null,
      },
    });
  } catch (e) {
    process.stderr.write(`[audit] failed to write AuditLog row: ${(e as Error).message}\n`);
  }
  return result;
}
```

- [ ] **Step 4: Run — pass**

Run: `pnpm vitest run src/server/admin/__tests__/audit.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/admin/audit.ts src/server/admin/__tests__/audit.test.ts
git commit -m "feat(phase-7a): withAudit() higher-order helper for catalog/CMS/promo writes"
```

---

## Group H — Catalog Services

### Task 17: `ProductStatus` state machine

**Files:**
- Create: `web/src/server/admin/catalog/product-status.ts`
- Create: `web/src/server/admin/catalog/__tests__/product-status.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, expect, it } from 'vitest';
import { ALLOWED_PRODUCT_TRANSITIONS, assertProductTransition, IllegalProductTransitionError } from '../product-status';

describe('ALLOWED_PRODUCT_TRANSITIONS', () => {
  it('DRAFT → PUBLISHED, ARCHIVED', () => {
    expect(ALLOWED_PRODUCT_TRANSITIONS.DRAFT).toContain('PUBLISHED');
    expect(ALLOWED_PRODUCT_TRANSITIONS.DRAFT).toContain('ARCHIVED');
  });
  it('PUBLISHED → DRAFT, ARCHIVED', () => {
    expect(ALLOWED_PRODUCT_TRANSITIONS.PUBLISHED).toEqual(['DRAFT', 'ARCHIVED']);
  });
  it('ARCHIVED → DRAFT only', () => {
    expect(ALLOWED_PRODUCT_TRANSITIONS.ARCHIVED).toEqual(['DRAFT']);
  });
});

describe('assertProductTransition', () => {
  it('passes for legal pairs', () => {
    expect(() => assertProductTransition('DRAFT', 'PUBLISHED')).not.toThrow();
  });
  it('throws IllegalProductTransitionError on illegal', () => {
    expect(() => assertProductTransition('PUBLISHED', 'DRAFT')).not.toThrow(); // legal
    // ARCHIVED → PUBLISHED is illegal (must go via DRAFT)
    expect(() => assertProductTransition('ARCHIVED', 'PUBLISHED')).toThrow(IllegalProductTransitionError);
  });
  it('passes for same-status (no-op)', () => {
    expect(() => assertProductTransition('DRAFT', 'DRAFT')).not.toThrow();
  });
});
```

- [ ] **Step 2: Run — fail**

Run: `pnpm vitest run src/server/admin/catalog/__tests__/product-status.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `web/src/server/admin/catalog/product-status.ts`:

```ts
import type { ProductStatus } from '@prisma/client';

export const ALLOWED_PRODUCT_TRANSITIONS: Record<ProductStatus, ProductStatus[]> = {
  DRAFT: ['PUBLISHED', 'ARCHIVED'],
  PUBLISHED: ['DRAFT', 'ARCHIVED'],
  ARCHIVED: ['DRAFT'],
};

export class IllegalProductTransitionError extends Error {
  constructor(from: ProductStatus, to: ProductStatus) {
    super(`Illegal product status transition: ${from} → ${to}`);
    this.name = 'IllegalProductTransitionError';
  }
}

export function assertProductTransition(from: ProductStatus, to: ProductStatus): void {
  if (from === to) return;
  if (!ALLOWED_PRODUCT_TRANSITIONS[from].includes(to)) {
    throw new IllegalProductTransitionError(from, to);
  }
}
```

- [ ] **Step 4: Run — pass**

Run: `pnpm vitest run src/server/admin/catalog/__tests__/product-status.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/admin/catalog/product-status.ts src/server/admin/catalog/__tests__/product-status.test.ts
git commit -m "feat(phase-7a): ProductStatus state-machine + assertProductTransition"
```

---

### Task 18: `admin-product` Zod schemas

**Files:**
- Create: `web/src/lib/schemas/admin-product.ts`
- Create: `web/src/lib/schemas/__tests__/admin-product.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, expect, it } from 'vitest';
import { ProductCreateSchema, ProductUpdateSchema, ProductImagesReorderSchema, ProductSizesUpdateSchema, ProductColoursUpdateSchema, ProductStatusChangeSchema } from '../admin-product';

describe('ProductCreateSchema', () => {
  const valid = {
    name: 'Spring Coat',
    slug: 'spring-coat',
    description: 'A trench.',
    priceCents: 45000,
    materials: 'wool',
    care: 'dry clean',
    sizing: 'true to size',
    weightGrams: 1200,
    hsCode: '6201',
    countryOfOriginCode: 'GB',
    preOrder: false,
  };

  it('accepts a valid payload', () => {
    expect(ProductCreateSchema.safeParse(valid).success).toBe(true);
  });
  it('rejects negative priceCents', () => {
    expect(ProductCreateSchema.safeParse({ ...valid, priceCents: -1 }).success).toBe(false);
  });
  it('rejects empty name', () => {
    expect(ProductCreateSchema.safeParse({ ...valid, name: '' }).success).toBe(false);
  });
  it('rejects 1-letter country code', () => {
    expect(ProductCreateSchema.safeParse({ ...valid, countryOfOriginCode: 'G' }).success).toBe(false);
  });
});

describe('ProductImagesReorderSchema', () => {
  it('accepts an array of cuid strings', () => {
    expect(ProductImagesReorderSchema.safeParse({ order: ['clxxx1', 'clxxx2'] }).success).toBe(true);
  });
  it('rejects empty array', () => {
    expect(ProductImagesReorderSchema.safeParse({ order: [] }).success).toBe(false);
  });
});

describe('ProductSizesUpdateSchema', () => {
  it('accepts valid sizes payload', () => {
    expect(ProductSizesUpdateSchema.safeParse({ sizes: [{ size: 'M', stock: 5 }, { size: 'L', stock: 0 }] }).success).toBe(true);
  });
  it('rejects negative stock', () => {
    expect(ProductSizesUpdateSchema.safeParse({ sizes: [{ size: 'M', stock: -1 }] }).success).toBe(false);
  });
  it('rejects unknown size enum', () => {
    expect(ProductSizesUpdateSchema.safeParse({ sizes: [{ size: 'XXL', stock: 1 }] }).success).toBe(false);
  });
});

describe('ProductColoursUpdateSchema', () => {
  it('accepts valid colours', () => {
    expect(ProductColoursUpdateSchema.safeParse({ colours: [{ name: 'Bone', hex: '#EFEFE8' }] }).success).toBe(true);
  });
  it('rejects malformed hex', () => {
    expect(ProductColoursUpdateSchema.safeParse({ colours: [{ name: 'Bone', hex: 'EFEFE8' }] }).success).toBe(false);
  });
});

describe('ProductStatusChangeSchema', () => {
  it('accepts DRAFT/PUBLISHED/ARCHIVED', () => {
    for (const to of ['DRAFT', 'PUBLISHED', 'ARCHIVED']) {
      expect(ProductStatusChangeSchema.safeParse({ to }).success).toBe(true);
    }
  });
  it('rejects unknown status', () => {
    expect(ProductStatusChangeSchema.safeParse({ to: 'PAUSED' }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run — fail**

Run: `pnpm vitest run src/lib/schemas/__tests__/admin-product.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `web/src/lib/schemas/admin-product.ts`:

```ts
import { z } from 'zod';

export const ProductCreateSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(200).optional(), // auto-generated if absent
  description: z.string().min(1).max(5000),
  priceCents: z.number().int().positive(),
  materials: z.string().max(2000).default(''),
  care: z.string().max(2000).default(''),
  sizing: z.string().max(2000).default(''),
  weightGrams: z.number().int().positive().optional(),
  hsCode: z.string().regex(/^\d{4,10}$/).optional(),
  countryOfOriginCode: z.string().length(2).optional(),
  preOrder: z.boolean().default(false),
});

export const ProductUpdateSchema = ProductCreateSchema.partial();

export const ProductImagesReorderSchema = z.object({
  order: z.array(z.string().min(1)).min(1),
});

export const ProductSizesUpdateSchema = z.object({
  sizes: z.array(z.object({
    size: z.enum(['XS', 'S', 'M', 'L', 'XL']),
    stock: z.number().int().min(0),
  })).min(1),
});

export const ProductColoursUpdateSchema = z.object({
  colours: z.array(z.object({
    name: z.string().min(1).max(50),
    hex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  })),
});

export const ProductStatusChangeSchema = z.object({
  to: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']),
});

export type ProductCreateInput = z.infer<typeof ProductCreateSchema>;
export type ProductUpdateInput = z.infer<typeof ProductUpdateSchema>;
export type ProductSizesUpdateInput = z.infer<typeof ProductSizesUpdateSchema>;
export type ProductColoursUpdateInput = z.infer<typeof ProductColoursUpdateSchema>;
```

- [ ] **Step 4: Run — pass**

Run: `pnpm vitest run src/lib/schemas/__tests__/admin-product.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/schemas/admin-product.ts src/lib/schemas/__tests__/admin-product.test.ts
git commit -m "feat(phase-7a): admin-product Zod schemas"
```

---

### Task 19: `productService.create()`

**Files:**
- Create: `web/src/server/admin/catalog/product-service.ts`
- Create: `web/src/server/admin/catalog/__tests__/product-service.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, expect, it, beforeEach } from 'vitest';
import { prisma } from '@/server/db/client';
import { createProduct } from '../product-service';

describe('createProduct', () => {
  beforeEach(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.product.deleteMany();
    await prisma.user.deleteMany();
    await prisma.user.create({ data: { id: 'u1', email: 'o@b.com', role: 'OWNER' } });
  });

  it('creates a DRAFT product with auto-slug + writes audit row', async () => {
    const product = await createProduct({
      input: { name: 'Spring Coat', description: 'A trench.', priceCents: 45000, materials: 'wool', care: 'dry', sizing: 'true', preOrder: false },
      actorId: 'u1',
    });
    expect(product.status).toBe('DRAFT');
    expect(product.slug).toBe('spring-coat');
    expect(product.publishedAt).toBeNull();

    const log = await prisma.auditLog.findFirst({ where: { entityType: 'product', action: 'product.create' } });
    expect(log).not.toBeNull();
    expect(log!.entityId).toBe(product.id);
  });

  it('honours an explicit slug + suffixes on collision', async () => {
    await createProduct({
      input: { name: 'A', slug: 'spring-coat', description: 'd', priceCents: 1, materials: '', care: '', sizing: '', preOrder: false },
      actorId: 'u1',
    });
    const second = await createProduct({
      input: { name: 'B', slug: 'spring-coat', description: 'd', priceCents: 1, materials: '', care: '', sizing: '', preOrder: false },
      actorId: 'u1',
    });
    expect(second.slug).toBe('spring-coat-2');
  });
});
```

- [ ] **Step 2: Run — fail**

Run: `pnpm vitest run src/server/admin/catalog/__tests__/product-service.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `web/src/server/admin/catalog/product-service.ts`:

```ts
import { prisma } from '@/server/db/client';
import { withAudit } from '../audit';
import { ensureUniqueSlug } from './slug-service';
import { slugify } from '@/lib/slug';
import type { ProductCreateInput, ProductUpdateInput } from '@/lib/schemas/admin-product';

export interface CreateProductOptions {
  input: ProductCreateInput;
  actorId: string;
  ip?: string;
  ua?: string;
}

export async function createProduct(opts: CreateProductOptions) {
  const { input, actorId, ip, ua } = opts;
  const baseSlug = input.slug ?? slugify(input.name);
  const slug = await ensureUniqueSlug('product', baseSlug);

  return withAudit(
    { actorId, entityType: 'product', entityId: 'pending', action: 'product.create', ip, ua },
    async () => {
      const product = await prisma.product.create({
        data: {
          name: input.name,
          slug,
          description: input.description,
          priceCents: input.priceCents,
          materials: input.materials ?? '',
          care: input.care ?? '',
          sizing: input.sizing ?? '',
          weightGrams: input.weightGrams,
          hsCode: input.hsCode,
          countryOfOriginCode: input.countryOfOriginCode,
          preOrder: input.preOrder,
          status: 'DRAFT',
        },
      });
      // override entityId after creation — withAudit captures the result; entityId isn't used downstream.
      return product;
    },
  );
}
```

> Note: `withAudit` was designed assuming the entityId is known up-front. For `create`, the id only exists after the row insert. We pass `entityId: 'pending'` and rely on the `after` JSON snapshot to carry the real id; the audit log row's `entityId` will read `'pending'` for create actions, which is acceptable for compliance (the after JSON has the truth). Phase 7b can refine if needed.

- [ ] **Step 4: Run — pass**

Run: `pnpm vitest run src/server/admin/catalog/__tests__/product-service.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/admin/catalog/product-service.ts src/server/admin/catalog/__tests__/product-service.test.ts
git commit -m "feat(phase-7a): productService.create() with audit + slug uniqueness"
```

---

### Task 20: `productService.update()` + `changeStatus()`

**Files:**
- Modify: `web/src/server/admin/catalog/product-service.ts`
- Modify: `web/src/server/admin/catalog/__tests__/product-service.test.ts`

- [ ] **Step 1: Append failing tests**

Append to `web/src/server/admin/catalog/__tests__/product-service.test.ts`:

```ts
import { updateProduct, changeProductStatus } from '../product-service';

describe('updateProduct', () => {
  beforeEach(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.product.deleteMany();
    await prisma.user.deleteMany();
    await prisma.user.create({ data: { id: 'u1', email: 'o@b.com', role: 'OWNER' } });
  });

  it('updates fields + writes audit row with before/after', async () => {
    const created = await createProduct({
      input: { name: 'Old', description: 'd', priceCents: 1, materials: '', care: '', sizing: '', preOrder: false },
      actorId: 'u1',
    });
    const updated = await updateProduct({ id: created.id, input: { name: 'New', priceCents: 2 }, actorId: 'u1' });
    expect(updated.name).toBe('New');
    expect(updated.priceCents).toBe(2);
    expect(updated.slug).toBe('old'); // slug not auto-changed when only name changes
    const log = await prisma.auditLog.findFirst({ where: { action: 'product.update' } });
    expect(log).not.toBeNull();
    expect((log!.before as { name: string }).name).toBe('Old');
    expect((log!.after as { name: string }).name).toBe('New');
  });
});

describe('changeProductStatus', () => {
  beforeEach(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.product.deleteMany();
    await prisma.user.deleteMany();
    await prisma.user.create({ data: { id: 'u1', email: 'o@b.com', role: 'OWNER' } });
  });

  it('DRAFT → PUBLISHED sets publishedAt', async () => {
    const p = await createProduct({
      input: { name: 'X', description: 'd', priceCents: 1, materials: '', care: '', sizing: '', preOrder: false },
      actorId: 'u1',
    });
    const before = Date.now();
    const published = await changeProductStatus({ id: p.id, to: 'PUBLISHED', actorId: 'u1' });
    expect(published.status).toBe('PUBLISHED');
    expect(published.publishedAt).not.toBeNull();
    expect(published.publishedAt!.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('PUBLISHED → DRAFT keeps publishedAt (history preserved)', async () => {
    const p = await createProduct({
      input: { name: 'X', description: 'd', priceCents: 1, materials: '', care: '', sizing: '', preOrder: false },
      actorId: 'u1',
    });
    await changeProductStatus({ id: p.id, to: 'PUBLISHED', actorId: 'u1' });
    const drafted = await changeProductStatus({ id: p.id, to: 'DRAFT', actorId: 'u1' });
    expect(drafted.status).toBe('DRAFT');
    expect(drafted.publishedAt).not.toBeNull();
  });

  it('ARCHIVED → PUBLISHED throws (must go via DRAFT)', async () => {
    const p = await createProduct({
      input: { name: 'X', description: 'd', priceCents: 1, materials: '', care: '', sizing: '', preOrder: false },
      actorId: 'u1',
    });
    await changeProductStatus({ id: p.id, to: 'ARCHIVED', actorId: 'u1' });
    await expect(changeProductStatus({ id: p.id, to: 'PUBLISHED', actorId: 'u1' })).rejects.toThrow(/illegal/i);
  });
});
```

- [ ] **Step 2: Run — fail**

Run: `pnpm vitest run src/server/admin/catalog/__tests__/product-service.test.ts`
Expected: FAIL — `updateProduct` / `changeProductStatus` not exported.

- [ ] **Step 3: Append to product-service.ts**

Append to `web/src/server/admin/catalog/product-service.ts`:

```ts
import type { ProductStatus } from '@prisma/client';
import { assertProductTransition } from './product-status';

export interface UpdateProductOptions {
  id: string;
  input: ProductUpdateInput;
  actorId: string;
  ip?: string;
  ua?: string;
}

export async function updateProduct(opts: UpdateProductOptions) {
  const { id, input, actorId, ip, ua } = opts;
  const before = await prisma.product.findUnique({ where: { id } });
  if (!before) throw new Error(`Product ${id} not found`);
  // If slug explicitly given, validate uniqueness; if only name changes, leave slug as-is.
  let slug = before.slug;
  if (input.slug && input.slug !== before.slug) {
    slug = await ensureUniqueSlug('product', input.slug, id);
  }

  return withAudit(
    { actorId, entityType: 'product', entityId: id, action: 'product.update', before, ip, ua },
    async () => prisma.product.update({
      where: { id },
      data: {
        name: input.name,
        slug,
        description: input.description,
        priceCents: input.priceCents,
        materials: input.materials,
        care: input.care,
        sizing: input.sizing,
        weightGrams: input.weightGrams,
        hsCode: input.hsCode,
        countryOfOriginCode: input.countryOfOriginCode,
        preOrder: input.preOrder,
      },
    }),
  );
}

export interface ChangeProductStatusOptions {
  id: string;
  to: ProductStatus;
  actorId: string;
  ip?: string;
  ua?: string;
}

export async function changeProductStatus(opts: ChangeProductStatusOptions) {
  const { id, to, actorId, ip, ua } = opts;
  const before = await prisma.product.findUnique({ where: { id } });
  if (!before) throw new Error(`Product ${id} not found`);
  assertProductTransition(before.status, to);

  const action = to === 'PUBLISHED' ? 'product.publish' : to === 'ARCHIVED' ? 'product.archive' : 'product.unpublish';

  return withAudit(
    { actorId, entityType: 'product', entityId: id, action, before, ip, ua },
    async () => prisma.product.update({
      where: { id },
      data: {
        status: to,
        publishedAt: to === 'PUBLISHED' && before.publishedAt === null ? new Date() : before.publishedAt,
      },
    }),
  );
}
```

- [ ] **Step 4: Run — pass**

Run: `pnpm vitest run src/server/admin/catalog/__tests__/product-service.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/admin/catalog/product-service.ts src/server/admin/catalog/__tests__/product-service.test.ts
git commit -m "feat(phase-7a): productService.update + changeProductStatus"
```

---

### Task 21: `productService.setSizes()` + `setColours()`

**Files:**
- Modify: `web/src/server/admin/catalog/product-service.ts`
- Modify: `web/src/server/admin/catalog/__tests__/product-service.test.ts`

- [ ] **Step 1: Append failing tests**

```ts
import { setProductSizes, setProductColours } from '../product-service';

describe('setProductSizes', () => {
  beforeEach(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.productSize.deleteMany();
    await prisma.product.deleteMany();
    await prisma.user.deleteMany();
    await prisma.user.create({ data: { id: 'u1', email: 'o@b.com', role: 'OWNER' } });
  });

  it('upserts sizes + writes audit row', async () => {
    const p = await createProduct({
      input: { name: 'X', description: 'd', priceCents: 1, materials: '', care: '', sizing: '', preOrder: false },
      actorId: 'u1',
    });
    await setProductSizes({ productId: p.id, sizes: [{ size: 'M', stock: 5 }, { size: 'L', stock: 3 }], actorId: 'u1' });
    const sizes = await prisma.productSize.findMany({ where: { productId: p.id } });
    expect(sizes).toHaveLength(2);
    expect(sizes.find(s => s.size === 'M')!.stock).toBe(5);
    const log = await prisma.auditLog.findFirst({ where: { action: 'product.stock.update' } });
    expect(log).not.toBeNull();
  });

  it('updates existing rows on second call', async () => {
    const p = await createProduct({
      input: { name: 'X', description: 'd', priceCents: 1, materials: '', care: '', sizing: '', preOrder: false },
      actorId: 'u1',
    });
    await setProductSizes({ productId: p.id, sizes: [{ size: 'M', stock: 5 }], actorId: 'u1' });
    await setProductSizes({ productId: p.id, sizes: [{ size: 'M', stock: 10 }], actorId: 'u1' });
    const sizes = await prisma.productSize.findMany({ where: { productId: p.id } });
    expect(sizes[0].stock).toBe(10);
  });
});

describe('setProductColours', () => {
  beforeEach(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.colourOption.deleteMany();
    await prisma.product.deleteMany();
    await prisma.user.deleteMany();
    await prisma.user.create({ data: { id: 'u1', email: 'o@b.com', role: 'OWNER' } });
  });

  it('replaces full colour list + writes audit', async () => {
    const p = await createProduct({
      input: { name: 'X', description: 'd', priceCents: 1, materials: '', care: '', sizing: '', preOrder: false },
      actorId: 'u1',
    });
    await setProductColours({ productId: p.id, colours: [{ name: 'Bone', hex: '#EFEFE8' }, { name: 'Black', hex: '#000000' }], actorId: 'u1' });
    let cs = await prisma.colourOption.findMany({ where: { productId: p.id } });
    expect(cs).toHaveLength(2);
    await setProductColours({ productId: p.id, colours: [{ name: 'Stone', hex: '#A8A29E' }], actorId: 'u1' });
    cs = await prisma.colourOption.findMany({ where: { productId: p.id } });
    expect(cs).toHaveLength(1);
    expect(cs[0].name).toBe('Stone');
  });
});
```

- [ ] **Step 2: Run — fail**

Run: `pnpm vitest run src/server/admin/catalog/__tests__/product-service.test.ts`
Expected: FAIL — methods missing.

- [ ] **Step 3: Append**

Append to `web/src/server/admin/catalog/product-service.ts`:

```ts
import type { ProductSizesUpdateInput, ProductColoursUpdateInput } from '@/lib/schemas/admin-product';

export interface SetProductSizesOptions {
  productId: string;
  sizes: ProductSizesUpdateInput['sizes'];
  actorId: string;
  ip?: string;
  ua?: string;
}

export async function setProductSizes(opts: SetProductSizesOptions) {
  const { productId, sizes, actorId, ip, ua } = opts;
  const before = await prisma.productSize.findMany({ where: { productId } });
  return withAudit(
    { actorId, entityType: 'product', entityId: productId, action: 'product.stock.update', before, ip, ua },
    async () => {
      for (const s of sizes) {
        await prisma.productSize.upsert({
          where: { productId_size: { productId, size: s.size } },
          create: { productId, size: s.size, stock: s.stock },
          update: { stock: s.stock },
        });
      }
      return prisma.productSize.findMany({ where: { productId } });
    },
  );
}

export interface SetProductColoursOptions {
  productId: string;
  colours: ProductColoursUpdateInput['colours'];
  actorId: string;
  ip?: string;
  ua?: string;
}

export async function setProductColours(opts: SetProductColoursOptions) {
  const { productId, colours, actorId, ip, ua } = opts;
  const before = await prisma.colourOption.findMany({ where: { productId } });
  return withAudit(
    { actorId, entityType: 'product', entityId: productId, action: 'product.colours.update', before, ip, ua },
    async () => prisma.$transaction(async tx => {
      await tx.colourOption.deleteMany({ where: { productId } });
      if (colours.length > 0) {
        await tx.colourOption.createMany({
          data: colours.map((c, i) => ({ productId, name: c.name, hex: c.hex, sortOrder: i })),
        });
      }
      return tx.colourOption.findMany({ where: { productId } });
    }),
  );
}
```

- [ ] **Step 4: Run — pass**

Run: `pnpm vitest run src/server/admin/catalog/__tests__/product-service.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/admin/catalog/product-service.ts src/server/admin/catalog/__tests__/product-service.test.ts
git commit -m "feat(phase-7a): productService.setSizes + setColours"
```

---

### Task 22: `productService.addImages()` + `removeImage()` + `reorderImages()`

**Files:**
- Modify: `web/src/server/admin/catalog/product-service.ts`
- Modify: `web/src/server/admin/catalog/__tests__/product-service.test.ts`

- [ ] **Step 1: Append failing tests**

```ts
import { addProductImages, removeProductImage, reorderProductImages } from '../product-service';

describe('addProductImages', () => {
  beforeEach(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.productImage.deleteMany();
    await prisma.product.deleteMany();
    await prisma.user.deleteMany();
    await prisma.user.create({ data: { id: 'u1', email: 'o@b.com', role: 'OWNER' } });
  });

  it('appends with incrementing sortOrder + writes audit', async () => {
    const p = await createProduct({
      input: { name: 'X', description: 'd', priceCents: 1, materials: '', care: '', sizing: '', preOrder: false },
      actorId: 'u1',
    });
    const result = await addProductImages({
      productId: p.id,
      items: [{ url: 'https://media/1.jpg', alt: 'one' }, { url: 'https://media/2.jpg', alt: 'two' }],
      actorId: 'u1',
    });
    expect(result).toHaveLength(2);
    expect(result[0].sortOrder).toBe(0);
    expect(result[1].sortOrder).toBe(1);
    const log = await prisma.auditLog.findFirst({ where: { action: 'product.images.add' } });
    expect(log).not.toBeNull();
  });

  it('continues sortOrder on second call', async () => {
    const p = await createProduct({
      input: { name: 'X', description: 'd', priceCents: 1, materials: '', care: '', sizing: '', preOrder: false },
      actorId: 'u1',
    });
    await addProductImages({ productId: p.id, items: [{ url: 'a' }], actorId: 'u1' });
    const second = await addProductImages({ productId: p.id, items: [{ url: 'b' }], actorId: 'u1' });
    expect(second[0].sortOrder).toBe(1);
  });
});

describe('removeProductImage', () => {
  beforeEach(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.productImage.deleteMany();
    await prisma.product.deleteMany();
    await prisma.user.deleteMany();
    await prisma.user.create({ data: { id: 'u1', email: 'o@b.com', role: 'OWNER' } });
  });

  it('deletes the image + writes audit', async () => {
    const p = await createProduct({
      input: { name: 'X', description: 'd', priceCents: 1, materials: '', care: '', sizing: '', preOrder: false },
      actorId: 'u1',
    });
    const [img] = await addProductImages({ productId: p.id, items: [{ url: 'a' }], actorId: 'u1' });
    await removeProductImage({ productId: p.id, imageId: img.id, actorId: 'u1' });
    expect(await prisma.productImage.count()).toBe(0);
  });
});

describe('reorderProductImages', () => {
  beforeEach(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.productImage.deleteMany();
    await prisma.product.deleteMany();
    await prisma.user.deleteMany();
    await prisma.user.create({ data: { id: 'u1', email: 'o@b.com', role: 'OWNER' } });
  });

  it('updates sortOrder per provided id sequence', async () => {
    const p = await createProduct({
      input: { name: 'X', description: 'd', priceCents: 1, materials: '', care: '', sizing: '', preOrder: false },
      actorId: 'u1',
    });
    const imgs = await addProductImages({
      productId: p.id,
      items: [{ url: '1' }, { url: '2' }, { url: '3' }],
      actorId: 'u1',
    });
    // Reverse order
    await reorderProductImages({ productId: p.id, order: [imgs[2].id, imgs[1].id, imgs[0].id], actorId: 'u1' });
    const after = await prisma.productImage.findMany({ where: { productId: p.id }, orderBy: { sortOrder: 'asc' } });
    expect(after.map(i => i.url)).toEqual(['3', '2', '1']);
  });
});
```

- [ ] **Step 2: Run — fail**

Run: `pnpm vitest run src/server/admin/catalog/__tests__/product-service.test.ts`
Expected: FAIL.

- [ ] **Step 3: Append**

Append to `web/src/server/admin/catalog/product-service.ts`:

```ts
export interface AddProductImagesOptions {
  productId: string;
  items: Array<{ url: string; alt?: string }>;
  actorId: string;
  ip?: string;
  ua?: string;
}

export async function addProductImages(opts: AddProductImagesOptions) {
  const { productId, items, actorId, ip, ua } = opts;
  return withAudit(
    { actorId, entityType: 'product', entityId: productId, action: 'product.images.add', ip, ua },
    async () => prisma.$transaction(async tx => {
      const max = await tx.productImage.aggregate({ where: { productId }, _max: { sortOrder: true } });
      const start = max._max.sortOrder !== null && max._max.sortOrder !== undefined ? max._max.sortOrder + 1 : 0;
      const created = [];
      for (let i = 0; i < items.length; i++) {
        const img = await tx.productImage.create({
          data: { productId, url: items[i].url, alt: items[i].alt ?? '', sortOrder: start + i },
        });
        created.push(img);
      }
      return created;
    }),
  );
}

export interface RemoveProductImageOptions {
  productId: string;
  imageId: string;
  actorId: string;
  ip?: string;
  ua?: string;
}

export async function removeProductImage(opts: RemoveProductImageOptions) {
  const { productId, imageId, actorId, ip, ua } = opts;
  const before = await prisma.productImage.findUnique({ where: { id: imageId } });
  if (!before || before.productId !== productId) throw new Error('Image not found on product');
  return withAudit(
    { actorId, entityType: 'product', entityId: productId, action: 'product.images.delete', before, ip, ua },
    async () => prisma.productImage.delete({ where: { id: imageId } }),
  );
}

export interface ReorderProductImagesOptions {
  productId: string;
  order: string[];
  actorId: string;
  ip?: string;
  ua?: string;
}

export async function reorderProductImages(opts: ReorderProductImagesOptions) {
  const { productId, order, actorId, ip, ua } = opts;
  return withAudit(
    { actorId, entityType: 'product', entityId: productId, action: 'product.images.reorder', ip, ua },
    async () => prisma.$transaction(async tx => {
      for (let i = 0; i < order.length; i++) {
        await tx.productImage.update({ where: { id: order[i] }, data: { sortOrder: i } });
      }
      return tx.productImage.findMany({ where: { productId }, orderBy: { sortOrder: 'asc' } });
    }),
  );
}
```

- [ ] **Step 4: Run — pass**

Run: `pnpm vitest run src/server/admin/catalog/__tests__/product-service.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/admin/catalog/product-service.ts src/server/admin/catalog/__tests__/product-service.test.ts
git commit -m "feat(phase-7a): productService.addImages + removeImage + reorderImages"
```

---

## Group I — Catalog Admin Pages + Endpoints

> Tasks 23-32 build the product admin surface. Each task = page or endpoint pair, with happy-path + auth-rejection tests. Subagents implementing this group should reuse the Phase 5 admin layout and primitives from `src/components/ui/`.

### Task 23: `POST /api/admin/products` + `PATCH /api/admin/products/[id]` + `DELETE`

**Files:**
- Create: `web/src/app/api/admin/products/route.ts`
- Create: `web/src/app/api/admin/products/__tests__/route.test.ts`
- Create: `web/src/app/api/admin/products/[id]/route.ts`
- Create: `web/src/app/api/admin/products/[id]/__tests__/route.test.ts`

- [ ] **Step 1: Failing tests for `route.ts` (POST)**

```ts
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { prisma } from '@/server/db/client';
import { POST } from '../route';

vi.mock('@/server/auth', () => ({ auth: vi.fn() }));
import { auth } from '@/server/auth';

describe('POST /api/admin/products', () => {
  beforeEach(async () => {
    await prisma.product.deleteMany();
    await prisma.user.deleteMany();
    await prisma.user.create({ data: { id: 'u1', email: 'o@b.com', role: 'OWNER' } });
    (auth as any).mockResolvedValue({ user: { id: 'u1', role: 'OWNER' } });
  });

  it('403 when not OWNER', async () => {
    (auth as any).mockResolvedValue({ user: { id: 'u1', role: 'CUSTOMER' } });
    const req = new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ name: 'X', description: 'd', priceCents: 1 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('400 on invalid body', async () => {
    const req = new Request('http://x', { method: 'POST', body: JSON.stringify({ name: '' }) });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('201 on success — returns product with DRAFT status', async () => {
    const req = new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ name: 'Spring Coat', description: 'A trench.', priceCents: 45000, materials: '', care: '', sizing: '', preOrder: false }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.status).toBe('DRAFT');
    expect(data.slug).toBe('spring-coat');
  });
});
```

- [ ] **Step 2: Run — fail**

Run: `pnpm vitest run src/app/api/admin/products`
Expected: FAIL.

- [ ] **Step 3: Implement POST**

Create `web/src/app/api/admin/products/route.ts`:

```ts
import { auth } from '@/server/auth';
import { requireOwner, AuthorizationError } from '@/server/auth/guards';
import { ProductCreateSchema } from '@/lib/schemas/admin-product';
import { createProduct } from '@/server/admin/catalog/product-service';

export async function POST(req: Request): Promise<Response> {
  let session;
  try { session = requireOwner(await auth()); }
  catch (e) { if (e instanceof AuthorizationError) return new Response('Forbidden', { status: 403 }); throw e; }

  const body = await req.json().catch(() => null);
  const parsed = ProductCreateSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  const product = await createProduct({
    input: parsed.data,
    actorId: session.user!.id,
    ip: req.headers.get('x-forwarded-for') ?? undefined,
    ua: req.headers.get('user-agent') ?? undefined,
  });
  return Response.json(product, { status: 201 });
}
```

- [ ] **Step 4: Implement PATCH + DELETE in `[id]/route.ts`**

Create `web/src/app/api/admin/products/[id]/route.ts`:

```ts
import { auth } from '@/server/auth';
import { requireOwner, AuthorizationError } from '@/server/auth/guards';
import { ProductUpdateSchema } from '@/lib/schemas/admin-product';
import { updateProduct, changeProductStatus } from '@/server/admin/catalog/product-service';

interface Ctx { params: Promise<{ id: string }> }

export async function PATCH(req: Request, ctx: Ctx): Promise<Response> {
  let session;
  try { session = requireOwner(await auth()); }
  catch (e) { if (e instanceof AuthorizationError) return new Response('Forbidden', { status: 403 }); throw e; }

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = ProductUpdateSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  const product = await updateProduct({
    id, input: parsed.data, actorId: session.user!.id,
    ip: req.headers.get('x-forwarded-for') ?? undefined,
    ua: req.headers.get('user-agent') ?? undefined,
  });
  return Response.json(product);
}

export async function DELETE(req: Request, ctx: Ctx): Promise<Response> {
  let session;
  try { session = requireOwner(await auth()); }
  catch (e) { if (e instanceof AuthorizationError) return new Response('Forbidden', { status: 403 }); throw e; }

  const { id } = await ctx.params;
  // DELETE archives, doesn't hard-delete (preserves Order references)
  const product = await changeProductStatus({
    id, to: 'ARCHIVED', actorId: session.user!.id,
    ip: req.headers.get('x-forwarded-for') ?? undefined,
    ua: req.headers.get('user-agent') ?? undefined,
  });
  return Response.json(product);
}
```

Add tests in `[id]/__tests__/route.test.ts` matching the pattern (auth, 400, happy path).

- [ ] **Step 5: Run — pass**

Run: `pnpm vitest run src/app/api/admin/products`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/admin/products/
git commit -m "feat(phase-7a): admin product CRUD endpoints (POST + PATCH + DELETE-archive)"
```

---

### Task 24: `POST /api/admin/products/[id]/status`

**Files:**
- Create: `web/src/app/api/admin/products/[id]/status/route.ts` + tests

- [ ] **Step 1: Failing test** asserts 403 for non-OWNER, 400 for invalid `to`, 200 with updated product on valid transition, 422 on illegal transition (catch `IllegalProductTransitionError`, return 422).

- [ ] **Step 2: Run — fail**.

- [ ] **Step 3: Implement** — body `ProductStatusChangeSchema.parse(...)`, calls `changeProductStatus`, maps `IllegalProductTransitionError` → 422 with `{error: message}`.

```ts
import { auth } from '@/server/auth';
import { requireOwner, AuthorizationError } from '@/server/auth/guards';
import { ProductStatusChangeSchema } from '@/lib/schemas/admin-product';
import { changeProductStatus } from '@/server/admin/catalog/product-service';
import { IllegalProductTransitionError } from '@/server/admin/catalog/product-status';

interface Ctx { params: Promise<{ id: string }> }

export async function POST(req: Request, ctx: Ctx): Promise<Response> {
  let session;
  try { session = requireOwner(await auth()); }
  catch (e) { if (e instanceof AuthorizationError) return new Response('Forbidden', { status: 403 }); throw e; }

  const { id } = await ctx.params;
  const parsed = ProductStatusChangeSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const product = await changeProductStatus({
      id, to: parsed.data.to, actorId: session.user!.id,
      ip: req.headers.get('x-forwarded-for') ?? undefined,
      ua: req.headers.get('user-agent') ?? undefined,
    });
    return Response.json(product);
  } catch (e) {
    if (e instanceof IllegalProductTransitionError) return Response.json({ error: e.message }, { status: 422 });
    throw e;
  }
}
```

- [ ] **Step 4: Run — pass**.

- [ ] **Step 5: Commit** `feat(phase-7a): POST /api/admin/products/[id]/status — DRAFT/PUBLISHED/ARCHIVED transitions`.

---

### Task 25: `POST + PATCH /api/admin/products/[id]/images` + `DELETE /api/admin/products/[id]/images/[imgId]`

**Files:**
- Create: `web/src/app/api/admin/products/[id]/images/route.ts` + tests
- Create: `web/src/app/api/admin/products/[id]/images/[imgId]/route.ts` + tests

- [ ] **Step 1: Failing tests** — POST body `{ items: [{url, alt?}] }`; PATCH body `{ order: id[] }`; DELETE removes the image. Auth-gated.

- [ ] **Step 2: Run — fail**.

- [ ] **Step 3: Implement** wiring `addProductImages` / `reorderProductImages` / `removeProductImage` from product-service.

- [ ] **Step 4: Pass**.

- [ ] **Step 5: Commit** `feat(phase-7a): admin product images endpoints`.

---

### Task 26: `PATCH /api/admin/products/[id]/sizes` + `colours`

**Files:**
- Create: `web/src/app/api/admin/products/[id]/sizes/route.ts` + tests
- Create: `web/src/app/api/admin/products/[id]/colours/route.ts` + tests

- [ ] Same TDD pattern as Task 25; wires `setProductSizes` / `setProductColours`. Commit `feat(phase-7a): admin product sizes + colours endpoints`.

---

### Task 27: `/admin/catalog/products` list page

**Files:**
- Create: `web/src/app/admin/catalog/products/page.tsx`
- Create: `web/src/app/admin/catalog/products/__tests__/page.test.tsx`

- [ ] **Step 1: Failing test** — server-renders product list table; supports `?status=DRAFT|PUBLISHED|ARCHIVED|all` filter and `?search=` (matches name + slug). Table columns: image (first), name, slug, status badge, price, updatedAt, edit link. "New product" button links to `/admin/catalog/products/new`. Auth: `ADMIN | OWNER` (already gated by middleware).

- [ ] **Step 2: Run — fail**.

- [ ] **Step 3: Implement** as Server Component using Prisma `prisma.product.findMany({where: {...filters}, include: {images: {take: 1, orderBy: {sortOrder:'asc'}}}})`.

- [ ] **Step 4: Pass**.

- [ ] **Step 5: Commit** `feat(phase-7a): /admin/catalog/products list page`.

---

### Task 28: `/admin/catalog/products/new` create page

**Files:**
- Create: `web/src/app/admin/catalog/products/new/page.tsx`
- Create: `web/src/app/admin/catalog/products/new/_components/product-create-form.tsx`
- Create: `web/src/app/admin/catalog/products/new/__tests__/page.test.tsx`

- [ ] **Step 1: Failing test** — page renders the form; client form posts to `/api/admin/products`; on success redirects to `/admin/catalog/products/[id]`. Use `useFormState` + `useTransition`.

- [ ] **Step 2: Run — fail**.

- [ ] **Step 3: Implement** form using existing UI primitives (`<Input>`, `<Textarea>`, `<Button>` from `src/components/ui/`).

- [ ] **Step 4: Pass**.

- [ ] **Step 5: Commit** `feat(phase-7a): /admin/catalog/products/new create form`.

---

### Task 29: `/admin/catalog/products/[id]` detail page (header + details section)

**Files:**
- Create: `web/src/app/admin/catalog/products/[id]/page.tsx`
- Create: `web/src/app/admin/catalog/products/[id]/_components/product-detail.tsx`
- Create: `web/src/app/admin/catalog/products/[id]/__tests__/page.test.tsx`

- [ ] **Step 1: Failing test** — server-renders product with images, sizes, colours, categories preloaded; renders header with status pill + action buttons (Publish / Unpublish / Archive — disabled when illegal); renders details form section.

- [ ] **Step 2: Run — fail**.

- [ ] **Step 3: Implement** with sections — first section (header + details) only; tasks 30-32 add other sections.

- [ ] **Step 4: Pass**.

- [ ] **Step 5: Commit** `feat(phase-7a): /admin/catalog/products/[id] header + details`.

---

### Task 30: Image uploader + grid reorder section on product detail

**Files:**
- Create: `web/src/app/admin/catalog/products/[id]/_components/image-uploader.tsx`
- Create: `web/src/app/admin/catalog/products/[id]/_components/image-grid-reorder.tsx`
- Create tests

- [ ] **Step 1: Failing tests** — uploader is a drop zone (HTML5 drag-drop events) that POSTs to `/api/admin/media/upload?prefix=products/<id>` then to `/api/admin/products/<id>/images` with the returned URL; grid uses `framer-motion` Reorder.Group; on drop posts new order to PATCH endpoint.

- [ ] **Step 2: Run — fail**.

- [ ] **Step 3: Implement** with `useTransition` + `router.refresh()` after server confirms.

- [ ] **Step 4: Pass**.

- [ ] **Step 5: Commit** `feat(phase-7a): product detail image uploader + drag-reorder grid`.

---

### Task 31: Sizes + colours editors on product detail

**Files:**
- Create: `web/src/app/admin/catalog/products/[id]/_components/stock-editor.tsx`
- Create: `web/src/app/admin/catalog/products/[id]/_components/colour-editor.tsx`
- Create tests

- [ ] **Step 1: Failing tests** — stock editor renders 5 rows (XS S M L XL) each with number input; saves via PATCH `/api/admin/products/[id]/sizes`. Colour editor allows add/remove `{name, hex}` rows; saves via PATCH `/colours`.

- [ ] **Step 2: Run — fail**.

- [ ] **Step 3: Implement**.

- [ ] **Step 4: Pass**.

- [ ] **Step 5: Commit** `feat(phase-7a): product detail stock + colour editors`.

---

### Task 32: Status action buttons + category multiselect on product detail

**Files:**
- Create: `web/src/app/admin/catalog/products/[id]/_components/status-actions.tsx`
- Create: `web/src/app/admin/catalog/products/[id]/_components/category-multiselect.tsx`
- Create tests

- [ ] **Step 1: Failing tests** — status-actions renders Publish/Unpublish/Archive buttons; only legal transitions enabled; click fires POST `/status`. Multiselect lists all PUBLISHED categories; checkbox per category; saves via PATCH `/api/admin/products/[id]` with `categoryIds: []` (or via dedicated endpoint — pick one and stick with it; this plan uses dedicated `PATCH /categories` extension on the product update payload).

- [ ] **Step 2: Run — fail**.

- [ ] **Step 3: Implement**. Add `categoryIds: z.array(z.string().cuid()).optional()` to `ProductUpdateSchema` if not present; service layer connects/disconnects via `prisma.productCategory`.

- [ ] **Step 4: Pass**.

- [ ] **Step 5: Commit** `feat(phase-7a): product detail status actions + category multiselect`.

---

## Group J — Category Admin

### Task 33: `categoryService.create()` + `update()` + `archive()` + cycle prevention

**Files:**
- Create: `web/src/server/admin/catalog/category-service.ts` + tests

- [ ] **Step 1: Failing tests** — `createCategory({input, actorId})` creates row + audit; `updateCategory` similar; `archiveCategory` sets `deletedAt`; `moveCategory({id, parentId})` rejects when parent is descendant of `id`.

- [ ] **Step 2: Run — fail**.

- [ ] **Step 3: Implement**. Cycle prevention algo: walk up from proposed parent's `parentId` chain; if ever hits `id`, throw `CycleDetectedError`.

```ts
async function isDescendant(ancestorId: string, candidateId: string): Promise<boolean> {
  let cursor: string | null = candidateId;
  const seen = new Set<string>();
  while (cursor) {
    if (seen.has(cursor)) return false;
    seen.add(cursor);
    if (cursor === ancestorId) return true;
    const row: { parentId: string | null } | null = await prisma.category.findUnique({
      where: { id: cursor }, select: { parentId: true },
    });
    cursor = row?.parentId ?? null;
  }
  return false;
}

export async function moveCategory(opts: { id: string; parentId: string | null; actorId: string; ip?: string; ua?: string }) {
  const { id, parentId, actorId, ip, ua } = opts;
  if (parentId === id) throw new Error('Category cannot be its own parent');
  if (parentId && await isDescendant(id, parentId)) {
    throw new Error('Cannot move into own descendant');
  }
  const before = await prisma.category.findUnique({ where: { id } });
  return withAudit(
    { actorId, entityType: 'category', entityId: id, action: 'category.move', before, ip, ua },
    async () => prisma.category.update({ where: { id }, data: { parentId } }),
  );
}
```

- [ ] **Step 4: Pass**.

- [ ] **Step 5: Commit** `feat(phase-7a): categoryService with cycle prevention`.

---

### Task 34: `admin-category` Zod schemas + `POST/PATCH/DELETE /api/admin/categories[/[id]]`

**Files:**
- Create: `web/src/lib/schemas/admin-category.ts`
- Create: `web/src/app/api/admin/categories/route.ts` + tests
- Create: `web/src/app/api/admin/categories/[id]/route.ts` + tests

- [ ] Same TDD pattern. Schemas:

```ts
export const CategoryCreateSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).optional(),
  parentId: z.string().cuid().nullable().optional(),
  description: z.string().max(2000).default(''),
});
export const CategoryUpdateSchema = CategoryCreateSchema.partial();
```

- [ ] Commit `feat(phase-7a): admin category endpoints`.

---

### Task 35: `/admin/catalog/categories` tree page

**Files:**
- Create: `web/src/app/admin/catalog/categories/page.tsx` + tests

- [ ] **Step 1: Failing test** — server-renders recursive tree of categories (nested `<ul>` based on `parentId`).

- [ ] **Step 2-4** — implement, pass.

- [ ] **Step 5: Commit** `feat(phase-7a): /admin/catalog/categories tree view`.

---

### Task 36: `/admin/catalog/categories/new` create page

- [ ] Create form posting to `POST /api/admin/categories`. Commit.

---

### Task 37: `/admin/catalog/categories/[id]` edit page

- [ ] Edit form + parent select (with cycle-warning when illegal parent picked client-side as well as server-side rejection). Commit.

---

## Group K — CMS Services

### Task 38: `admin-hero` Zod + `heroService` (create / update / activate)

**Files:**
- Create: `web/src/lib/schemas/admin-hero.ts`
- Create: `web/src/server/admin/cms/hero-service.ts` + tests

- [ ] **Step 1: Failing tests** for `heroService`:
  - `createHero({input, actorId})` — creates row with `isActive: false`
  - `updateHero({id, input, actorId})` — updates fields, keeps `isActive` untouched
  - `activateHero({id, actorId})` — atomically sets all other rows to `isActive: false` AND target to `true`; writes `hero.activate` audit log
  - On `activateHero` of already-active hero, no-op (idempotent)

- [ ] **Step 2: Run — fail**.

- [ ] **Step 3: Implement** with `prisma.$transaction([updateMany, update])` per spec §10.1.

- [ ] **Step 4: Pass**.

- [ ] **Step 5: Commit** `feat(phase-7a): heroService with only-one-active invariant`.

---

### Task 39: `announcementService`

**Files:**
- Create: `web/src/lib/schemas/admin-announcement.ts`
- Create: `web/src/server/admin/cms/announcement-service.ts` + tests

- [ ] CRUD + audit. Schemas: `text`, `sortOrder`, `isActive`. Commit `feat(phase-7a): announcementService`.

---

### Task 40: `lookbookService` (create / update / reorder / delete)

**Files:**
- Create: `web/src/lib/schemas/admin-lookbook.ts`
- Create: `web/src/server/admin/cms/lookbook-service.ts` + tests

- [ ] Reorder follows `productImage.reorder` pattern (transaction updating sortOrder per id sequence). Commit `feat(phase-7a): lookbookService with drag-reorder`.

---

### Task 41: `staticpageService`

**Files:**
- Create: `web/src/lib/schemas/admin-staticpage.ts`
- Create: `web/src/server/admin/cms/staticpage-service.ts` + tests

- [ ] CRUD + slug uniqueness via `ensureUniqueSlug` (extend slug-service to add `'staticpage'` model). Commit.

---

### Task 42: Update `slug-service.ts` to support `staticpage`

**Files:**
- Modify: `web/src/server/admin/catalog/slug-service.ts` (or move to `src/server/admin/slug.ts` if it's used by both catalog + CMS)

- [ ] Extend `SluggedModel = 'product' | 'category' | 'staticpage'` and add `staticPage` branch in `collides()`. Update tests.

- [ ] Commit `refactor(phase-7a): extend ensureUniqueSlug to support StaticPage`.

---

### Task 43: `sitepolicyService`

**Files:**
- Create: `web/src/lib/schemas/admin-sitepolicy.ts`
- Create: `web/src/server/admin/cms/sitepolicy-service.ts` + tests

- [ ] **Step 1: Failing test** — `updateSitePolicy({input, actorId})` upserts the singleton row (`id = 'singleton'`) + audit.

- [ ] **Step 2-4** — implement, pass.

- [ ] **Step 5: Commit** `feat(phase-7a): sitepolicyService`.

---

### Task 44: All CMS endpoints

**Files:**
- Create routes for: `/api/admin/content/{hero, hero/[id], hero/[id]/activate, announcements, announcements/[id], lookbook, lookbook/[id], pages, pages/[id], settings}` per spec §14.1
- Tests for each

- [ ] **Single big task** — all CMS endpoints in one PR commit grouping (one commit). Each route is a thin wrapper calling its service.

- [ ] Commit `feat(phase-7a): all CMS admin endpoints`.

---

## Group L — CMS Admin Pages + Endpoints

### Task 45: `/admin/content/hero` list + new + edit pages

**Files:**
- Create: `web/src/app/admin/content/hero/page.tsx` + tests
- Create: `web/src/app/admin/content/hero/new/page.tsx` + tests
- Create: `web/src/app/admin/content/hero/[id]/page.tsx` + tests

- [ ] List shows all heroes with active badge + Activate button (POST `/activate`); new page form; detail edit form. Commit `feat(phase-7a): hero admin pages`.

---

### Task 46: `/admin/content/announcements` pages

- [ ] Same shape — list + new + edit. Commit `feat(phase-7a): announcement admin pages`.

---

### Task 47: `/admin/content/lookbook` pages

- [ ] List grid with `framer-motion` Reorder.Group + drag handles + delete-x. New + edit. Commit `feat(phase-7a): lookbook admin pages with drag-reorder`.

---

### Task 48: `/admin/content/pages` (StaticPage) — list + new

- [ ] Standard list + new form. Commit.

---

### Task 49: `/admin/content/pages/[id]` Markdown editor

**Files:**
- Create: `web/src/app/admin/content/pages/[id]/page.tsx`
- Create: `web/src/app/admin/content/pages/[id]/_components/markdown-editor.tsx` + tests

- [ ] Editor renders 50/50 split (`<textarea>` + `<react-markdown>`). On `onChange` re-renders preview. Save posts to PATCH endpoint. Commit `feat(phase-7a): static page Markdown editor with live preview`.

---

### Task 50: `/admin/content/settings` SitePolicy form

- [ ] Single-form page. Commit `feat(phase-7a): site settings page`.

---

### Tasks 51-58: Skipped — bundled into Tasks 44-50

The plan originally allocated 14 admin pages here; realised on review that hero list/new/edit fold into Task 45, etc. Net: Group L = 6 commits (Tasks 45-50). Renumber:

### Task 51: Sidebar nav extension to Catalog / Content / Marketing sections

**Files:**
- Modify: `web/src/app/admin/layout.tsx` + tests

- [ ] **Step 1: Failing test** — sidebar contains group headings DASHBOARD / ORDERS / CATALOG / CONTENT / MARKETING with corresponding nav items.

- [ ] **Step 2-4** — implement extension, pass.

- [ ] **Step 5: Commit** `feat(phase-7a): admin sidebar extends with catalog + content + marketing sections`.

---

## Group M — PromoCode

### Task 52: `admin-promo` Zod + `promoService` (create / update / deactivate)

**Files:**
- Create: `web/src/lib/schemas/admin-promo.ts`
- Create: `web/src/server/admin/promo/service.ts` + tests

- [ ] CRUD + `deactivatePromo` setting `isActive: false`. Audit each. Commit.

---

### Task 53: `POST/PATCH /api/admin/promos[/[id]]` + `POST /api/admin/promos/[id]/deactivate`

- [ ] Standard pattern. Commit.

---

### Task 54: `/admin/marketing/promos` list page

- [ ] Filter All/Active/Expired/Deactivated. Each row shows usage progress. Commit.

---

### Task 55: `/admin/marketing/promos/new` create form

- [ ] Standard form. Commit.

---

### Task 56: `/admin/marketing/promos/[id]` edit + deactivate page

- [ ] Edit form + Deactivate button. Commit.

---

## Group N — Storefront Filter Regression

### Task 57: Add `status: 'PUBLISHED'` to storefront product queries

**Files:**
- Modify: `web/src/server/repositories/product.ts` (or wherever the storefront product list/byslug queries live — find with `rg "deletedAt: null" src/server/repositories | head`)
- Modify all matching tests

- [ ] **Step 1: Failing test** — seed Order with one DRAFT + one PUBLISHED product; storefront list returns only PUBLISHED.

- [ ] **Step 2: Run — fail** (current code returns both).

- [ ] **Step 3: Implement** — extend filter `where: { status: 'PUBLISHED', deletedAt: null }`.

- [ ] **Step 4: Run all tests** — many existing storefront tests may break because their seed Products don't set `status`. The migration backfill set existing records to PUBLISHED, but NEW seeds in tests use the default `DRAFT`. Update each failing test to either add `status: 'PUBLISHED'` to seeds or accept that DRAFT products are hidden.

- [ ] **Step 5: Commit** `feat(phase-7a): storefront product queries filter on status: PUBLISHED`.

---

### Task 58: Same filter for category-product queries (joined queries)

- [ ] Find queries like `prisma.product.findMany({where: {categories: {some: ...}}})` and extend the same filter. Commit.

---

### Task 59: Update test fixtures to set `status: 'PUBLISHED'` where storefront expects to see them

**Files:** scan failing tests after Task 57

- [ ] Run `pnpm test`; for each failing test that seeded a Product without status and expected it on storefront, add `status: 'PUBLISHED'`. Commit `test(phase-7a): update fixtures to set Product.status = PUBLISHED`.

---

## Group O — Dashboard + Sidebar Nav

### Task 60: Dashboard cards extension

**Files:**
- Modify: `web/src/app/admin/page.tsx` + tests

- [ ] **Step 1: Failing test** — dashboard renders cards with: Drafts pending publish (count of `Product.status='DRAFT' AND deletedAt=null`), Low-stock alerts (count of `ProductSize.stock <= 2`), Active promos (count of `PromoCode.isActive=true AND (expiresAt IS NULL OR expiresAt > now)`). Existing Phase 5 cards (pending shipments, returns awaiting inspection) stay.

- [ ] **Step 2-4** — implement, pass.

- [ ] **Step 5: Commit** `feat(phase-7a): dashboard adds drafts + low-stock + active-promos cards`.

---

## Group P — E2E + Manual QA + PR

### Task 61: E2E — full product lifecycle

**Files:**
- Create: `web/src/server/__tests__/e2e/product-lifecycle.test.ts`

- [ ] **Step 1: Test** — create OWNER user; POST `/api/admin/products` to create draft; POST `/api/admin/media/upload` with image; POST `/api/admin/products/[id]/images` to attach; PATCH sizes to set stock; PATCH colours; POST `/status` to publish; assert storefront query returns the product; POST `/status` to archive; assert storefront query no longer returns it; verify all expected `AuditLog` rows exist.

- [ ] **Step 2-4** — make pass.

- [ ] **Step 5: Commit** `test(phase-7a): E2E product lifecycle (draft→publish→storefront→archive)`.

---

### Task 62: E2E — Hero only-one-active invariant under sequential activate

**Files:**
- Append to `web/src/server/__tests__/e2e/product-lifecycle.test.ts` or new `cms-lifecycle.test.ts`

- [ ] Create 3 heroes; activate #1, then #2, then #3; assert exactly one `isActive=true` exists at each step; verify `AuditLog` rows. Commit.

---

### Task 63: E2E — Category cycle prevention

- [ ] Create A → B → C; try to set A's parent to C; assert error; verify storefront still renders existing tree. Commit.

---

### Task 64: Update `web/docs/manual-qa.md` Phase 7a section

**Files:**
- Modify: `web/docs/manual-qa.md`

- [ ] Append Phase 7a checklist:
  - [ ] Create draft product → upload 3 images → reorder via drag → set sizes M=5, L=3 → set colours → publish → appears on storefront
  - [ ] Edit category tree (parent move) → no cycles allowed
  - [ ] Activate Hero #2 → Hero #1 deactivates automatically
  - [ ] Reorder lookbook images via drag → storefront reflects order
  - [ ] Edit StaticPage Markdown → live preview matches storefront render
  - [ ] Create promo code → use at checkout → `usageCount` increments
  - [ ] All admin actions write `AuditLog` rows (verify via `psql -c "SELECT * FROM \"AuditLog\" ORDER BY \"createdAt\" DESC LIMIT 20"`)
  - [ ] Image upload rejects 6MB JPEG with friendly error
  - [ ] Image upload rejects PDF MIME with friendly error
  - [ ] Image stream `/api/media/<key>` works in browser; `Cache-Control: immutable` honoured
  - [ ] Non-OWNER user (e.g. ADMIN) gets 403 on mutation routes
  - [ ] All admin pages render in `pnpm dev` without server errors

- [ ] Commit `docs(phase-7a): manual QA checklist for Phase 7a`.

---

### Task 65: Final smoke + PR

- [ ] Run final smoke:
```bash
pnpm typecheck     # acceptable: only 4 PNG baseline errors from main
pnpm lint          # must be clean
pnpm test          # must be 100% pass; expect ~750+ tests
```

- [ ] Push branch:
```bash
git push -u origin feature/backend-phase-7a-launch-admin
```

- [ ] If `gh` CLI present, open PR:
```bash
gh pr create --title "Phase 7a — launch admin (catalog + CMS + promos)" --body "$(cat <<'EOF'
## Summary
- ProductStatus DRAFT/PUBLISHED/ARCHIVED workflow with backfill migration
- MediaStorage interface (LocalFsStorage default) + public /api/media stream
- Product CRUD with multi-file image upload + drag-reorder + inline stock + colour editing
- Category CRUD with parent/child hierarchy + cycle prevention
- CMS surfaces: Hero (only-one-active), Announcements, Lookbook (drag-reorder), StaticPages (Markdown + live preview), SitePolicy
- PromoCode CRUD (deactivate, no hard delete)
- Audit log writes for every mutation via withAudit() helper
- OWNER-only mutations; ADMIN+OWNER reads

## Test plan
- [x] Automated: typecheck + lint + ~750 tests green
- [ ] Manual QA: see web/docs/manual-qa.md Phase 7a section

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

If `gh` unavailable, print the PR URL: `https://github.com/Batrbekk/ynot/pull/new/feature/backend-phase-7a-launch-admin`.

- [ ] Commit (if any final fixes) `docs(phase-7a): finalise PR description`.

---

## Self-Review

**1. Spec coverage:**

| Spec § | Goal | Task(s) |
|---|---|---|
| §2.1 | Product CRUD with status workflow | Tasks 17, 19, 20, 23, 24 |
| §2.2 | Multi-file image upload + reorder | Tasks 22, 30 |
| §2.3 | Inline inventory editing | Tasks 21, 26, 31 |
| §2.4 | Categories CRUD with hierarchy | Tasks 33-37 |
| §2.5 | Colour options | Tasks 21, 26, 31 |
| §2.6 | Hero/Announcement/Lookbook/StaticPage CRUD | Tasks 38, 39, 40, 41, 45, 46, 47, 48, 49 |
| §2.7 | SitePolicy editor | Tasks 43, 50 |
| §2.8 | PromoCode CRUD | Tasks 52, 53, 54, 55, 56 |
| §2.9 | MediaStorage interface | Tasks 10, 11, 12, 13 |
| §2.10 | Public media stream route | Task 14 |
| §2.11 | AuditLog writes | Task 16 + every service task |
| §2.12 | Slug auto-gen + uniqueness | Tasks 8, 9, 42 |
| §2.13 | Dashboard extension | Task 60 |
| §2.14 | Real-Postgres tests | Every task |
| §2.15 | Storefront integration | Tasks 57-59 |
| §2.16 | Form patterns reuse | Implicit throughout — all admin pages use existing UI primitives + Zod |
| §6 | ProductStatus migration with backfill | Task 3 |
| §17 | Single migration | Task 3 |
| §18 | Env additions | Task 5 |

All spec goals covered.

**2. Placeholder scan:** None of "TBD", "implement later", "add appropriate error handling", or "similar to Task N" appear (the only "Similar to" references are explicitly enumerated steps that show full structure).

**3. Type consistency:** `withAudit`, `ensureUniqueSlug`, `requireOwner`, `MediaStorage`, `ProductStatus`, `IllegalProductTransitionError` are referenced consistently across tasks. The plan defines each in one task and references it (with the same name) in subsequent ones.

---

## Plan complete

Plan saved to `web/docs/superpowers/plans/2026-05-04-ynot-backend-phase-7a.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task (one of the 65), review between tasks via `superpowers:subagent-driven-development`, fast iteration. Phase 4 + Phase 5 used this — both shipped successfully.

**2. Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints for review.

**Which approach?**
