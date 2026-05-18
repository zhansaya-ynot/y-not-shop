import { describe, it, expect } from "vitest";
import { ProductSchema, type Product } from "../product";

describe("ProductSchema", () => {
  it("accepts a complete valid product", () => {
    const valid: Product = {
      id: "prod_001",
      slug: "belted-suede-field-jacket",
      name: "Belted Suede Field Jacket",
      price: 89500,
      currency: "GBP",
      description: "A timeless field jacket.",
      images: ["/images/products/belted/1.webp"],
      colour: "Chocolate Brown",
      sizes: ["S", "M", "L"],
      categorySlugs: ["jackets", "suede"],
      stock: { S: 5, M: 3, L: 0 },
      preOrder: false,
      details: {
        materials: "100% suede",
        care: "Dry clean only",
        sizing: "Fits true to size",
      },
    };
    expect(() => ProductSchema.parse(valid)).not.toThrow();
  });

  it("rejects negative price", () => {
    expect(() =>
      ProductSchema.parse({
        id: "p",
        slug: "p",
        name: "n",
        price: -1,
        currency: "GBP",
        description: "d",
        images: [],
        sizes: [],
        categorySlugs: [],
        stock: {},
        preOrder: false,
        details: { materials: "", care: "", sizing: "" },
      }),
    ).toThrow();
  });

  it("rejects empty slug", () => {
    expect(() =>
      ProductSchema.parse({
        id: "p",
        slug: "",
        name: "n",
        price: 100,
        currency: "GBP",
        description: "d",
        images: [],
        sizes: [],
        categorySlugs: [],
        stock: {},
        preOrder: false,
        details: { materials: "", care: "", sizing: "" },
      }),
    ).toThrow();
  });
});

import productsFixture from "../../data/_mock/products.json";

describe("ProductSchema mock data", () => {
  it("validates every product in the mock JSON", () => {
    for (const p of productsFixture) {
      expect(() => ProductSchema.parse(p)).not.toThrow();
    }
  });
});
