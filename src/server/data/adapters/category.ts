import type { Category as ZodCategory } from "@/lib/schemas";
import type { Category as PrismaCategory } from "@prisma/client";

export function toCategory(row: PrismaCategory): ZodCategory {
  return {
    slug: row.slug,
    name: row.name,
    description: row.description,
    bannerImage: row.bannerImage,
    heroImage: row.heroImage,
    sortOrder: row.sortOrder,
    meta: {
      title: row.metaTitle,
      description: row.metaDescription,
    },
  };
}
