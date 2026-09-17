import { describe, it, expect } from "vitest";
import robots from "../robots";

/**
 * Product images are served from /api/media/... and the product feed from
 * /api/feed/... — both are public and both must be crawlable. A blanket
 * `Disallow: /api/` once hid every product image from Googlebot-Image,
 * which is what Merchant Center reports as "Unable to do quality and
 * policy checks on product pages".
 *
 * Google resolves conflicts by longest match, so the narrower
 * `Allow: /api/media/` beats `Disallow: /api/`.
 */

function rule() {
  const r = robots().rules;
  const rules = Array.isArray(r) ? r : [r];
  expect(rules).toHaveLength(1);
  return rules[0];
}

const asList = (v: string | string[] | undefined): string[] =>
  v === undefined ? [] : Array.isArray(v) ? v : [v];

describe("robots.txt", () => {
  it("lets crawlers reach product images under /api/media/", () => {
    expect(asList(rule().allow)).toContain("/api/media/");
  });

  it("lets crawlers reach the product feed under /api/feed/", () => {
    expect(asList(rule().allow)).toContain("/api/feed/");
  });

  it("still hides the rest of the API and the private pages", () => {
    const disallow = asList(rule().disallow);
    expect(disallow).toContain("/api/");
    expect(disallow).toContain("/account/");
    expect(disallow).toContain("/checkout/");
  });

  it("keeps a single wildcard group", () => {
    // Googlebot obeys only the most specific group that names it. Add a
    // Googlebot-specific group and it stops reading the `*` rules
    // entirely — /checkout/ and /account/ would quietly open up.
    expect(rule().userAgent).toBe("*");
  });
});
