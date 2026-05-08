-- Footer content stored on the SitePolicy singleton. Backfilled with
-- the previously-hardcoded columns (About / Customer Care / Product),
-- Instagram link, copyright, and tagline so the site footer renders
-- identically the moment this deploys. The COALESCE preserves any
-- already-set value if the migration runs more than once locally.
ALTER TABLE "SitePolicy" ADD COLUMN "footerJson" JSONB;

UPDATE "SitePolicy"
SET "footerJson" = COALESCE("footerJson", '{
  "columns": [
    {
      "title": "About",
      "links": [
        { "label": "Our Story", "href": "/our-story" },
        { "label": "Contact", "href": "/contact" }
      ]
    },
    {
      "title": "Customer Care",
      "links": [
        { "label": "Shipping and Returns", "href": "/shipping-returns" },
        { "label": "Initiate a Return", "href": "/initiate-return" },
        { "label": "Privacy Policy", "href": "/privacy" }
      ]
    },
    {
      "title": "Product",
      "links": [
        { "label": "Product Care", "href": "/product-care" },
        { "label": "General Sizing", "href": "/sizing" },
        { "label": "Sustainability", "href": "/sustainability" }
      ]
    }
  ],
  "instagramUrl": "https://instagram.com/ynotlondon",
  "copyright": "© {year} YNOT London. All rights reserved.",
  "tagline": "Designed in London · Made in London & Istanbul"
}'::jsonb);
