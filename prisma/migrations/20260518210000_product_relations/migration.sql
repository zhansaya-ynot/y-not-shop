-- Operator-curated related products ("Complete the look"). Self-join on
-- Product with explicit ordering; both FKs cascade so deleting a product
-- removes it from every other product's suggestion list.

CREATE TABLE "ProductRelation" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "relatedId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ProductRelation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductRelation_productId_relatedId_key" ON "ProductRelation"("productId", "relatedId");
CREATE INDEX "ProductRelation_productId_idx" ON "ProductRelation"("productId");

ALTER TABLE "ProductRelation" ADD CONSTRAINT "ProductRelation_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductRelation" ADD CONSTRAINT "ProductRelation_relatedId_fkey"
    FOREIGN KEY ("relatedId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
