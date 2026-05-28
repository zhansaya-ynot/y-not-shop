import { notFound } from "next/navigation";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { AnnouncementBarServer } from "@/components/announcement-bar-server";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { WhatsAppWidget } from "@/components/whatsapp-widget";
import { Breadcrumb } from "@/components/catalog/breadcrumb";
import { CategoryHeader } from "@/components/catalog/category-header";
import { FilterBar } from "@/components/catalog/filter-bar";
import { SortDropdown } from "@/components/catalog/sort-dropdown";
import { ProductGridPaged } from "@/components/catalog/product-grid-paged";
import { getCategoryBySlug, getAllCategories } from "@/server/data/categories";
import { getProductsByCategory } from "@/server/data/products";
import {
  applyCatalogQuery,
  colourOptionsFromProducts,
  MATERIAL_SLUGS,
  type CatalogSort,
} from "@/lib/catalog/filter";
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
    .filter((c) => MATERIAL_SLUGS.includes(c.slug))
    .map((c) => ({ value: c.slug, label: c.name }));
  // No category dropdown here — the page is already scoped to one category.
  const colourOptions = colourOptionsFromProducts(base);

  const sortRaw = (sp.sort as string | undefined) ?? "newest";
  const sort: CatalogSort = sortRaw === "price-asc" || sortRaw === "price-desc" ? sortRaw : "newest";

  const filtered = applyCatalogQuery(base, {
    crossCategorySlug: (sp.material as string | undefined) ?? undefined,
    colour: (sp.colour as string | undefined) ?? undefined,
    size: (sp.size as Size | undefined) ?? undefined,
    maxPrice: sp.maxPrice ? Number(sp.maxPrice) : undefined,
    sort,
  });

  return (
    <>
      <AnnouncementBarServer />
      <SiteHeader />

      <main className="flex-1">
        <CategoryHeader
          title={cat.name}
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
              <FilterBar
                materialOptions={materialOptions}
                colourOptions={colourOptions}
              />
              <SortDropdown />
            </div>
          </Container>
        </Section>

        <Section padding="md">
          <Container size="wide">
            <ProductGridPaged products={filtered} pageSize={PAGE_SIZE_DEFAULT} />
          </Container>
        </Section>
      </main>

      <SiteFooter />
      <WhatsAppWidget />
    </>
  );
}
