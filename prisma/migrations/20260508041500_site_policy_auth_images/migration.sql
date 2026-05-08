-- AlterTable
ALTER TABLE "SitePolicy" ADD COLUMN "authSignInImage" TEXT;
ALTER TABLE "SitePolicy" ADD COLUMN "authRegisterImage" TEXT;

-- Backfill the singleton row with the bundled stub paths so the admin
-- Settings form opens with 'currently uploaded' previews instead of empty
-- dropzones. Storefront pages used to hardcode these same URLs.
UPDATE "SitePolicy"
   SET "authSignInImage"   = '/cms/auth/sign-in.jpg',
       "authRegisterImage" = '/cms/auth/register.jpg'
 WHERE id = 'singleton';
