-- Seed the contact StaticPage row so /contact reads from DB on the
-- next deploy. Body kept empty (the page renders the info-grid +
-- form, not a long-form body). All editable copy lives in extras.
INSERT INTO "StaticPage" (
  "id", "slug", "title", "bodyMarkdown", "heroImage",
  "metaTitle", "metaDescription", "extras", "createdAt", "updatedAt"
) VALUES (
  'contact-seed-2026',
  'contact',
  'Contact',
  '',
  NULL,
  'Contact · YNOT London',
  'Get in touch with YNOT London.',
  '{
    "hero": {
      "eyebrow": "Get in touch",
      "title": "We''d love to hear from you."
    },
    "infoBlocks": [
      {
        "title": "Customer care",
        "body": "Response within 24 hours, Monday to Friday.",
        "linkHref": "mailto:hello@ynotlondon.com",
        "linkLabel": "hello@ynotlondon.com"
      },
      {
        "title": "Studio",
        "body": "YNOT London\nLondon, United Kingdom\n\nBy appointment only.",
        "linkHref": "",
        "linkLabel": ""
      },
      {
        "title": "WhatsApp",
        "body": "Tap the floating WhatsApp button at the bottom of any page for the fastest response.",
        "linkHref": "",
        "linkLabel": ""
      },
      {
        "title": "Press",
        "body": "",
        "linkHref": "mailto:press@ynotlondon.com",
        "linkLabel": "press@ynotlondon.com"
      }
    ],
    "formSection": {
      "heading": "Send us a message",
      "body": "We read every message. Replies within 24 hours, Monday to Friday."
    }
  }'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT ("slug") DO UPDATE SET
  -- Same idempotence pattern as the our-story seed: only fill extras
  -- when the row is missing structured content; never overwrite an
  -- operator's in-progress edits.
  "extras" = COALESCE("StaticPage"."extras", EXCLUDED."extras");
