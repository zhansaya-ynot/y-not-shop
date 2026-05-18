import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/client";
import {
  getAllProducts,
  getProductBySlug,
  getProductsByCategory,
  getNewArrivals,
  getRecommendations,
  getRelatedProducts,
} from "@/server/data/products";
import { resetDb } from "@/server/__tests__/helpers/reset-db";

async function seedTwo() {
  const cat = await prisma.category.create({
    data: { slug: "jackets", name: "Jackets", sortOrder: 0 },
  });
  await prisma.product.create({
    data: {
      slug: "leather-jacket",
      name: "Leather Jacket",
      description: "Tailored.",
      priceCents: 89500,
      materials: "Lamb leather",
      care: "Wipe with damp cloth",
      sizing: "True to size",
      status: "PUBLISHED",
      sizes: { create: [{ size: "M", stock: 5 }] },
      colours: { create: [{ name: "Black", hex: "#000000", sortOrder: 0 }] },
      categories: { create: [{ categoryId: cat.id }] },
      images: { create: [{ url: "/p/a.jpg", sortOrder: 0 }] },
    },
  });
  await prisma.product.create({
    data: {
      slug: "silk-dress",
      name: "Silk Dress",
      description: "Cut on the bias.",
      priceCents: 50000,
      materials: "Silk",
      care: "Dry clean",
      sizing: "Runs small",
      status: "PUBLISHED",
    },
  });
}

describe("server/data/products", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("getAllProducts returns adapted Product shapes", async () => {
    await seedTwo();
    const all = await getAllProducts();
    expect(all).toHaveLength(2);
    const jacket = all.find((p) => p.slug === "leather-jacket")!;
    expect(jacket.price).toBe(89500);
    expect(jacket.details.materials).toBe("Lamb leather");
    expect(jacket.images).toEqual(["/p/a.jpg"]);
    expect(jacket.colourOptions).toEqual([{ name: "Black", hex: "#000000" }]);
    expect(jacket.stock).toEqual({ M: 5 });
  });

  it("getProductBySlug returns null when missing", async () => {
    expect(await getProductBySlug("nope")).toBeNull();
  });

  it("getProductsByCategory filters by slug", async () => {
    await seedTwo();
    const result = await getProductsByCategory("jackets");
    expect(result.map((p) => p.slug)).toEqual(["leather-jacket"]);
  });

  it("getNewArrivals respects the default limit of 4", async () => {
    await seedTwo();
    const result = await getNewArrivals();
    expect(result).toHaveLength(2);
  });

  it("getRecommendations excludes the named slug", async () => {
    await seedTwo();
    const result = await getRecommendations("leather-jacket");
    expect(result.map((p) => p.slug)).toEqual(["silk-dress"]);
  });

  it("getRelatedProducts returns the curated list when set", async () => {
    await seedTwo();
    const jacket = await prisma.product.findUniqueOrThrow({
      where: { slug: "leather-jacket" },
    });
    const dress = await prisma.product.findUniqueOrThrow({
      where: { slug: "silk-dress" },
    });
    await prisma.productRelation.create({
      data: { productId: jacket.id, relatedId: dress.id, sortOrder: 0 },
    });
    const result = await getRelatedProducts(jacket.id, jacket.slug);
    expect(result.map((p) => p.slug)).toEqual(["silk-dress"]);
  });

  it("getRelatedProducts falls back to auto recs when none curated", async () => {
    await seedTwo();
    const jacket = await prisma.product.findUniqueOrThrow({
      where: { slug: "leather-jacket" },
    });
    const result = await getRelatedProducts(jacket.id, jacket.slug);
    expect(result.map((p) => p.slug)).toEqual(["silk-dress"]);
  });
});
