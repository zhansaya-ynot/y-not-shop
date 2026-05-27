-- Promote Product.homeCollection (nullable scalar) to
-- Product.homeCollections (HomeCollection[]) so a single product can
-- live in multiple homepage collection landing pages at once. Existing
-- tagged products keep their tag — the scalar value migrates into the
-- new array.

ALTER TABLE "Product" ADD COLUMN "homeCollections" "HomeCollection"[] NOT NULL DEFAULT '{}';

UPDATE "Product"
SET "homeCollections" = ARRAY["homeCollection"]::"HomeCollection"[]
WHERE "homeCollection" IS NOT NULL;

ALTER TABLE "Product" DROP COLUMN "homeCollection";
