"use client";

import * as React from "react";
import { getImageProps } from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import type { HeroBlock } from "@/lib/schemas";
import { duration, ease } from "@/lib/motion";
import { BLUR_DARK } from "@/lib/image-placeholders";
import { useMediaQuery } from "@/lib/use-media-query";

/**
 * Breakpoint the art direction pivots on — Tailwind's `md`. Phones get the
 * portrait crop; an iPad in portrait (820px) counts as desktop, because a
 * 9:16 asset stretched across a tablet crops down to a meaningless sliver.
 */
const DESKTOP_QUERY = "(min-width: 768px)";
/** Its exact complement, so precisely one preload below ever matches. */
const MOBILE_QUERY = "(max-width: 767.98px)";

/**
 * Nominal dimensions handed to `getImageProps`. They don't need to match
 * the uploaded file — they only set the aspect the srcSet is generated
 * for, and the rendered <img> is sized by CSS anyway.
 */
const DESKTOP_SIZE = { width: 1920, height: 1080 };
const MOBILE_SIZE = { width: 1080, height: 1920 };

/**
 * Art-directed hero image.
 *
 * `<picture>` + `getImageProps` rather than two `<Image>` elements toggled
 * with `hidden`/`block`: a hidden <img> is still downloaded, so the toggle
 * approach makes every visitor pay for both crops. Here the browser
 * evaluates `media` and fetches exactly one — while still going through
 * next/image's optimiser for AVIF/WebP.
 */
function HeroImage({ hero }: { hero: HeroBlock }): React.ReactElement {
  const common = {
    alt: "",
    sizes: "100vw",
    quality: 80,
    priority: true,
    placeholder: "blur" as const,
    blurDataURL: BLUR_DARK,
  };

  const {
    props: { srcSet: desktopSrcSet, src: desktopSrc },
  } = getImageProps({ ...common, ...DESKTOP_SIZE, src: hero.image });

  const {
    props: { srcSet: mobileSrcSet, style: blurStyle, ...imgProps },
  } = getImageProps({ ...common, ...MOBILE_SIZE, src: hero.mobileImage });

  return (
    <>
      {/* `priority` on <Image> emits a preload link; getImageProps can't, so
          we hoist our own. React keys resource hoisting off `href`, so each
          link carries one (the browser prefers imageSrcSet when it matches)
          and `media` keeps the browser to the single crop it will paint.
          Without these the hero — the LCP element — waits for the parser
          instead of starting during the preload scan. */}
      <link
        rel="preload"
        as="image"
        href={desktopSrc}
        imageSrcSet={desktopSrcSet}
        imageSizes="100vw"
        media={DESKTOP_QUERY}
        fetchPriority="high"
      />
      <link
        rel="preload"
        as="image"
        href={imgProps.src}
        imageSrcSet={mobileSrcSet}
        imageSizes="100vw"
        media={MOBILE_QUERY}
        fetchPriority="high"
      />
      <picture>
      <source media={DESKTOP_QUERY} srcSet={desktopSrcSet} sizes="100vw" />
      {/* Plain <img> on purpose: getImageProps is the documented way to
          art-direct, and <Image> cannot emit the <source> above. */}
      <img
        {...imgProps}
        alt=""
        srcSet={mobileSrcSet}
        style={blurStyle}
        className="absolute inset-0 h-full w-full object-cover"
      />
      </picture>
    </>
  );
}

/**
 * Art-directed hero video.
 *
 * Browsers ignore `media` on a `<source>` inside `<video>`, and rendering
 * two <video> elements would download both cuts, so the choice has to
 * happen in JS. Desktop is the server-side default: it matches the wider
 * asset most visitors on a cold cache see first, and phones swap on mount
 * before playback has meaningfully started.
 */
function HeroVideo({ hero }: { hero: HeroBlock }): React.ReactElement {
  const isDesktop = useMediaQuery(DESKTOP_QUERY, true);
  const src = isDesktop ? hero.videoUrl : hero.mobileVideo;
  const poster = isDesktop ? hero.image : hero.mobileImage;

  return (
    <video
      src={src ?? undefined}
      poster={poster}
      autoPlay
      loop
      muted
      playsInline
      className="absolute inset-0 h-full w-full object-cover"
    />
  );
}

export function HeroSection({ hero }: { hero: HeroBlock }) {
  return (
    <section className="relative w-full block h-[100svh] min-h-[600px] overflow-hidden bg-surface-dark shrink-0">
      {hero.kind === "image" ? (
        <motion.div
          className="absolute inset-0"
          initial={{ scale: 1.06, opacity: 0.7 }}
          animate={{
            scale: 1,
            opacity: 1,
            transition: { duration: 1.4, ease: ease.out },
          }}
        >
          <HeroImage hero={hero} />
        </motion.div>
      ) : (
        <HeroVideo hero={hero} />
      )}

      <div className="absolute inset-0 bg-black/30" />

      <div className="relative z-10 flex h-full w-full flex-col items-center justify-center text-center text-foreground-inverse px-6">
        <motion.p
          // Sized 1:1 with the Nour Hammour reference: 24px base, a
          // viewport-relative ramp from 375px up, capped at 36px past
          // 1300px. font-weight stays 400 (the only weight the script
          // family ships). Letting the family render its native slant
          // — no `italic` utility, which would synthesise an oblique
          // on top and overshoot the curve.
          className="font-script font-normal leading-[1.2] text-[24px] min-[375px]:text-[calc(19.14px+1.3vw)] min-[1300px]:text-[36px]"
          initial={{ y: 20, opacity: 0 }}
          animate={{
            y: 0,
            opacity: 1,
            transition: { duration: duration.slow, ease: ease.out, delay: 0.4 },
          }}
        >
          {hero.eyebrow}
        </motion.p>
        <motion.div
          initial={{ y: 16, opacity: 0 }}
          animate={{
            y: 0,
            opacity: 1,
            transition: { duration: duration.slow, ease: ease.out, delay: 0.7 },
          }}
        >
          <Link
            href={hero.ctaHref}
            // Reference sizes: 12px / 400 / line-height 1.35 / underline
            // offset 0.2em. Using text-decoration (not border-b) so the
            // offset utility actually applies.
            className="inline-block font-body text-[12px] font-normal leading-[1.35] text-foreground-inverse underline underline-offset-[0.2em]"
          >
            {hero.ctaLabel}
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
