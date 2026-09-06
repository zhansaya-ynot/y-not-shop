-- Portrait (9:16) hero assets for phones. Nullable: existing rows keep
-- serving their landscape asset on every breakpoint until an operator
-- uploads a mobile variant.
ALTER TABLE "HeroBlock" ADD COLUMN "mobileImageUrl" TEXT;
ALTER TABLE "HeroBlock" ADD COLUMN "mobileVideoUrl" TEXT;
