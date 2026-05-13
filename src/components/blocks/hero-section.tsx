"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import type { HeroBlock } from "@/lib/schemas";
import { duration, ease } from "@/lib/motion";
import { BLUR_DARK } from "@/lib/image-placeholders";

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
            blurDataURL={BLUR_DARK}
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
          // Script wordmark — italic, no caps, light tracking. Falls back
          // to Italianno (Google) when Englische Schreibschrift isn't
          // installed locally; Helvetica italic as final fallback.
          className="font-script italic text-[64px] leading-none md:text-[120px]"
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
          className="mt-6"
        >
          <Link
            href={hero.ctaHref}
            className="inline-block text-[13px] font-body tracking-[0.05em] text-foreground-inverse border-b border-foreground-inverse/80 pb-0.5 hover:border-foreground-inverse transition-colors"
          >
            {hero.ctaLabel}
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
