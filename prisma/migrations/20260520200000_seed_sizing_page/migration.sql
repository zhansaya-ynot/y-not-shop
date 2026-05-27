-- Seed the /sizing StaticPage row so the page exists in /admin/content/pages
-- and the operator can edit it. Hardcoded fallback in src/app/sizing/page.tsx
-- covers the case where this row gets deleted or has empty markdown.
-- Idempotent: on conflict, preserve the operator's edits via COALESCE on
-- bodyMarkdown / title — only the slug + timestamps are guaranteed.

INSERT INTO "StaticPage" (
  "id",
  "slug",
  "title",
  "bodyMarkdown",
  "metaTitle",
  "metaDescription",
  "updatedAt"
)
VALUES (
  'seed_sizing',
  'sizing',
  'General sizing',
  '<p>YNOT pieces are cut to a relaxed, true-to-size fit. If you''re between sizes, we recommend sizing down for a tailored silhouette or sizing up for a more relaxed look.</p>

<h2>Women''s sizing</h2>
<table>
  <thead>
    <tr><th>Size</th><th>UK</th><th>EU</th><th>US</th><th>Bust (cm)</th><th>Waist (cm)</th><th>Hips (cm)</th></tr>
  </thead>
  <tbody>
    <tr><td>S</td><td>8</td><td>36</td><td>4</td><td>84</td><td>66</td><td>92</td></tr>
    <tr><td>M</td><td>10</td><td>38</td><td>6</td><td>88</td><td>70</td><td>96</td></tr>
    <tr><td>L</td><td>12</td><td>40</td><td>8</td><td>92</td><td>74</td><td>100</td></tr>
  </tbody>
</table>

<h2>How to measure</h2>
<p><strong>Bust:</strong> Measure around the fullest part, keeping the tape parallel to the floor.</p>
<p><strong>Waist:</strong> Measure around your natural waistline, the narrowest part of your torso.</p>
<p><strong>Hips:</strong> Measure around the fullest part of your hips, about 20cm below your waist.</p>

<h2>Need help?</h2>
<p>If you''re unsure about sizing for a specific piece, check the product page for a garment-specific size guide, or <a href="/contact">get in touch</a> — we''re happy to advise.</p>',
  'General sizing · YNOT London',
  'YNOT London sizing guide — UK / EU / US conversions, body measurements, and how to measure yourself.',
  NOW()
)
ON CONFLICT ("slug") DO UPDATE
SET
  "title" = COALESCE("StaticPage"."title", EXCLUDED."title"),
  "bodyMarkdown" = COALESCE(NULLIF("StaticPage"."bodyMarkdown", ''), EXCLUDED."bodyMarkdown"),
  "metaTitle" = COALESCE(NULLIF("StaticPage"."metaTitle", ''), EXCLUDED."metaTitle"),
  "metaDescription" = COALESCE(NULLIF("StaticPage"."metaDescription", ''), EXCLUDED."metaDescription");
