import { notFound } from "next/navigation";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { AnnouncementBar } from "@/components/announcement-bar";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { WhatsAppWidget } from "@/components/whatsapp-widget";
import { Breadcrumb } from "@/components/catalog/breadcrumb";
import { CategoryHeader } from "@/components/catalog/category-header";
import { FilterBar } from "@/components/catalog/filter-bar";
import { SortDropdown } from "@/components/catalog/sort-dropdown";
import { ProductGrid } from "@/components/catalog/product-grid";
import { LoadMoreButton } from "@/components/catalog/load-more-button";
import { getCategoryBySlug, getAllCategories } from "@/server/data/categories";
import { getProductsByCategory } from "@/server/data/products";
import { applyCatalogQuery, type CatalogSort } from "@/lib/catalog/filter";
import type { Size } from "@/lib/schemas";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const PAGE_SIZE_DEFAULT = 8;

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const cat = await getCategoryBySlug(slug);
  if (!cat) return { title: "Not found · YNOT London" };
  return { title: cat.meta.title, description: cat.meta.description };
}

export default async function CollectionPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const cat = await getCategoryBySlug(slug);
  if (!cat) notFound();

  const [base, allCategories] = await Promise.all([
    getProductsByCategory(slug),
    getAllCategories(),
  ]);

  const materialOptions = allCategories
    .filter((c) => ["leather", "suede", "wool", "cotton", "tencel"].includes(c.slug))
    .map((c) => ({ value: c.slug, label: c.name }));

  const sortRaw = (sp.sort as string | undefined) ?? "newest";
  const sort: CatalogSort = sortRaw === "price-asc" || sortRaw === "price-desc" ? sortRaw : "newest";

  const filtered = applyCatalogQuery(base, {
    crossCategorySlug: (sp.material as string | undefined) ?? undefined,
    size: (sp.size as Size | undefined) ?? undefined,
    maxPrice: sp.maxPrice ? Number(sp.maxPrice) : undefined,
    sort,
  });

  const limit = sp.limit ? Number(sp.limit) : PAGE_SIZE_DEFAULT;
  const visible = filtered.slice(0, limit);

  return (
    <>
      <AnnouncementBar />
      <SiteHeader />

      <main className="flex-1">
        <CategoryHeader
          title={cat.name}
          description={cat.description}
          bannerImage={cat.heroImage ?? cat.bannerImage}
        />

        <Section padding="md">
          <Container size="wide">
            <Breadcrumb crumbs={[{ label: "Home", href: "/" }, { label: cat.name }]} />
          </Container>
        </Section>

        <Section padding="sm">
          <Container size="wide">
            <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
              <FilterBar materialOptions={materialOptions} />
              <SortDropdown />
            </div>
          </Container>
        </Section>

        <Section padding="md">
          <Container size="wide">
            <ProductGrid products={visible} />
            <LoadMoreButton visible={visible.length} total={filtered.length} />
          </Container>
        </Section>
      </main>

      <SiteFooter />
      <WhatsAppWidget phone="+44 7000 000000" message="Hi YNOT, I have a question." />
    </>
  );
}
