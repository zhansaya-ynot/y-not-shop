-- Homepage collection grouping: a per-product enum that powers the three
-- collection landing pages, plus a SitePolicy JSON column holding the
-- editable title/intro copy for those pages.

CREATE TYPE "HomeCollection" AS ENUM ('NEW_COLLECTION', 'TIMELESS', 'NEW_ARRIVALS');

ALTER TABLE "Product" ADD COLUMN "homeCollection" "HomeCollection";

ALTER TABLE "SitePolicy" ADD COLUMN "collectionPagesJson" JSONB;
