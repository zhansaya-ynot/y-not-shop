import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Phase 8 — emit a self-contained `.next/standalone` server bundle so the
  // Docker runner stage can run `node server.js` without `next start` or the
  // full node_modules tree.
  output: "standalone",
  // Hero images run through next/image. AVIF cuts ~30% off vs WebP and
  // ~70% off vs JPEG for the same perceptual quality. Listing AVIF first
  // makes the image route pick it when supported, then fall back to WebP.
  // minimumCacheTTL bumps the edge cache to 30d so the optimised variants
  // stop re-encoding on every cold visit.
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
};

export default nextConfig;
