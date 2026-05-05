import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { SiteOverlays } from "@/components/site-overlays";
import { CookieBanner } from "@/components/cookie-banner";
import { getAllCategories } from "@/server/data/categories";

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

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://ynotlondon.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "YNOT London",
    template: "%s · YNOT London",
  },
  description:
    "Urban outerwear, built to endure. Designed to be relied on. Premium women's outerwear from London.",
  openGraph: {
    type: "website",
    siteName: "YNOT London",
    title: "YNOT London",
    description: "Urban outerwear, built to endure. Designed to be relied on.",
    url: SITE_URL,
    images: [
      {
        url: "/cms/hero.jpg",
        width: 1200,
        height: 630,
        alt: "YNOT London — Premium Outerwear",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "YNOT London",
    description: "Urban outerwear, built to endure. Designed to be relied on.",
    images: ["/cms/hero.jpg"],
  },
  robots: { index: true, follow: true },
  icons: { icon: "/favicon.ico" },
};

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
      className={`${inter.variable} ${playfair.variable} h-full antialiased`}
    >
      <body className="min-h-screen bg-surface-primary text-foreground-primary font-body">
        {children}
        <SiteOverlays categories={menuCategories} />
        <CookieBanner />
      </body>
    </html>
  );
}
