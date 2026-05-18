import { CollectionLanding } from "@/components/catalog/collection-landing";
import { getCollectionPages } from "@/lib/cms/collection-pages";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata() {
  const pages = await getCollectionPages();
  return {
    title: `${pages["new-arrivals"].title} — YNOT London`,
    description: pages["new-arrivals"].intro,
  };
}

export default async function NewArrivalsPage({ searchParams }: PageProps) {
  return <CollectionLanding slug="new-arrivals" searchParams={await searchParams} />;
}
