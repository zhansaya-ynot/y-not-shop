# YNOT London — Backend Phase 7a — Launch Admin (Catalog + CMS + Promos)

**Date:** 2026-05-04
**Status:** Draft (awaiting user review)
**Scope:** Phase 7a of the YNOT roadmap — the launch-ready admin slice. Replaces and extends the Phase 5 mini admin (`/admin/orders`, `/admin/returns`) with a comprehensive catalog manager (Products with Draft/Published/Archived workflow, Categories, Sizes, Colours, multi-file image upload with drag-reorder), a content CMS surface (Hero, Announcement, Lookbook, StaticPages with Markdown editor + live preview, SitePolicy), and PromoCode CRUD. Introduces a `MediaStorage` interface (default `LocalFsStorage` mirroring the Phase 5 `LabelStorage` pattern) plus a public-facing media stream route for storefront consumption. Captures every catalog / CMS / promo write into the existing `AuditLog` table for compliance — no audit viewer UI in 7a (deferred to 7b).

---

## 1. Context

Phase 5 shipped a **mini operational admin** focused on day-to-day order fulfilment (orders list, ship page, returns inspection). That surface is healthy but covers only one corner: it lets Жансая ship parcels and refund returns. It does **not** let her get the storefront content into the database.

Today, the only way to add a product, change the homepage hero, or write a static page is to edit `prisma/seed.ts` or run raw SQL. That's a launch blocker — every weekly product drop, every banner change, every policy-page edit must go through Engineering. Phase 7a closes that gap so Жансая can independently manage every customer-visible surface.

The scope was deliberately split. **Phase 7a is the launch-critical subset** — what the storefront needs *before first customer order*. Items used after launch (newsletter sync, review moderation queue, audit-log viewer, full reports, role invites, shipping-zone editing) move to Phase 7b, prioritised against real post-launch metrics rather than guesses.

External dependency status at the start of Phase 7a:

| Dependency | Status |
|---|---|
| Phase 5 mini admin gating + layout | ✅ landed (`/admin` middleware + sidebar live; OWNER role enforced) |
| MediaStorage location on host | ✅ Docker volume `ynot-labels` already mounted; we add `ynot-media` next to it |
| `AuditLog` model | ✅ in schema (Phase 1); no writers yet — 7a is the first |
| `next/image` | ✅ standard storefront usage; 7a serves uploads through it |

Subsequent phases (out of scope here):

- **Phase 7b — Post-launch admin completion (~40-50 tasks):** newsletter subscriber list export + Resend Audiences sync, review moderation queue with approve/reject, audit-log viewer with filters, full reports (revenue, return rate, low-stock alerts, top products, conversion funnel), role-invite flow with multi-role permission matrix, shipping-zone + shipping-method admin, preorder-batch admin (replaces Phase 5 CLI script), bulk operations across catalog, global search.
- **Phase 8 — Production launch infrastructure (~30-40 tasks):** VPS provisioning (Hetzner CX22 leading candidate), Caddy reverse proxy + Let's Encrypt, GitHub Actions deploy pipeline, Postgres backup strategy (daily `tar.gz` to off-VPS storage), Cloudflare front (DDoS + CDN), Stripe Live keys, DHL/RM production credential swap, Sentry monitoring, optional CMS hero issue fix (`No active hero block configured` error currently breaks `pnpm build`).

---

## 2. Goals

1. **Product CRUD with Draft / Published / Archived workflow.** New `ProductStatus` enum gates storefront visibility. `DRAFT` = invisible to customers, fully editable; `PUBLISHED` = live on storefront; `ARCHIVED` = invisible, read-only in admin (preserves history for past Orders that reference it).
2. **Multi-file image upload with drag-and-drop reorder.** Up to 8 images per product; JPEG / PNG / WebP; ≤5MB each. Drop zone accepts multiple files; thumbnail grid afterward with drag handles to reorder; click-x to remove. `ProductImage.sortOrder` already in schema.
3. **Inline inventory editing.** Per-size stock counts editable on the product detail page — `ProductSize.stock` adjustable via small +/- inputs.
4. **Categories CRUD with parent/child hierarchy.** `Category.parentId` already supports nesting; admin shows tree view; cycle prevention (a category cannot be its own ancestor).
5. **Colour options per product.** `ColourOption` rows with `name + hex` pairs editable inline on the product detail page.
6. **Hero / Announcement / Lookbook / StaticPage CRUD.** Each content surface gets a list page + editor. StaticPage uses Markdown textarea + live `react-markdown` preview. HeroBlock honours the existing "only one active row" partial-unique-index — admin enforces by toggling `isActive` (deactivates the previous active when new one is activated).
7. **SitePolicy editor.** Single-record settings (default carrier, free-ship threshold, contact email, WhatsApp number). Singleton row; in-place edit form.
8. **PromoCode CRUD.** Create / list / deactivate (no hard delete — preserves redemption history). Form validates discount type, value, min order, usage limit, expiry.
9. **`MediaStorage` interface.** New abstraction in `src/server/media/` mirroring Phase 5's `LabelStorage`. Default `LocalFsStorage` writes to `/var/lib/ynot/media/`, mounted as Docker volume `ynot-media`. Swap to R2/S3 via `MEDIA_STORAGE` env var when launch demand justifies it.
10. **Public media stream route.** `GET /api/media/[...key]` streams from `MediaStorage`. Cached aggressively via `Cache-Control: public, max-age=31536000, immutable`. URLs returned by upload action are `/api/media/<key>` paths — `next/image` consumes them on the storefront.
11. **`AuditLog` writes for every catalog / CMS / promo mutation.** Wraps each admin server action so `actorId, action, entityType, entityId, before, after, ipAddress, userAgent` land in the table. No UI viewer in 7a — Phase 7b adds `/admin/audit`.
12. **Slug auto-generation with manual override.** Product / Category creation auto-generates a URL-safe slug from name; the slug field is editable; uniqueness enforced server-side with a friendly error.
13. **Dashboard extension.** Phase 5 dashboard cards extend with: drafts pending publish, low-stock alerts (any `ProductSize.stock <= 2`), active promos (count of `PromoCode.isActive=true AND expiresAt > now`).
14. **Real-Postgres tests.** Coverage for: product CRUD with draft/publish flow, image upload + reorder + delete, category cycle prevention, hero "only-one-active" enforcement, slug uniqueness collision, audit log row written for each mutation, MediaStorage round-trip, PromoCode usage limit + expiry validation. Target: +80-100 tests.
15. **Storefront integration.** Storefront product/category queries gain `status: 'PUBLISHED'` filter. Hero query already filters on `isActive`. Lookbook + StaticPage queries unchanged. PromoCode validation at cart already handles `isActive` + `expiresAt`.
16. **Form patterns reuse Phase 4-5 conventions.** Zod schemas in `lib/schemas/admin-*`, server actions / route handlers handle dispatch, client components use `useTransition()` + `router.refresh()`. No new client-state library.

