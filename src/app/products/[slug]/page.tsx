import { notFound } from "next/navigation";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { AnnouncementBar } from "@/components/announcement-bar";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { WhatsAppWidget } from "@/components/whatsapp-widget";
import { Breadcrumb } from "@/components/catalog/breadcrumb";
import { ProductGallery } from "@/components/pdp/product-gallery";
import { ProductInfoPanel } from "@/components/pdp/product-info-panel";
import { AddToBagSection } from "@/components/pdp/add-to-bag-section";
import { ProductDetailsAccordion } from "@/components/pdp/product-details-accordion";
import { RecommendedProducts } from "@/components/pdp/recommended-products";
import { getProductBySlug, getRecommendations } from "@/server/data/products";
import { getCategoryBySlug } from "@/server/data/categories";
import { buildProductJsonLd } from "@/lib/seo/product-jsonld";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const p = await getProductBySlug(slug);
  if (!p) return { title: "Not found · YNOT London" };
  return {
    title: `${p.name} · YNOT London`,
    description: p.description,
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const recommendations = await getRecommendations(product.slug, 4);
  const primaryCategorySlug = product.categorySlugs[0];
  const primaryCategory = primaryCategorySlug
    ? await getCategoryBySlug(primaryCategorySlug)
    : null;

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://ynotlondon.com";
  const jsonLd = buildProductJsonLd(product, baseUrl);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <AnnouncementBar />
      <SiteHeader />

      <main className="flex-1">
        <Section padding="sm">
          <Container size="wide">
            <Breadcrumb
              crumbs={[
                { label: "Home", href: "/" },
                primaryCategory
                  ? { label: primaryCategory.name, href: `/collection/${primaryCategory.slug}` }
                  : { label: "Shop", href: "/" },
                { label: product.name },
              ]}
            />
          </Container>
        </Section>

        <Section padding="md">
          <Container size="wide">
            <div className="grid gap-10 md:grid-cols-2 md:gap-16">
              <ProductGallery images={product.images} alt={product.name} />
              <div className="flex flex-col gap-10">
                <ProductInfoPanel
                  name={product.name}
                  price={product.price}
                  preOrder={product.preOrder}
                >
                  <AddToBagSection product={product} />
                </ProductInfoPanel>
                <ProductDetailsAccordion product={product} />
              </div>
            </div>
          </Container>
        </Section>

        <RecommendedProducts products={recommendations} />
      </main>

      <SiteFooter />
      <WhatsAppWidget />
    </>
  );
}
