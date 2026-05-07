import { describe, expect, it } from "vitest";
import { ProductSchema } from "@/lib/schemas";
import { toProduct } from "../product";

const fixture = {
  id: "p1",
  slug: "leather-jacket",
  name: "Leather Jacket",
  description: "Tailored.",
  priceCents: 89500,
  currency: "GBP" as const,
  status: "PUBLISHED" as const,
  publishedAt: null as Date | null,
  preOrder: false,
  isOneSize: false,
  sizeGuideImage: null as string | null,
  materials: "Lamb leather",
  care: "Wipe with damp cloth",
  sizing: "True to size",
  weightGrams: null as number | null,
  hsCode: null as string | null,
  countryOfOriginCode: null as string | null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  images: [
    { url: "/p1/a.jpg", alt: "front", sortOrder: 0 },
    { url: "/p1/b.jpg", alt: "back", sortOrder: 1 },
  ],
  sizes: [
    { size: "S", stock: 3 },
    { size: "M", stock: 5 },
  ],
  colours: [
    { name: "Black", hex: "#000000", sortOrder: 0 },
    { name: "Tan", hex: "#C8A87C", sortOrder: 1 },
  ],
  categories: [
    { category: { slug: "jackets" } },
    { category: { slug: "outerwear" } },
  ],
};

describe("toProduct", () => {
  it("maps every required field and parses through the Zod schema", () => {
    const result = toProduct(fixture);
    expect(() => ProductSchema.parse(result)).not.toThrow();
  });

  it("renames priceCents to price", () => {
    expect(toProduct(fixture).price).toBe(89500);
  });

  it("nests details from flat columns", () => {
    expect(toProduct(fixture).details).toEqual({
      materials: "Lamb leather",
      care: "Wipe with damp cloth",
      sizing: "True to size",
    });
  });

  it("flattens images to URL strings", () => {
    expect(toProduct(fixture).images).toEqual(["/p1/a.jpg", "/p1/b.jpg"]);
  });

  it("converts sizes array to a stock map", () => {
    expect(toProduct(fixture).stock).toEqual({ S: 3, M: 5 });
  });

  it("exposes colour swatches and picks the first as default colour", () => {
    const r = toProduct(fixture);
    expect(r.colour).toBe("Black");
    expect(r.colourOptions).toEqual([
      { name: "Black", hex: "#000000" },
      { name: "Tan", hex: "#C8A87C" },
    ]);
  });

  it("omits colourOptions when no colours are present", () => {
    const r = toProduct({ ...fixture, colours: [] });
    expect(r.colourOptions).toBeUndefined();
    expect(r.colour).toBeUndefined();
  });

  it("flattens category junctions to slug strings", () => {
    expect(toProduct(fixture).categorySlugs).toEqual(["jackets", "outerwear"]);
  });
});