---

## 3. Non-goals

- ❌ **Newsletter UI** (export, Resend Audiences sync). `NewsletterSubscriber` table sits untouched. Phase 7b.
- ❌ **Review moderation queue.** `Review` rows accumulate; `ReviewStatus` enum already exists. Phase 7b.
- ❌ **Audit-log viewer page.** We write rows in 7a; no UI. Phase 7b.
- ❌ **Reports (revenue, returns, top products).** Phase 7b.
- ❌ **Role invites + multi-role UI.** Phase 7a uses single OWNER session; existing `EDITOR` and `ADMIN` roles in the schema remain dormant.
- ❌ **Shipping zone / method editing.** Read-only; seeded via Phase 4 migration. Phase 7b adds admin.
- ❌ **PreorderBatch admin UI.** Phase 5 ships CLI script. Phase 7b adds page.
- ❌ **Bulk operations** (bulk publish, bulk archive, bulk price update). YAGNI for first ~50 products. Phase 7b if needed.
- ❌ **Global admin search** spanning products + orders + customers. Each list page has its own URL-param search; global later.
- ❌ **WYSIWYG editor.** StaticPage is Markdown. WYSIWYG (TipTap/Lexical) deferred to 7b if Жансая requests it.
- ❌ **Image transforms / thumbnails generated server-side.** Originals stored as-is; `next/image` handles resize/webp/avif at render time. No `sharp` post-processing.
- ❌ **Drafts of CMS content** (Hero/Announcement/Lookbook/StaticPage). These are simpler entities — direct edit, `isActive` toggle for Hero/Announcement; revision history is YAGNI.
- ❌ **Scheduled publish** (`Product.publishAt`). Phase 7b — needs a worker cron.
- ❌ **Production deploy.** Phase 8.
- ❌ **CMS hero seed fix** (`pnpm build` currently fails on no active hero). Pre-existing issue from `main`; Phase 7a does not depend on `pnpm build` passing. Phase 8 fixes either by seeding default hero or by guarding the storefront query.

---

## 4. Stack

| Concern | Choice | Rationale |
|---|---|---|
| Image upload UI | Native HTML5 `<input type="file" multiple>` + drag-drop event handlers; thumbnail grid via `framer-motion` (already in storefront) for drag-reorder | Zero new deps; handles luxury-startup volume (5-10 imgs/product). `react-dropzone` would add ~20KB without much benefit at this scale. |
| Image upload pipeline | Single multipart `POST /api/admin/media/upload` action; Node receives `File[]` via `req.formData()`; writes via `MediaStorage`; returns `[{key, url}]` | Same file-upload pattern as Phase 5 manual-label-form. No background job queue (uploads are seconds, not minutes). |
| Markdown rendering | `react-markdown` + `remark-gfm` (~40KB; tested) | Already used by `StaticPage` rendering on the storefront — same lib for editor preview = identical output. |
| Slug generation | Inline `slugify(name).toLowerCase()` helper using a 30-line fn (no `slugify` npm dep) | Trivial; avoids dep weight. |
| Form validation | Zod 4 (existing) | Schemas in `lib/schemas/admin-{product,category,hero,...}.ts`. Same pattern as Phases 3-5. |
| Audit log writes | `withAudit(actor, entity, action, run)` higher-order helper that wraps every server action | One place to capture before/after JSON snapshot + IP + UA. Composable, testable. |
| Storage abstraction | `MediaStorage` interface mirroring Phase 5 `LabelStorage`; `LocalFsStorage` default; `S3Storage` and `R2Storage` adaptors stubbed | Reuses pattern. Switch via `MEDIA_STORAGE` env (default `local`). |
| Public media URL | `GET /api/media/[...key]` Next.js route; streams Buffer with `Content-Type` from extension; aggressive `Cache-Control` | Avoids the storefront talking to MediaStorage directly; URL stays stable across storage backends; `next/image` proxies through it. |
| Form submission | Server actions (`'use server'`) for forms; client components use `useFormState` + `useTransition()` + `router.refresh()` | Matches Phase 5 admin pattern; React 19 server actions handle CSRF transparently. |
| Drag-reorder | `framer-motion`'s `Reorder.Group` (already used on storefront PDP gallery) | Smooth, accessible, no extra dep. |
| Tree rendering for categories | Plain recursive React component (no `react-tree-view` etc.) | Simple ≤2 levels deep typical for fashion taxonomy. |

