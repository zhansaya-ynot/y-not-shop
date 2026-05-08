-- Seed sustainability and product-care StaticPage rows. Same idempotent
-- pattern as our-story / contact / shipping-returns: ON CONFLICT only
-- fills extras when null so operator edits aren't clobbered.

INSERT INTO "StaticPage" (
  "id", "slug", "title", "bodyMarkdown", "heroImage",
  "metaTitle", "metaDescription", "extras", "createdAt", "updatedAt"
) VALUES (
  'sustainability-seed-2026',
  'sustainability',
  'Sustainability',
  '',
  NULL,
  'Sustainability · YNOT London',
  'Our approach to sustainability and animal welfare — by-product sourcing, LWG certification, zero waste production.',
  '{
    "hero": {
      "eyebrow": "Sustainability & Animal Welfare",
      "title": "Responsibility, woven in.",
      "description": "At YNOT London, sustainability isn''t a trend — it''s a responsibility. We believe that creating beautiful outerwear shouldn''t come at the cost of the planet."
    },
    "stats": [
      { "value": "0%", "label": "Leather waste" },
      { "value": "100%", "label": "By-product sourcing" },
      { "value": "LWG", "label": "Certified partners" }
    ],
    "approachHeading": "Our approach",
    "approaches": [
      { "title": "By-product sourcing", "body": "All leather used in YNOT products is a by-product of the food industry. We ensure that no animal is raised or harmed for the sole purpose of leather production." },
      { "title": "LWG certification", "body": "We partner exclusively with tanneries certified by the Leather Working Group, ensuring the highest standards in environmental management, water treatment, and energy efficiency." },
      { "title": "Zero waste production", "body": "Our cutting process is optimised to achieve 0% leather waste. Offcuts are repurposed for smaller accessories or returned to suppliers for use in other products." },
      { "title": "Responsible fibres", "body": "We use Tencel, a sustainably sourced wood fibre, alongside responsibly produced wool and organic cotton. Every material is chosen with the planet in mind." }
    ]
  }'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT ("slug") DO UPDATE SET
  "extras" = COALESCE("StaticPage"."extras", EXCLUDED."extras");

INSERT INTO "StaticPage" (
  "id", "slug", "title", "bodyMarkdown", "heroImage",
  "metaTitle", "metaDescription", "extras", "createdAt", "updatedAt"
) VALUES (
  'product-care-seed-2026',
  'product-care',
  'Product Care',
  '',
  NULL,
  'Product Care · YNOT London',
  'Care instructions for leather, shearling, suede, wool, and cotton outerwear.',
  '{
    "hero": {
      "eyebrow": "Product Care",
      "title": "Made to last.",
      "description": "Keep your YNOT pieces looking their best with these care instructions. Select a material to view detailed guidance."
    },
    "materials": [
      {
        "value": "leather",
        "label": "Leather",
        "intro": "Leather is a natural material that develops a beautiful patina over time. With proper care, your YNOT leather piece will last for years and only get better with age.",
        "sections": [
          { "title": "Cleaning", "body": "Wipe with a soft, damp cloth. Use specialist leather cleaner for stubborn marks. Never use harsh chemicals or abrasive materials." },
          { "title": "Protection", "body": "Apply leather conditioner every 6 months to maintain suppleness. Avoid direct sunlight and heat sources for prolonged periods." },
          { "title": "Storage", "body": "Store on a padded hanger in a breathable garment bag. Keep in a cool, dry place away from direct sunlight. Never fold leather garments." }
        ]
      },
      {
        "value": "shearling",
        "label": "Shearling",
        "intro": "Shearling is a luxurious natural material that requires gentle care to retain its softness, warmth, and longevity.",
        "sections": [
          { "title": "Cleaning", "body": "Spot clean only. For deep cleaning, use a specialist shearling cleaner — never machine wash or dry clean conventionally." },
          { "title": "Protection", "body": "Brush gently with a suede brush to maintain texture. Avoid prolonged exposure to rain or moisture." },
          { "title": "Storage", "body": "Hang on a wide padded hanger to maintain shape. Store in a cool, dry place. Use a garment bag if storing for an extended period." }
        ]
      },
      {
        "value": "suede",
        "label": "Suede",
        "intro": "Suede is delicate but durable when cared for properly. Regular brushing and prompt stain treatment keep your piece looking its best.",
        "sections": [
          { "title": "Cleaning", "body": "Use a suede brush to remove dust and revive nap. For stains, blot immediately with a clean cloth and use a suede eraser." },
          { "title": "Protection", "body": "Apply a suede protector spray before first wear and after cleaning. Avoid wearing in heavy rain." },
          { "title": "Storage", "body": "Hang on a padded hanger in a breathable garment bag. Stuff sleeves with tissue to maintain shape." }
        ]
      },
      {
        "value": "wool",
        "label": "Wool",
        "intro": "Wool is naturally resilient, breathable, and warm. With minimal care, your wool piece will serve you for many seasons.",
        "sections": [
          { "title": "Cleaning", "body": "Dry clean only. Brush gently with a soft clothes brush after each wear to remove surface dust and debris." },
          { "title": "Protection", "body": "Air your garment between wears to allow natural fibres to recover. Avoid direct heat when drying." },
          { "title": "Storage", "body": "Fold and store in a breathable bag with cedar blocks to deter moths. Avoid plastic, which traps moisture." }
        ]
      },
      {
        "value": "cotton",
        "label": "Cotton",
        "intro": "Cotton outerwear is the easiest to care for. Follow the care label for machine washing instructions and your piece will stay fresh wear after wear.",
        "sections": [
          { "title": "Cleaning", "body": "Machine wash cold on a gentle cycle with similar colours. Use a mild detergent — avoid bleach." },
          { "title": "Protection", "body": "Wash inside-out to preserve colour. Avoid over-drying — remove from the dryer while slightly damp." },
          { "title": "Storage", "body": "Fold or hang in a dry, ventilated place. Iron on a medium setting if needed." }
        ]
      }
    ]
  }'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT ("slug") DO UPDATE SET
  "extras" = COALESCE("StaticPage"."extras", EXCLUDED."extras");
