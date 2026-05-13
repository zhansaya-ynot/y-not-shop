-- Add homeEditorialJson column for the 'Timeless Collection' editorial
-- block on the homepage. Pre-seeds the singleton row with the values that
-- were previously hardcoded in src/app/page.tsx so the storefront keeps
-- rendering the same copy/image after migration, while letting the
-- operator override them via /admin/content/editorial.
--
-- COALESCE preserves any value the operator has already set: if the
-- migration runs more than once (e.g. fresh-install + later edit), the
-- second pass won't clobber the operator's edits.

ALTER TABLE "SitePolicy" ADD COLUMN IF NOT EXISTS "homeEditorialJson" JSONB;

INSERT INTO "SitePolicy" ("id", "updatedAt", "homeEditorialJson")
VALUES (
  'singleton',
  NOW(),
  jsonb_build_object(
    'title', 'Timeless Collection',
    'body', 'Signature silhouettes that anchor the collection, crafted with ease and refinement for continual wear.',
    'imageUrl', '/cms/timeless.jpg',
    'ctaHref', '/collection/jackets',
    'ctaLabel', 'Explore'
  )
)
ON CONFLICT ("id") DO UPDATE
SET "homeEditorialJson" = COALESCE("SitePolicy"."homeEditorialJson", EXCLUDED."homeEditorialJson");
