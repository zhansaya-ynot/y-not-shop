import { AnnouncementBar } from "@/components/announcement-bar";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { WhatsAppWidget } from "@/components/whatsapp-widget";
import { HeroSection } from "@/components/blocks/hero-section";
import { BrandStatement } from "@/components/blocks/brand-statement";
import { ProductsRow } from "@/components/blocks/products-row";
import { EditorialOverlay } from "@/components/blocks/editorial-overlay";
import { LookbookCarousel } from "@/components/blocks/lookbook-carousel";
import { FadeUpOnScroll } from "@/components/blocks/fade-up-on-scroll";
import { ShopByCategory } from "@/components/blocks/shop-by-category";
import { NewsletterSignup } from "@/components/blocks/newsletter-signup";
import { getHero, getLookbook } from "@/server/data/content";
import { getNewArrivals } from "@/server/data/products";
import { prisma } from "@/server/db/client";

// Hardcoded as last-resort if SitePolicy hasn't been seeded yet — keeps
// the homepage from rendering blank lines on a fresh install.
const BRAND_FALLBACK = {
  primary:
    "Urban outerwear designed to move with you, for any occasion — from street to statement.",
  secondary: "Why not.",
  tertiary: "A way of living.",
};

async function getTopLevelCategories() {
  // Top-level categories only (no parent), excluding soft-deleted, sorted
  // by sortOrder then name. The Category model has no isActive flag — we
  // treat 'not deleted' as visible.
  return prisma.category.findMany({
    where: { deletedAt: null, parentId: null },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    take: 8,
    select: { slug: true, name: true, bannerImage: true },
  });
}

async function getBrandStatement() {
  const policy = await prisma.sitePolicy.findUnique({ where: { id: "singleton" } });
  return {
    primary: policy?.brandStatementPrimary?.trim() || BRAND_FALLBACK.primary,
    secondary: policy?.brandStatementSecondary?.trim() || BRAND_FALLBACK.secondary,
    tertiary: policy?.brandStatementTertiary?.trim() || BRAND_FALLBACK.tertiary,
  };
}

export default async function Home() {
  const [hero, lookbook, newArrivals, categories, brandStatement] = await Promise.all([
    getHero(),
    getLookbook(),
    getNewArrivals(4),
    getTopLevelCategories(),
    getBrandStatement(),
  ]);

  const timelessImage = "/cms/timeless.jpg";

  return (
    <>
      {/* Chrome stack — fixed over the hero, transparent at start, white on scroll */}
      <div className="fixed top-0 left-0 right-0 z-40">
        <AnnouncementBar />
        <SiteHeader overHero />
      </div>

      <main className="flex-1">
        <HeroSection hero={hero} />
        <FadeUpOnScroll>
          <BrandStatement
            primary={brandStatement.primary}
            secondary={brandStatement.secondary}
            tertiary={brandStatement.tertiary}
          />
        </FadeUpOnScroll>
        <FadeUpOnScroll>
          <ShopByCategory
            items={categories.map((c) => ({
              slug: c.slug,
              name: c.name,
              bannerImage: c.bannerImage,
            }))}
          />
        </FadeUpOnScroll>
        <FadeUpOnScroll>
          <EditorialOverlay
            title="Timeless Collection"
            body="Signature silhouettes that anchor the collection, crafted with ease and refinement for continual wear."
            image={timelessImage}
            ctaHref="/collection/jackets"
            ctaLabel="Explore"
          />
        </FadeUpOnScroll>
        <FadeUpOnScroll>
          <ProductsRow
            title="New Arrivals"
            products={newArrivals}
            ctaHref="/collection/jackets"
          />
        </FadeUpOnScroll>
        {/* Lookbook + newsletter only on tablet+ — mobile design (per
            ynot.pen) intentionally omits both blocks to keep the homepage
            short on phone screens. */}
        <div className="hidden md:block">
          <FadeUpOnScroll>
            <LookbookCarousel lookbook={lookbook} />
          </FadeUpOnScroll>
          <FadeUpOnScroll>
            <NewsletterSignup />
          </FadeUpOnScroll>
        </div>
      </main>

      <SiteFooter />
      <WhatsAppWidget phone="+44 7000 000000" message="Hi YNOT, I have a question." />
    </>
  );
}
