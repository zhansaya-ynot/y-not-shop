-- AlterTable
ALTER TABLE "StaticPage" ADD COLUMN     "heroImage" TEXT;

-- Backfill the Our Story page with the bundled hero asset so the admin
-- form opens with a 'currently uploaded' preview instead of an empty
-- dropzone. The storefront page used to hardcode the same path; with
-- this row populated, both surfaces resolve through the CMS.
UPDATE "StaticPage" SET "heroImage" = '/cms/our-story/hero.jpg'
  WHERE slug = 'our-story' AND "heroImage" IS NULL;
