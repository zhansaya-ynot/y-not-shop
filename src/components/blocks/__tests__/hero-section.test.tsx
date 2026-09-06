import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { HeroBlock } from "@/lib/schemas";
import { HeroSection } from "../hero-section";

/**
 * The hero is art-directed: phones get a 9:16 crop, tablets and desktops a
 * 16:9 one. For images that switch happens in the markup via `<picture>`
 * (so the browser downloads exactly one file); for video it has to happen
 * in JS, because browsers ignore `media` on a `<source>` inside `<video>`.
 */

const imageHero: HeroBlock = {
  kind: "image",
  image: "/cms/hero-16x9.jpg",
  mobileImage: "/cms/hero-9x16.jpg",
  videoUrl: null,
  mobileVideo: null,
  eyebrow: "New Collection",
  ctaLabel: "EXPLORE",
  ctaHref: "/new-collection",
};

const videoHero: HeroBlock = {
  ...imageHero,
  kind: "video",
  videoUrl: "https://cdn.example.com/hero-16x9.mp4",
  mobileVideo: "https://cdn.example.com/hero-9x16.mp4",
};

/** Point window.matchMedia at a fixed answer for the desktop breakpoint. */
function stubMatchMedia(matches: boolean): void {
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({
        matches,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("HeroSection image hero", () => {
  it("serves the landscape crop to tablets and desktops", () => {
    const { container } = render(<HeroSection hero={imageHero} />);
    const source = container.querySelector("picture source");
    expect(source).toHaveAttribute("media", "(min-width: 768px)");
    expect(source?.getAttribute("srcset")).toContain(
      encodeURIComponent("/cms/hero-16x9.jpg"),
    );
  });

  it("serves the portrait crop to phones", () => {
    const { container } = render(<HeroSection hero={imageHero} />);
    const img = container.querySelector("picture img");
    expect(img?.getAttribute("srcset")).toContain(
      encodeURIComponent("/cms/hero-9x16.jpg"),
    );
  });

  it("uses the same asset at both breakpoints when no mobile crop exists", () => {
    const { container } = render(
      <HeroSection hero={{ ...imageHero, mobileImage: imageHero.image }} />,
    );
    const source = container.querySelector("picture source");
    const img = container.querySelector("picture img");
    expect(source?.getAttribute("srcset")).toContain(
      encodeURIComponent("/cms/hero-16x9.jpg"),
    );
    expect(img?.getAttribute("srcset")).toContain(
      encodeURIComponent("/cms/hero-16x9.jpg"),
    );
  });


  it("preloads one crop per breakpoint so LCP keeps its head start", () => {
    render(<HeroSection hero={imageHero} />);
    // Must be in <head> — a preload the browser only meets deep in <body>
    // has already lost the race it exists to win.
    const links = Array.from(
      document.head.querySelectorAll('link[rel="preload"][as="image"]'),
    );
    const desktop = links.find((l) =>
      l.getAttribute("imagesrcset")?.includes(encodeURIComponent("/cms/hero-16x9.jpg")),
    );
    const mobile = links.find((l) =>
      l.getAttribute("imagesrcset")?.includes(encodeURIComponent("/cms/hero-9x16.jpg")),
    );
    expect(desktop).toHaveAttribute("media", "(min-width: 768px)");
    expect(mobile).toHaveAttribute("media", "(max-width: 767.98px)");
  });

  it("still renders the eyebrow and CTA", () => {
    render(<HeroSection hero={imageHero} />);
    expect(screen.getByText("New Collection")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "EXPLORE" })).toHaveAttribute(
      "href",
      "/new-collection",
    );
  });
});

describe("HeroSection video hero", () => {
  it("plays the landscape cut on desktop", () => {
    stubMatchMedia(true);
    const { container } = render(<HeroSection hero={videoHero} />);
    expect(container.querySelector("video")).toHaveAttribute(
      "src",
      "https://cdn.example.com/hero-16x9.mp4",
    );
  });

  it("plays the portrait cut on phones", () => {
    stubMatchMedia(false);
    const { container } = render(<HeroSection hero={videoHero} />);
    expect(container.querySelector("video")).toHaveAttribute(
      "src",
      "https://cdn.example.com/hero-9x16.mp4",
    );
  });
});