---

## 5. Architecture

### 5.1 Topology

`ynot-app` continues to own the admin web pages + API routes. **No new container.** The `ynot-worker` from Phase 5 is unchanged. Adds one Docker volume:

```yaml
volumes:
  ynot-labels:
    # existing — Phase 5 label PDFs
  ynot-media:
    # NEW — Phase 7a product/CMS images
```

Mount: `/var/lib/ynot/media:/data/media` for `ynot-app` only (worker doesn't need media).

### 5.2 Code layout

```
src/
├── lib/
│   ├── schemas/
│   │   ├── admin-product.ts          ← Zod for product create/update/status-change
│   │   ├── admin-category.ts         ← Zod for category create/update + parent move
│   │   ├── admin-hero.ts             ← Zod for HeroBlock + activate
│   │   ├── admin-announcement.ts     ← Zod for AnnouncementMessage
│   │   ├── admin-lookbook.ts         ← Zod for LookbookImage + reorder
│   │   ├── admin-staticpage.ts       ← Zod for StaticPage
│   │   ├── admin-sitepolicy.ts       ← Zod for SitePolicy update
│   │   └── admin-promo.ts            ← Zod for PromoCode create/update/deactivate
│   ├── slug.ts                       ← NEW: slugify helper + uniqueness-suffix logic
│   └── markdown.ts                   ← (probably already exists for storefront StaticPage; reuse)
└── server/
    ├── media/                        ← NEW SUBSYSTEM
    │   ├── storage.ts                ← MediaStorage interface
    │   ├── local-fs-storage.ts       ← LocalFsStorage impl
    │   ├── s3-storage.ts             ← stubbed for future
    │   ├── factory.ts                ← createMediaStorage(env) + getMediaStorage()
    │   ├── content-type.ts           ← extension → MIME map (jpg/png/webp/avif)
    │   └── __tests__/
    │       ├── local-fs-storage.test.ts
    │       ├── factory.test.ts
    │       └── content-type.test.ts
    ├── admin/                        ← NEW SUBSYSTEM (operations live here)
    │   ├── audit.ts                  ← withAudit() higher-order wrapper
    │   ├── catalog/
    │   │   ├── product-service.ts    ← create / update / publish / archive / setSizes / setColours / setImages / setStock
    │   │   ├── category-service.ts   ← create / update / archive / move / cycleCheck
    │   │   ├── slug-service.ts       ← ensureUniqueSlug for Product + Category
    │   │   └── __tests__/
    │   │       ├── product-service.test.ts
    │   │       ├── category-service.test.ts
    │   │       ├── slug-service.test.ts
    │   │       └── audit.test.ts
    │   ├── cms/
    │   │   ├── hero-service.ts       ← create / update / activate (handles only-one-active invariant)
    │   │   ├── announcement-service.ts
    │   │   ├── lookbook-service.ts   ← create / update / reorder / delete
    │   │   ├── staticpage-service.ts ← create / update / delete
    │   │   ├── sitepolicy-service.ts ← update (singleton)
    │   │   └── __tests__/
    │   │       ├── hero-service.test.ts
    │   │       ├── lookbook-service.test.ts
    │   │       └── ...
    │   └── promo/
    │       ├── service.ts            ← create / update / deactivate
    │       └── __tests__/
    │           └── service.test.ts
└── app/
    ├── admin/                        ← extends Phase 5 mini admin
    │   ├── layout.tsx                ← UPDATED: sidebar nav adds Catalog / CMS / Marketing sections
    │   ├── page.tsx                  ← UPDATED: dashboard adds Drafts / Low-stock / Active-promos cards
    │   ├── catalog/
    │   │   ├── products/
    │   │   │   ├── page.tsx          ← list with status filter + search
    │   │   │   ├── new/page.tsx      ← create form
    │   │   │   └── [id]/
    │   │   │       ├── page.tsx      ← edit form (sections: details, images, sizes, colours, categories)
    │   │   │       └── _components/
    │   │   │           ├── product-form.tsx
    │   │   │           ├── image-uploader.tsx        ← drag-drop multi-file
    │   │   │           ├── image-grid-reorder.tsx    ← drag-handle thumbnails
    │   │   │           ├── stock-editor.tsx
    │   │   │           ├── colour-editor.tsx
    │   │   │           └── status-actions.tsx        ← Publish / Unpublish / Archive buttons
    │   │   └── categories/
    │   │       ├── page.tsx          ← tree view
    │   │       ├── new/page.tsx
    │   │       └── [id]/page.tsx     ← edit + parent select
    │   ├── content/
    │   │   ├── hero/
    │   │   │   ├── page.tsx          ← list with active badge
    │   │   │   ├── new/page.tsx
    │   │   │   └── [id]/page.tsx
    │   │   ├── announcements/
    │   │   │   ├── page.tsx
    │   │   │   ├── new/page.tsx
    │   │   │   └── [id]/page.tsx
    │   │   ├── lookbook/
    │   │   │   ├── page.tsx
    │   │   │   ├── new/page.tsx
    │   │   │   └── [id]/page.tsx
    │   │   ├── pages/                ← StaticPage
    │   │   │   ├── page.tsx
    │   │   │   ├── new/page.tsx
    │   │   │   └── [id]/page.tsx     ← Markdown editor + live preview
    │   │   └── settings/
    │   │       └── page.tsx          ← SitePolicy single-form edit
    │   └── marketing/
    │       └── promos/
    │           ├── page.tsx          ← list with active filter
    │           ├── new/page.tsx
    │           └── [id]/page.tsx
    └── api/
        ├── admin/
        │   ├── products/
        │   │   ├── route.ts          ← POST create / GET list (server-rendered pages also call service directly)
        │   │   └── [id]/
        │   │       ├── route.ts      ← PATCH update / DELETE archive
        │   │       ├── status/route.ts        ← POST publish/unpublish
        │   │       ├── images/route.ts        ← POST add / DELETE delete / PATCH reorder
        │   │       ├── sizes/route.ts         ← PATCH set stock per size
        │   │       └── colours/route.ts       ← PATCH set colour list
        │   ├── categories/
        │   │   ├── route.ts
        │   │   └── [id]/route.ts
        │   ├── content/
        │   │   ├── hero/[id]/route.ts
        │   │   ├── hero/[id]/activate/route.ts
        │   │   ├── announcements/[id]/route.ts
        │   │   ├── lookbook/route.ts          ← POST create / PATCH reorder
        │   │   ├── lookbook/[id]/route.ts
        │   │   ├── pages/[id]/route.ts
        │   │   └── settings/route.ts          ← PATCH SitePolicy
        │   ├── promos/
        │   │   ├── route.ts
        │   │   └── [id]/route.ts
        │   └── media/
        │       └── upload/route.ts            ← POST multipart, returns [{key,url}]
        └── media/
            └── [...key]/route.ts              ← public-facing GET, streams from MediaStorage
```

### 5.3 Subsystem responsibilities

**`media/`** — owns everything about where binary files physically live and how their URLs are served. The storefront depends only on `/api/media/...` URLs; it never imports from `media/` directly. Switching backend (Local FS → R2) is a one-env-var change with a one-time copy script.

**`admin/audit.ts`** — `withAudit({actor, entityType, entityId, action}, run)` is the only place that talks to `AuditLog`. Captures before/after JSON snapshots, the actor's `User.id`, `req.headers['x-forwarded-for']` for IP, `req.headers['user-agent']` for UA. Every catalog / CMS / promo service wraps its mutation calls in it. Read-only operations don't touch audit.

**`admin/catalog/`** — services own validation that doesn't fit Zod (slug uniqueness against existing rows, category cycle detection, draft-to-publish state guards). Routes / pages call these services; they handle audit wrapping.

**`admin/cms/`** — same shape. Hero service enforces "only one active row" by deactivating the previous active inside a transaction.

**`admin/promo/`** — straightforward CRUD; deactivate (not delete) preserves `PromoRedemption` referential integrity.

---

## 6. Domain models

### 6.1 New enum

```prisma
enum ProductStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}
```

### 6.2 New field on existing model

```prisma
model Product {
  // ...existing fields...
  status      ProductStatus  @default(DRAFT)
  publishedAt DateTime?      // set on first DRAFT → PUBLISHED transition; null otherwise

  @@index([status, deletedAt])
}
```

`deletedAt` (already in schema) keeps its current meaning (hard archive). `status = ARCHIVED` is a **softer** signal — the product is hidden from storefront but still editable + appears in admin lists; `deletedAt != null` is permanent removal (admin no longer surfaces it).

Storefront query filter changes:

```ts
// Before:
where: { deletedAt: null }
// After:
where: { status: 'PUBLISHED', deletedAt: null }
```

### 6.3 Schema migration

One migration: `20260504_phase7a_product_status` — adds the enum, adds the column with default `'DRAFT'`, **backfills existing products to `'PUBLISHED'`** so storefront doesn't suddenly empty after deploy.

```sql
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
ALTER TABLE "Product" ADD COLUMN "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "Product" ADD COLUMN "publishedAt" TIMESTAMP(3);
UPDATE "Product" SET "status" = 'PUBLISHED', "publishedAt" = "createdAt" WHERE "deletedAt" IS NULL;
CREATE INDEX "Product_status_deletedAt_idx" ON "Product"("status", "deletedAt");
```

No other schema changes. Image / Hero / Lookbook / etc. tables already have everything we need.

---

## 7. Auth + RBAC

Middleware from Phase 5 already gates `/admin/*` and `/api/admin/*` on `UserRole IN [ADMIN, OWNER]`. Phase 7a tightens to `OWNER` for catalog / CMS / promo writes (Phase 5 allowed both; Phase 5 read-pages stay on `ADMIN | OWNER`):

- **List + read pages** (`GET /admin/...`): `ADMIN | OWNER`
- **Mutation routes** (`POST/PATCH/DELETE /api/admin/...`): `OWNER` only — for now, only Жансая

Implementation: `requireOwner(session)` helper in `src/server/auth/guards.ts`; called at the top of every mutation route. Phase 7b widens this with role-grain permissions.

CSRF: server actions / Next.js POST routes are CSRF-safe by default with Auth.js v5; we don't hand-roll tokens.

---

## 8. Media subsystem

### 8.1 Interface

```ts
// src/server/media/storage.ts
export interface MediaStorage {
  put(key: string, content: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<{ buffer: Buffer; contentType: string }>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}
```

### 8.2 LocalFsStorage

Writes to `${env.MEDIA_STORAGE_PATH}/${key}` (default `/var/lib/ynot/media/`). Stores the content type as `${key}.meta` next to the file (single-line file containing the MIME type). On `get`, reads both. Subdirectories created automatically per-prefix.

Key format generated by upload action: `products/${productId}/${nanoid(12)}.${ext}` (e.g., `products/abc123/r4Tw9XzL2_qP.jpg`). Hero / Lookbook / etc. use prefixes `hero/`, `lookbook/`, `pages/` similarly.

### 8.3 Public route

```
GET /api/media/[...key]
```

Streams from `getMediaStorage().get(key.join('/'))` with response headers:

- `Content-Type: <stored type>`
- `Cache-Control: public, max-age=31536000, immutable` (1 year — keys are content-hashed via `nanoid`, so they're safe to cache forever; deletion in admin doesn't invalidate cached clients but new uploads get new keys)
- `Content-Disposition: inline`

Returns 404 if the file doesn't exist; 400 if the key contains `..` or absolute paths (defence in depth).

### 8.4 Upload route

```
POST /api/admin/media/upload
Content-Type: multipart/form-data
Body: files[] (one or more)
```

For each file:
1. Validate MIME (`image/jpeg | image/png | image/webp`); reject otherwise.
2. Validate size (≤5MB); reject otherwise.
3. Generate key with prefix from query param (`?prefix=products/abc123` etc.).
4. Write via `MediaStorage.put(key, buffer, contentType)`.
5. Return `{ key, url: `/api/media/${key}` }`.

Returns `{ uploaded: [{key, url, originalFilename}], rejected: [{filename, reason}] }`. Caller (admin client component) updates UI accordingly.

### 8.5 Storage abstraction tests

- LocalFsStorage round-trip (put → get → matches).
- LocalFsStorage 404 on missing.
- Factory returns LocalFsStorage on `local`; throws on `s3`/`r2` ("not yet implemented in Phase 7a").
- Public route streams with correct Content-Type.
- Public route 400 on traversal attempt (`..`).
- Public route 404 on missing key.
- Upload route accepts JPEG/PNG/WebP, rejects PDF, rejects oversize.

---

## 9. Catalog management

### 9.1 Product detail editor

A single page with sections (in order, scrollable):

1. **Header** — name, slug (auto-generated, editable), status pill, action buttons (Save Draft, Publish, Archive)
2. **Details** — `description`, `priceCents`, `materials`, `care`, `sizing`, `weightGrams`, `hsCode`, `countryOfOriginCode`. All single text inputs except `description` (Markdown textarea + preview), `priceCents` (number with £ prefix display).
3. **Images** — drop zone + thumbnail grid with drag-handles; click-x to delete; `<Image>` preview using `next/image`.
4. **Sizes & stock** — table with rows for `XS, S, M, L, XL`; each row has a stock number-input. Save in batch.
5. **Colours** — list of `{name, hex}` pairs; add/remove inline; hex input shows colour preview.
6. **Categories** — multi-select tree showing all PUBLISHED categories.
7. **Pre-order toggle** — `preOrder Boolean` flag; if on, shows a select for which `PreorderBatch` to default to (read-only — Phase 7b adds batch admin).

### 9.2 Status workflow

- `DRAFT → PUBLISHED`: validates all required-for-publish fields are non-empty (name, slug, description, priceCents > 0, ≥1 image, ≥1 active size with stock > 0 OR `preOrder = true`, ≥1 category). Sets `publishedAt = now()` if first time.
- `PUBLISHED → DRAFT` (Unpublish): allowed. Doesn't reset `publishedAt`.
- Any → `ARCHIVED`: allowed; sets nothing else; product stays in admin lists but is filtered from default storefront queries.
- `ARCHIVED → DRAFT`: allowed (rehydrate to edit before re-publish).

State machine helper in `src/server/admin/catalog/product-status.ts`:

```ts
export const ALLOWED_TRANSITIONS: Record<ProductStatus, ProductStatus[]> = {
  DRAFT: ['PUBLISHED', 'ARCHIVED'],
  PUBLISHED: ['DRAFT', 'ARCHIVED'],
  ARCHIVED: ['DRAFT'],
};
```

### 9.3 Category tree

- Categories rendered as a recursive list.
- Reordering is **not** in 7a (`sortOrder` editable as a number input only, no drag-reorder); 7b adds drag.
- Cycle prevention: when changing `parentId`, server walks up the proposed parent chain; if encounters the moving category's id → reject with `Cannot move into own descendant`.

### 9.4 Slug uniqueness

`ensureUniqueSlug(model, baseSlug, excludeId?)`:

1. `slug = slugify(name)` (lowercase, replace whitespace with `-`, strip non-alphanumeric).
2. Query `prisma[model].findFirst({ where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) } })`.
3. If exists, append `-2`, `-3`, ... until unique.
4. Return final.

Manually edited slugs go through the same check; if collision and user typed it explicitly, return error to UI ("slug already used"). Auto-generated slugs silently increment.

---

## 10. CMS management

### 10.1 HeroBlock

Schema already enforces `isActive = true` on **at most one row** via partial unique index (`hero_one_active_partial_index` migration). Admin enforces the single-active rule by **transactionally setting all other rows' `isActive` to `false`** when activating a new one:

```ts
async function activateHero(id: string): Promise<void> {
  await prisma.$transaction([
    prisma.heroBlock.updateMany({ where: { isActive: true, id: { not: id } }, data: { isActive: false } }),
    prisma.heroBlock.update({ where: { id }, data: { isActive: true } }),
  ]);
}
```

Phase 8 should also seed a default hero on a fresh DB to fix the existing `pnpm build` error.

### 10.2 LookbookImage

List page renders ordered grid (by `sortOrder`). Drag-reorder via `Reorder.Group` posts to `PATCH /api/admin/content/lookbook` with new id-order array; server updates `sortOrder` in batch transaction.

Image upload reuses the same `/api/admin/media/upload?prefix=lookbook` flow; `LookbookImage.src` stores the `/api/media/...` URL.

### 10.3 StaticPage

List page shows existing pages + Create button. Editor is a 50/50 split:

- Left: textarea (`bodyMarkdown`)
- Right: `react-markdown` live preview (re-renders on each keystroke; cheap given typical page is <2000 chars)

Slug auto-generated and editable (same `ensureUniqueSlug` flow as Product).

### 10.4 SitePolicy

Single-row settings (`id = 'singleton'` already in seed). Editor is one form posting to `PATCH /api/admin/content/settings`. Fields: `defaultCurrency`, `defaultCarrier`, `freeShipThresholdCents`, `contactEmail`, `whatsappNumber`. Returns updated row.

---

## 11. PromoCode management

### 11.1 Form

Fields:
- `code` (uppercase auto, unique)
- `discountType: 'FIXED' | 'PERCENT'`
- `discountValue` (number — pence for FIXED; 1-100 for PERCENT)
- `minOrderCents` (optional)
- `usageLimit` (optional)
- `expiresAt` (date picker, optional)
- `isActive` (boolean)

### 11.2 List page

Filter: All / Active / Expired / Deactivated. Each row shows usage count (`usageCount` already tracked) + redemption progress (`usageCount / usageLimit`).

### 11.3 Deactivation, not deletion

`PromoCode.deletedAt` field exists. We **don't** use it — deactivate via `isActive = false` to preserve `PromoRedemption` foreign keys cleanly. Hard delete only via raw SQL if absolutely needed (out of admin UI).

---

## 12. Audit log writes

### 12.1 Helper

```ts
// src/server/admin/audit.ts
export async function withAudit<T>(
  ctx: { actorId: string; entityType: string; entityId: string; action: string; ip?: string; ua?: string; before?: unknown },
  run: () => Promise<T>,
): Promise<T> {
  const result = await run();
  await prisma.auditLog.create({
    data: {
      actorId: ctx.actorId,
      entityType: ctx.entityType,
      entityId: ctx.entityId,
      action: ctx.action,
      before: ctx.before as Prisma.InputJsonValue ?? null,
      after: result as Prisma.InputJsonValue,
      ipAddress: ctx.ip ?? null,
      userAgent: ctx.ua ?? null,
    },
  });
  return result;
}
```

### 12.2 Audit failure handling

If the `auditLog.create` fails (DB issue), the mutation is **already committed** — auditing wraps the result, not the operation. We log the audit failure to stderr and don't roll back. Compliance-strict environments should wrap mutation + audit in a transaction (Phase 7b can revisit if compliance becomes a strict requirement).

### 12.3 Coverage

Every service method in `src/server/admin/{catalog,cms,promo}/` calls `withAudit(...)`. Action strings:

- Catalog: `product.create`, `product.update`, `product.publish`, `product.archive`, `product.images.add`, `product.images.delete`, `product.images.reorder`, `product.stock.update`, `product.colours.update`, `category.create`, `category.update`, `category.move`, `category.archive`
- CMS: `hero.create`, `hero.update`, `hero.activate`, `announcement.create`, `announcement.update`, `lookbook.create`, `lookbook.update`, `lookbook.reorder`, `lookbook.delete`, `staticpage.create`, `staticpage.update`, `staticpage.delete`, `sitepolicy.update`
- Promo: `promo.create`, `promo.update`, `promo.deactivate`

All entries go to the `AuditLog` table with the actor's User.id.

---

## 13. UI patterns

### 13.1 Layout extension

Phase 5 sidebar nav is extended with section headers:

```
DASHBOARD
  Overview
ORDERS                           ← Phase 5
  All orders
  Returns
CATALOG                          ← NEW Phase 7a
  Products
  Categories
CONTENT                          ← NEW
  Hero
  Announcements
  Lookbook
  Pages
  Settings
MARKETING                        ← NEW
  Promo codes
```

### 13.2 List page pattern

Shared helper component `<AdminTable>` for consistent style: pagination cursor, search input, status filter, "New" button on the right, table with hover rows + click → detail.

### 13.3 Form page pattern

- Server component fetches the entity (or null for new) → renders client form
- Client form uses `useFormState` for server action result; `useTransition` for pending state
- On success: toast (Phase 4 toast already exists) + `router.refresh()`
- On error: inline field-level errors from Zod parse OR top-of-form banner

### 13.4 Image uploader

- `<input type="file" multiple>` hidden behind drop zone
- `onDrop` / `onChange` triggers `POST /api/admin/media/upload?prefix=...`
- Each file uploads sequentially (not parallel — keeps UX progress simple); progress bar per file
- On success: thumbnail appended to grid below, drag-reorder enabled
- Server-side validation rejects oversize / wrong MIME with friendly per-file error

---

## 14. API surface

### 14.1 Admin mutation routes (new)

| Method | Path | Body | Purpose |
|---|---|---|---|
| `POST` | `/api/admin/products` | `{...productCreate}` | Create draft |
| `PATCH` | `/api/admin/products/[id]` | `{...productUpdate}` | Update fields |
| `POST` | `/api/admin/products/[id]/status` | `{ to: 'PUBLISHED' | 'DRAFT' | 'ARCHIVED' }` | Status transition |
| `POST` | `/api/admin/products/[id]/images` | `multipart files[]` | Add images |
| `DELETE` | `/api/admin/products/[id]/images/[imgId]` | — | Remove image |
| `PATCH` | `/api/admin/products/[id]/images` | `{ order: imgId[] }` | Reorder |
| `PATCH` | `/api/admin/products/[id]/sizes` | `{ sizes: [{size, stock}] }` | Set per-size stock |
| `PATCH` | `/api/admin/products/[id]/colours` | `{ colours: [{name, hex}] }` | Set colours |
| `POST` | `/api/admin/categories` | `{...catCreate}` | Create |
| `PATCH` | `/api/admin/categories/[id]` | `{...catUpdate}` | Update incl. parentId |
| `DELETE` | `/api/admin/categories/[id]` | — | Soft archive |
| `PATCH` | `/api/admin/content/hero/[id]` | — | Update fields |
| `POST` | `/api/admin/content/hero/[id]/activate` | — | Activate (deactivates others) |
| `POST` | `/api/admin/content/announcements` | `{...}` | Create |
| `PATCH` | `/api/admin/content/announcements/[id]` | `{...}` | Update |
| `POST` | `/api/admin/content/lookbook` | `{...}` | Create |
| `PATCH` | `/api/admin/content/lookbook` | `{ order: id[] }` | Reorder |
| `PATCH` | `/api/admin/content/lookbook/[id]` | `{...}` | Update |
| `DELETE` | `/api/admin/content/lookbook/[id]` | — | Delete |
| `POST` | `/api/admin/content/pages` | `{...}` | Create StaticPage |
| `PATCH` | `/api/admin/content/pages/[id]` | `{...}` | Update |
| `DELETE` | `/api/admin/content/pages/[id]` | — | Delete |
| `PATCH` | `/api/admin/content/settings` | `{...sitepolicyUpdate}` | Update SitePolicy |
| `POST` | `/api/admin/promos` | `{...}` | Create |
| `PATCH` | `/api/admin/promos/[id]` | `{...}` | Update |
| `POST` | `/api/admin/promos/[id]/deactivate` | — | Set isActive=false |
| `POST` | `/api/admin/media/upload` | `multipart files[]` | Upload images, return URLs |
| `GET` | `/api/media/[...key]` | — | **Public** — stream media file |

### 14.2 Storefront integration changes

- `getProducts({...})` repository fn extends filter to `{ status: 'PUBLISHED', deletedAt: null }`. (Currently filters only on `deletedAt: null`.)
- `getProductBySlug(slug)` similarly.
- All other queries unchanged.

---

## 15. Validation

Per-form Zod schemas; consistent error shape `{ field: string; message: string }[]` returned to client. Critical schemas:

- `AdminProductCreate`: `name (1-200)`, `slug (auto)`, `priceCents (positive)`, `description (1-5000)`, `materials/care/sizing (each 1-2000)`, `weightGrams (>0)`, `hsCode (regex /^\d{4,10}$/)`, `countryOfOriginCode (2-letter ISO)`, `preOrder boolean`
- `AdminCategoryCreate`: `name (1-100)`, `slug (auto)`, `parentId (cuid? — must not equal own id, must not be descendant)`
- `AdminHeroCreate`: `kind ('IMAGE' | 'VIDEO')`, `imageUrl (string)`, `videoUrl (optional)`, `eyebrow (1-100)`, `ctaLabel (1-50)`, `ctaHref (1-500)`
- `AdminLookbookReorder`: `order: cuid[]`
- `AdminPromoCreate`: `code (uppercase 3-30, unique)`, `discountType enum`, `discountValue (positive int)`, `minOrderCents (>=0)`, `usageLimit (positive int?)`, `expiresAt (future Date?)`, `isActive (boolean)`

---

## 16. Testing strategy

Same Phase 5 patterns:

- **Real Postgres** via existing Vitest harness
- **Service tests** for every catalog/cms/promo service method (happy + error paths)
- **Route tests** for auth (non-OWNER → 403) + happy path + Zod validation
- **Page tests** for server-rendered admin pages — assert correct row counts, draft/published filter, search query
- **MediaStorage round-trip** + factory tests
- **Audit tests** asserting that each mutation writes one AuditLog row with correct `before` / `after`
- **Image upload integration test** — multipart POST → file in storage → URL works in `/api/media/...`
- **Slug uniqueness** + cycle prevention service tests
- **Hero "only one active"** transactional test (concurrent activate)
- **Storefront filter regression** — existing tests must continue to pass after `status: 'PUBLISHED'` filter is added; if they seed Products without status, they'll need updating

Target: **+80-100 tests over Phase 5** baseline (669 → ~770).

---

## 17. Migrations checklist

In order:

1. `20260504_phase7a_product_status` — adds `ProductStatus` enum, `Product.status` column with default DRAFT + backfill PUBLISHED for existing non-deleted products, `Product.publishedAt`, `(status, deletedAt)` index.

That's it — every other model already has the fields we need.

---

## 18. Configuration / environment

Additions to `src/server/env.ts`:

```ts
MEDIA_STORAGE: z.enum(['local', 's3', 'r2']).default('local'),
MEDIA_STORAGE_PATH: z.string().default('/var/lib/ynot/media'),
MEDIA_PUBLIC_BASE_URL: z.string().optional(), // optional override; defaults to NEXT_PUBLIC_SITE_URL + '/api/media'
```

`docker-compose.yml`:

```yaml
services:
  ynot-app:
    volumes:
      - ynot-media:/var/lib/ynot/media   # NEW
      # existing ynot-labels mount stays

volumes:
  ynot-media:                            # NEW
  ynot-labels:                           # existing
```

`.env.example` documents the new vars.

---

## 19. Rollout plan

Same shape as Phase 5:

1. **PR open** — branch `feature/backend-phase-7a-launch-admin`, ~80-100 commits, all tests green.
2. **Manual QA pass** in local dev:
   - Create draft product → upload images → set sizes/colours → publish → appears on storefront
   - Edit category tree (parent move) → no cycles
   - Activate Hero #2 → Hero #1 deactivates automatically
   - Create lookbook image, reorder → storefront reflects new order
   - Edit StaticPage Markdown → live preview matches storefront render
   - Create promo code → use at checkout → `usageCount` increments
   - All admin actions write `AuditLog` rows (verify via `psql`)
   - Image upload rejects oversize / wrong MIME with friendly error
   - Image stream `/api/media/<key>` works in browser; honours cache headers
3. **Code review** — focus on auth, slug uniqueness race, hero invariant, audit coverage.
4. **Merge** — squash to `main`.
5. **`docs/manual-qa.md`** Phase 7a section appended.

---

## 20. Risks & open questions

### 20.1 Risks

- **Image upload concurrency.** Two simultaneous uploads to the same product may race on `ProductImage.sortOrder` allocation. Mitigation: sortOrder is `MAX(sortOrder) + 1` computed inside a Prisma transaction.
- **Slug collision under load.** Auto-generation queries-then-inserts has a TOCTOU window. For luxury startup volume (manual product creation by Жансая, never concurrent), acceptable. Mitigation if it surfaces: catch unique-constraint error, append random suffix, retry once.
- **Local FS fills up.** 8 images × 5MB × 100 products = 4GB. VPS disk monitoring required (Phase 8). When usage > 70%, migrate to R2.
- **Backfill of existing products.** Migration sets all non-deleted products to `'PUBLISHED'`. If Жансая seeded test products in dev that should stay hidden, she'll need to manually archive. Acceptable for our state (only `seed.ts`-generated products exist).
- **No bulk operations.** First 50 products, OK. By 200+, Жансая will want bulk publish / bulk price update. 7b.
- **WYSIWYG vs Markdown.** If Жансая is unfamiliar with Markdown, the static-page editor experience will be friction. Mitigation: provide a help link in the textarea ("Markdown formatting guide"). 7b can add WYSIWYG.
- **Audit log retention.** No TTL — table grows by ~10-20 rows/day. After 1 year ~5000 rows; trivial. 7b adds archival policy.

### 20.2 Open questions

- **Maximum product image dimensions** — should we reject images that are e.g. <800px wide (too small for hero on PDP)? Phase 7a accepts whatever Жансая uploads. 7b can enforce min-dimensions client-side via `<canvas>` measurement.
- **Image format conversion** — should we auto-convert WebP for uploaded JPEGs? Phase 7a stores originals; `next/image` does WebP at render. If storage costs explode, 7b adds `sharp`-based ingestion pipeline.
- **Hero image vs video** — `HeroBlock.kind` enum supports both. Phase 7a admin accepts both via the same upload action (server validates `image/*` OR `video/mp4`). Same `MediaStorage`.

---

## 21. Definition of done

Phase 7a PR merges when:

1. ✅ All migrations apply cleanly on a fresh DB.
2. ✅ `pnpm typecheck` + `pnpm lint` + `pnpm test` all green; `pnpm build` defers to Phase 8 (CMS hero seed issue separate).
3. ✅ Test count grows by 80+ over Phase 5 baseline (669 → 750+).
4. ✅ Manual QA checklist (section 19 step 2) passes in local dev.
5. ✅ `docker-compose.yml` includes `ynot-media` volume; mount works on local container start.
6. ✅ `web/.env.example` documents new vars.
7. ✅ Storefront product/category queries emit `status: 'PUBLISHED'` filter.
8. ✅ Schema Prisma docs + comments updated for new Product fields.
9. ✅ `web/docs/manual-qa.md` Phase 7a section added.

Production rollout is **not** part of Phase 7a — that's Phase 8.
