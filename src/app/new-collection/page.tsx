import { CollectionLanding } from "@/components/catalog/collection-landing";
import { getCollectionPages } from "@/lib/cms/collection-pages";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata() {
  const pages = await getCollectionPages();
  return {
    title: `${pages["new-collection"].title} — YNOT London`,
    description: pages["new-collection"].intro,
  };
}

export default async function NewCollectionPage({ searchParams }: PageProps) {
  return <CollectionLanding slug="new-collection" searchParams={await searchParams} />;
}
