import { CollectionLanding } from "@/components/catalog/collection-landing";
import { getCollectionPages } from "@/lib/cms/collection-pages";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata() {
  const pages = await getCollectionPages();
  return {
    title: `${pages.timeless.title} — YNOT London`,
    description: pages.timeless.intro,
  };
}

export default async function TimelessPage({ searchParams }: PageProps) {
  return <CollectionLanding slug="timeless" searchParams={await searchParams} />;
}
