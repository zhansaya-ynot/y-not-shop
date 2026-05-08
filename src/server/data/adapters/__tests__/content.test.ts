import { describe, expect, it } from "vitest";
import {
  HeroBlockSchema,
  LookbookSchema,
  StaticPageSchema,
} from "@/lib/schemas";
import { toHero, toLookbook, toStaticPage } from "../content";

describe("toHero", () => {
  const baseRow = {
    id: "h1",
    kind: "IMAGE" as const,
    imageUrl: "/cms/hero.jpg",
    videoUrl: null as string | null,
    eyebrow: "Welcome",
    ctaLabel: "Shop",
    ctaHref: "/collection/jackets",
    isActive: true,
    scheduledFor: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("renames imageUrl to image and lowercases kind for an image hero", () => {
    const r = toHero(baseRow);
    expect(r.kind).toBe("image");
    expect(r.image).toBe("/cms/hero.jpg");
    expect(r.videoUrl).toBeNull();
    expect(() => HeroBlockSchema.parse(r)).not.toThrow();
  });

  it("lowercases kind for a video hero and preserves videoUrl", () => {
    const r = toHero({
      ...baseRow,
      kind: "VIDEO",
      videoUrl: "https://cdn.example.com/h.mp4",
    });
    expect(r.kind).toBe("video");
    expect(r.videoUrl).toBe("https://cdn.example.com/h.mp4");
    expect(() => HeroBlockSchema.parse(r)).not.toThrow();
  });
});

describe("toLookbook", () => {
  it("wraps an array of rows in { images } and sorts by sortOrder", () => {
    const rows = [
      {
        id: "l2",
        src: "/lb/2.jpg",
        alt: "two",
        productSlug: "silk-dress",
        sortOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "l1",
        src: "/lb/1.jpg",
        alt: "one",
        productSlug: null,
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    const r = toLookbook(rows);
    expect(r.images.map((i) => i.src)).toEqual(["/lb/1.jpg", "/lb/2.jpg"]);
    expect(() => LookbookSchema.parse(r)).not.toThrow();
  });
});

describe("toStaticPage", () => {
  it("nests meta fields and parses through the Zod schema", () => {
    const r = toStaticPage({
      id: "s1",
      slug: "our-story",
      title: "Our Story",
      bodyMarkdown: "# Our Story",
      metaTitle: "Our Story · YNOT",
      metaDescription: "About us.",
      heroImage: null,
      extras: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(r.meta).toEqual({
      title: "Our Story · YNOT",
      description: "About us.",
    });
    expect(() => StaticPageSchema.parse(r)).not.toThrow();
  });
});
