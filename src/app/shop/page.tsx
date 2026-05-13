import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Display } from "@/components/ui/typography";
import { AnnouncementBar } from "@/components/announcement-bar";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { WhatsAppWidget } from "@/components/whatsapp-widget";
import { Breadcrumb } from "@/components/catalog/breadcrumb";
import { FilterBar } from "@/components/catalog/filter-bar";
import { SortDropdown } from "@/components/catalog/sort-dropdown";
import { ProductGrid } from "@/components/catalog/product-grid";
import { LoadMoreButton } from "@/components/catalog/load-more-button";
import { getAllCategories } from "@/server/data/categories";
import { getAllProducts } from "@/server/data/products";
import { applyCatalogQuery, type CatalogSort } from "@/lib/catalog/filter";
import type { Size } from "@/lib/schemas";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const PAGE_SIZE_DEFAULT = 12;

export const metadata = {
  title: "Shop all — YNOT London",
  description:
    "Browse every piece from the YNOT London collection — leather jackets, blazers, coats, and outerwear designed in London.",
};

/**
 * Catalogue index — every published product across every category.
 * Mirrors /collection/[slug]'s layout (filter bar + sort + product grid +
 * load-more) without the per-category banner, since "shop all" doesn't
 * have a single hero to point at.
 */
export default async function ShopPage({ searchParams }: PageProps) {
  const sp = await searchParams;

  const [base, allCategories] = await Promise.all([
    getAllProducts(),
    getAllCategories(),
  ]);

  const materialOptions = allCategories
    .filter((c) => ["leather", "suede", "wool", "cotton", "tencel"].includes(c.slug))
    .map((c) => ({ value: c.slug, label: c.name }));

  const sortRaw = (sp.sort as string | undefined) ?? "newest";
  const sort: CatalogSort =
    sortRaw === "price-asc" || sortRaw === "price-desc" ? sortRaw : "newest";

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
        <Section padding="md">
          <Container size="wide">
            <Breadcrumb crumbs={[{ label: "Home", href: "/" }, { label: "Shop all" }]} />
            <div className="mt-6 text-center">
              <Display level="lg" as="h1">
                Shop all
              </Display>
              <p className="mt-3 text-[14px] text-foreground-secondary max-w-[520px] mx-auto">
                Every piece from the current collection. Filter by material, size or price.
              </p>
            </div>
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
      <WhatsAppWidget />
    </>
  );
}
