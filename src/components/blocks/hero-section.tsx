"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import type { HeroBlock } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { duration, ease } from "@/lib/motion";

// 1×1 dark JPEG — paints instantly while the full hero decodes, kills the
// flash-of-blank-screen on slow connections. Generated once with sharp at
// build time; if the brand palette changes, regenerate to match.
const HERO_BLUR_DATA_URL =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AKpgD//Z";

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
          <Image
            src={hero.image}
            alt=""
            fill
            priority
            // fetchPriority="high" lets the browser kick off the request
            // before our React JS even hydrates. Combined with `priority`
            // it's the closest we can get to <link rel=preload> for
            // dynamically-sourced hero art.
            fetchPriority="high"
            sizes="100vw"
            placeholder="blur"
            blurDataURL={HERO_BLUR_DATA_URL}
            quality={80}
            className="object-cover"
          />
        </motion.div>
      ) : (
        <video
          src={hero.videoUrl ?? undefined}
          poster={hero.image}
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}

      <div className="absolute inset-0 bg-black/30" />

      <div className="relative z-10 flex h-full w-full flex-col items-center justify-center text-center text-foreground-inverse px-6">
        <motion.p
          className="font-heading text-[24px] uppercase tracking-[0.3em] md:text-[56px] md:tracking-[0.55em]"
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
          <Link href={hero.ctaHref} className="mt-12 inline-block">
            <Button
              size="lg"
              variant="outline"
              className="bg-transparent text-foreground-inverse border-foreground-inverse hover:bg-foreground-inverse hover:text-foreground-primary px-12"
            >
              {hero.ctaLabel}
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
