-- Drop XS and XL from the Size enum. YNOT only stocks S/M/L.
--
-- Postgres has no `ALTER TYPE ... DROP VALUE`, so the enum is rebuilt:
-- rename the old type, create the new 3-value type, retype every column
-- that uses it, then drop the old type. Any rows still carrying XS/XL
-- are deleted first so the `USING` cast can't fail — on the production
-- DB all test orders/carts were already cleared manually, so this only
-- has ProductSize rows to prune; the DELETEs stay for dev/test/CI DBs
-- seeded with the old five sizes.

DELETE FROM "ProductSize" WHERE "size" IN ('XS', 'XL');
DELETE FROM "CartItem" WHERE "size" IN ('XS', 'XL');
DELETE FROM "OrderItem" WHERE "size" IN ('XS', 'XL');

ALTER TYPE "Size" RENAME TO "Size_old";
CREATE TYPE "Size" AS ENUM ('S', 'M', 'L');

ALTER TABLE "ProductSize" ALTER COLUMN "size" TYPE "Size" USING ("size"::text::"Size");
ALTER TABLE "CartItem" ALTER COLUMN "size" TYPE "Size" USING ("size"::text::"Size");
ALTER TABLE "OrderItem" ALTER COLUMN "size" TYPE "Size" USING ("size"::text::"Size");

DROP TYPE "Size_old";
