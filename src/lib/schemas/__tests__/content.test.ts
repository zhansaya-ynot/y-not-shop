import { describe, it, expect } from "vitest";
import {
  HeroBlockSchema,
  AnnouncementBlockSchema,
  StaticPageSchema,
} from "../content";

describe("HeroBlockSchema", () => {
  it("accepts an image hero", () => {
    expect(() =>
      HeroBlockSchema.parse({
        kind: "image",
        image: "/images/hero/1.webp",
        mobileImage: "/images/hero/1-portrait.webp",
        videoUrl: null,
        mobileVideo: null,
        eyebrow: "New Collection",
        ctaLabel: "SHOP",
        ctaHref: "/collection/jackets",
      }),
    ).not.toThrow();
  });
});

describe("AnnouncementBlockSchema", () => {
  it("accepts a list of messages", () => {
    expect(() =>
      AnnouncementBlockSchema.parse({
        messages: ["Sign in and get 10% off", "Free UK shipping"],
      }),
    ).not.toThrow();
  });
});

describe("StaticPageSchema", () => {
  it("accepts a markdown body", () => {
    expect(() =>
      StaticPageSchema.parse({
        slug: "our-story",
        title: "Our Story",
        bodyMarkdown: "# Why Not?\n\nWe build outerwear...",
        meta: { title: "Our Story · YNOT", description: "About YNOT London" },
      }),
    ).not.toThrow();
  });
});

import contentFixture from "../../data/_mock/content.json";
import lookbookFixture from "../../data/_mock/lookbook.json";

describe("Mock content fixtures", () => {
  it("announcement parses", () => {
    expect(() => AnnouncementBlockSchema.parse(contentFixture.announcement)).not.toThrow();
  });
  it("hero parses", () => {
    expect(() => HeroBlockSchema.parse(contentFixture.hero)).not.toThrow();
  });
  it("every static page parses", () => {
    for (const page of contentFixture.staticPages) {
      expect(() => StaticPageSchema.parse(page)).not.toThrow();
    }
  });
});

import { LookbookSchema } from "../content";
describe("Lookbook fixture", () => {
  it("parses", () => {
    expect(() => LookbookSchema.parse(lookbookFixture)).not.toThrow();
  });
});
