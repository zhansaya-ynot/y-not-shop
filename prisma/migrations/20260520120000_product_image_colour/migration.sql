-- Per-colour product images: tag each image with an optional colour
-- (matching ColourOption.name). Null keeps the image visible for all
-- colours, so existing untagged galleries are unaffected.

ALTER TABLE "ProductImage" ADD COLUMN "colour" TEXT;
