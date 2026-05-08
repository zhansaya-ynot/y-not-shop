-- AlterTable
ALTER TABLE "SitePolicy"
  ADD COLUMN "brandStatementPrimary"   TEXT NOT NULL DEFAULT '',
  ADD COLUMN "brandStatementSecondary" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "brandStatementTertiary"  TEXT NOT NULL DEFAULT '';

-- Backfill the singleton row with the current hardcoded copy so the admin
-- form opens with the real text already populated, not blank fields.
UPDATE "SitePolicy"
   SET "brandStatementPrimary"   = 'Urban outerwear designed to move with you, for any occasion — from street to statement.',
       "brandStatementSecondary" = 'Why not.',
       "brandStatementTertiary"  = 'A way of living.'
 WHERE id = 'singleton';
