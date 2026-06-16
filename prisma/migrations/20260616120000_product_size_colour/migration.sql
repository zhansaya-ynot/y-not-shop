-- Per-(size, colour) stock. Existing rows default to colour '' (the no-colour
-- variant); products with colours get their matrix re-entered via the admin
-- stock editor.
ALTER TABLE "ProductSize" ADD COLUMN "colour" TEXT NOT NULL DEFAULT '';

ALTER TABLE "ProductSize" DROP CONSTRAINT "ProductSize_pkey";
ALTER TABLE "ProductSize" ADD CONSTRAINT "ProductSize_pkey" PRIMARY KEY ("productId", "size", "colour");
