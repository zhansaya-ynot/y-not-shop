import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { SiteOverlays } from "@/components/site-overlays";
import { CookieBanner } from "@/components/cookie-banner";
import { MetaPixel } from "@/components/analytics/meta-pixel";
import { GoogleAdsTag } from "@/components/analytics/google-ads";
import { ConsentBridge } from "@/components/analytics/consent-bridge";
import { getAllCategories } from "@/server/data/categories";
import { prisma } from "@/server/db/client";

// Phase 8 — root layout fetches the live category list (chrome menu) and
// reads cookies via downstream client components, so it must render per-request.
// Marking it `force-dynamic` also keeps `next build` from prerendering pages at
// build time — Prisma is unreachable inside the Docker builder stage.
export const dynamic = "force-dynamic";

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

const playfair = Playfair_Display({
  variable: "--font-heading",
  subsets: ["latin"],
  display: "swap",
});

// Self-hosted Englische Schreibschrift BQ Regular (paid foundry font,
// licensed copy provided by the team). Next emits it under
// /_next/static/media/ with long-term cache headers; the CSS-variable
// pattern matches Inter/Playfair so Tailwind's font-script utility
// picks it up automatically.
const englischeSchreibschrift = localFont({
  src: "../../public/fonts/EnglischeSchreibschriftBQ-Regular.otf",
  variable: "--font-script",
  weight: "400",
  style: "normal",
  display: "swap",
});

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://ynotlondon.com";

// Social-share preview image (`og:image`). Admin-editable via the SitePolicy
// singleton (Site settings → "Social share image"); falls back to the bundled
// hero. `generateMetadata` (not a static export) so it can read the DB per
// request — safe because the layout is `force-dynamic`, so this never runs at
// Docker build time where Prisma is unreachable.
const DEFAULT_OG_IMAGE = "/cms/hero.jpg";

export async function generateMetadata(): Promise<Metadata> {
  let ogImage = DEFAULT_OG_IMAGE;
  try {
    const policy = await prisma.sitePolicy.findUnique({
      where: { id: "singleton" },
      select: { ogImage: true },
    });
    if (policy?.ogImage) ogImage = policy.ogImage;
  } catch {
    // Fall back to the bundled image if the DB read fails — metadata must
    // never break page rendering.
  }

  const description =
    "Urban outerwear designed to move with you, for any occasion — from street to statement.";

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: "YNOT London",
      template: "%s · YNOT London",
    },
    description: `${description} Why not. A way of living.`,
    openGraph: {
      type: "website",
      siteName: "YNOT London",
      title: "YNOT London",
      description,
      url: SITE_URL,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: "YNOT London — Premium Outerwear",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "YNOT London",
      description,
      images: [ogImage],
    },
    robots: { index: true, follow: true },
    icons: { icon: "/favicon.ico" },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const categories = await getAllCategories();
  const menuCategories = categories.map((c) => ({
    slug: c.slug,
    name: c.name,
  }));

  return (
    <html
      lang="en"
      className={`${inter.variable} ${playfair.variable} ${englischeSchreibschrift.variable} h-full antialiased`}
    >
      <body className="min-h-screen bg-surface-primary text-foreground-primary font-body">
        <MetaPixel />
        <GoogleAdsTag />
        <ConsentBridge />
        {children}
        <SiteOverlays categories={menuCategories} />
        <CookieBanner />
      </body>
    </html>
  );
}
