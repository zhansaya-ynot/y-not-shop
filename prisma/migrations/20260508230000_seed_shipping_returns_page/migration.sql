-- Seed the shipping-returns StaticPage row so /shipping-returns reads
-- from DB on the next deploy. Same idempotence guard as our-story
-- and contact: ON CONFLICT only fills extras when null.
INSERT INTO "StaticPage" (
  "id", "slug", "title", "bodyMarkdown", "heroImage",
  "metaTitle", "metaDescription", "extras", "createdAt", "updatedAt"
) VALUES (
  'shipping-returns-seed-2026',
  'shipping-returns',
  'Shipping & Returns',
  '',
  NULL,
  'Shipping & Returns · YNOT London',
  'Free UK delivery via Royal Mail. Worldwide DHL. 14-day returns.',
  '{
    "hero": {
      "eyebrow": "Shipping & Returns",
      "title": "Easy returns within 14 days."
    },
    "delivery": {
      "intro": "UK shipping is free via Royal Mail. Worldwide DHL is charged at standard rates calculated at checkout. Orders are dispatched from our London warehouse within 1–2 business days.",
      "rows": [
        { "destination": "United Kingdom", "time": "2–3 business days", "carrier": "Royal Mail", "cost": "Free" },
        { "destination": "Worldwide", "time": "8–10 business days", "carrier": "DHL", "cost": "Calculated at checkout" }
      ],
      "note": "For pre-orders, please allow an extra 3 weeks on top of the standard delivery time. We''ll email you as soon as your item ships."
    },
    "returns": {
      "intro": "We accept returns within 14 days of delivery. Items must be unworn, in original condition with all tags attached.",
      "bullets": [
        "Items must be returned within 14 days of delivery",
        "All original tags and packaging must be intact",
        "Items must be unworn and in original condition",
        "Refunds are processed within 5–7 business days",
        "If the item was pre-ordered, allow an extra 3 weeks for it to be delivered"
      ],
      "ctaLabel": "Start your return",
      "ctaHref": "/initiate-return"
    }
  }'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT ("slug") DO UPDATE SET
  "extras" = COALESCE("StaticPage"."extras", EXCLUDED."extras");
