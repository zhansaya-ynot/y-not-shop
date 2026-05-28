import { notFound } from "next/navigation";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { AnnouncementBar } from "@/components/announcement-bar";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { WhatsAppWidget } from "@/components/whatsapp-widget";
import { Breadcrumb } from "@/components/catalog/breadcrumb";
import { ProductDetailMedia } from "@/components/pdp/product-detail-media";
import { RecommendedProducts } from "@/components/pdp/recommended-products";
import { getProductBySlug, getRelatedProducts } from "@/server/data/products";
import { getCategoryBySlug } from "@/server/data/categories";
import { buildProductJsonLd } from "@/lib/seo/product-jsonld";
import { stripHtml } from "@/lib/strip-html";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const p = await getProductBySlug(slug);
  if (!p) return { title: "Not found · YNOT London" };
  return {
    title: `${p.name} · YNOT London`,
    // Description is rich HTML now — flatten to plain text for the meta tag.
    description: stripHtml(p.description).slice(0, 300),
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const recommendations = await getRelatedProducts(product.id, product.slug, 4);
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
            <ProductDetailMedia product={product} />
          </Container>
        </Section>

        <RecommendedProducts products={recommendations} />
      </main>

      <SiteFooter />
      <WhatsAppWidget />
    </>
  );
}
