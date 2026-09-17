import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ynotlondon.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        // /api/ is closed by default, but two subtrees under it are public
        // and must stay crawlable: product images (/api/media/) and the
        // product feed (/api/feed/). Blocking the images hid every product
        // from Google Shopping — Merchant Center reports it as "Unable to
        // do quality and policy checks on product pages" and names
        // Googlebot-Image. Google resolves conflicts by longest match, so
        // these narrower Allow rules win over the broader Disallow below.
        allow: ["/", "/api/media/", "/api/feed/"],
        disallow: ["/account/", "/checkout/", "/api/"],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
