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
import { ProductGridPaged } from "@/components/catalog/product-grid-paged";
import { getAllCategories } from "@/server/data/categories";
import { getProductsByHomeCollection } from "@/server/data/products";
import {
  getCollectionPages,
  SLUG_TO_COLLECTION,
  type CollectionSlug,
} from "@/lib/cms/collection-pages";
import { applyCatalogQuery, type CatalogSort } from "@/lib/catalog/filter";
import type { Size } from "@/lib/schemas";

const PAGE_SIZE_DEFAULT = 12;

interface Props {
  slug: CollectionSlug;
  searchParams: Record<string, string | string[] | undefined>;
}

/**
 * Shared catalogue page for the three homepage collection landing routes
 * (/new-collection, /timeless, /new-arrivals). Same filter/sort/grid stack
 * as /shop, but the product set is scoped to one Product.homeCollection
 * value and the title/intro come from the operator-editable
 * SitePolicy.collectionPagesJson.
 */
export async function CollectionLanding({ slug, searchParams: sp }: Props) {
  const [base, allCategories, pages] = await Promise.all([
    getProductsByHomeCollection(SLUG_TO_COLLECTION[slug]),
    getAllCategories(),
    getCollectionPages(),
  ]);

  const page = pages[slug];

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

  return (
    <>
      <AnnouncementBar />
      <SiteHeader />

      <main className="flex-1">
        <Section padding="md">
          <Container size="wide">
            <Breadcrumb crumbs={[{ label: "Home", href: "/" }, { label: page.title }]} />
            <div className="mt-6 text-center">
              <Display level="lg" as="h1">
                {page.title}
              </Display>
              {page.intro && (
                <p className="mt-3 text-[14px] text-foreground-secondary max-w-[520px] mx-auto">
                  {page.intro}
                </p>
              )}
            </div>
          </Container>
        </Section>

        {base.length === 0 ? (
          <Section padding="md">
            <Container size="wide">
              <p className="text-center text-[14px] text-foreground-secondary py-12">
                No pieces in this collection yet — check back soon.
              </p>
            </Container>
          </Section>
        ) : (
          <>
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
                <ProductGridPaged products={filtered} pageSize={PAGE_SIZE_DEFAULT} />
              </Container>
            </Section>
          </>
        )}
      </main>

      <SiteFooter />
      <WhatsAppWidget />
    </>
  );
}
