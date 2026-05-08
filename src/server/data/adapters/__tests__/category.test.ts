import { describe, expect, it } from "vitest";
import { CategorySchema } from "@/lib/schemas";
import { toCategory } from "../category";

const fixture = {
  id: "c1",
  slug: "jackets",
  name: "Jackets",
  description: "Outerwear staples.",
  bannerImage: "/cms/jackets.jpg",
  heroImage: null as string | null,
  sortOrder: 0,
  metaTitle: "Jackets · YNOT",
  metaDescription: "Premium jackets.",
  parentId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

describe("toCategory", () => {
  it("nests meta fields and parses through the Zod schema", () => {
    const result = toCategory(fixture);
    expect(result.meta).toEqual({
      title: "Jackets · YNOT",
      description: "Premium jackets.",
    });
    expect(() => CategorySchema.parse(result)).not.toThrow();
  });

  it("preserves nullable bannerImage", () => {
    expect(toCategory({ ...fixture, bannerImage: null }).bannerImage).toBeNull();
  });
});
