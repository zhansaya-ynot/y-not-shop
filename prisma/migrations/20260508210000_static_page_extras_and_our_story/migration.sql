-- Add page-specific structured content column. Json so each page can
-- carry its own shape (Our Story has value callouts + pull quote;
-- Contact has info-grid; Shipping has table rows; etc.).
ALTER TABLE "StaticPage" ADD COLUMN "extras" JSONB;

-- Seed the our-story row so the storefront route reads from DB on the
-- next deploy. Body and extras mirror what was previously hardcoded in
-- src/app/our-story/page.tsx — operators can now edit any of it from
-- the admin without a code change. ON CONFLICT DO UPDATE so re-running
-- the migration locally is safe even if the row already exists from a
-- prior workspace seed.
INSERT INTO "StaticPage" (
  "id", "slug", "title", "bodyMarkdown", "heroImage",
  "metaTitle", "metaDescription", "extras", "createdAt", "updatedAt"
) VALUES (
  'our-story-seed-2026',
  'our-story',
  'Our Story',
  '<p>Previously known as Ynot Fashion — an online multi-brand clothing store — we''ve rebranded as YNOT LONDON, marking an exciting new chapter in our journey.</p><p>Throughout the year, our team developed a luxury outerwear collection that blends style, functionality and sustainability with timeless designs and contemporary innovations. Every piece is designed in London and produced between London and Istanbul.</p><p>The collection features timeless silhouettes in seasonal colours with versatile styling options. Excellent craftsmanship, weather-resistant materials and unisex pieces sit at the heart of the line.</p><p><strong>Materials &amp; production standards.</strong> Our outerwear uses premium-quality materials, including vegetable-tanned leather sourced from Gold-rated suppliers of first-class raw materials. Leather outerwear is produced with zero leather waste — a commitment to sustainability built into the way we cut and pattern every piece.</p><p><strong>Featured pieces.</strong> Our lookbook showcases four signatures: the Lia Suede Bomber, Zoe Wool Coat, Tia Leather Bomber and Noa Leather Jacket.</p>',
  '/cms/our-story/hero.jpg',
  'Our Story · YNOT London',
  'Premium women''s outerwear designed in London — built to endure, designed to be relied on.',
  '{
    "valueCallouts": {
      "heading": "What we stand for",
      "items": [
        { "title": "Timeless design", "body": "Pieces designed to transcend seasons and trends — wardrobe foundations rather than fast fashion." },
        { "title": "Premium materials", "body": "Leather, suede, wool, cotton and Tencel — sourced with integrity from heritage suppliers." },
        { "title": "Sustainability", "body": "0% leather waste in production. Ethically sourced throughout the supply chain." },
        { "title": "London & Istanbul", "body": "Designed in our London studio. Made by skilled craftspeople between London and Istanbul." }
      ]
    },
    "pullQuote": {
      "quote": "Urban outerwear designed to move with you, for any occasion — from street to statement.",
      "attribution": "YNOT London"
    }
  }'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT ("slug") DO UPDATE SET
  -- Only fill in the new structured fields. Don''t overwrite an
  -- operator''s in-progress edits to title/body/hero/meta if the row
  -- already exists with non-default values.
  "extras" = COALESCE("StaticPage"."extras", EXCLUDED."extras");
