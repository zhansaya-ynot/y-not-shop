import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Phase 8 — emit a self-contained `.next/standalone` server bundle so the
  // Docker runner stage can run `node server.js` without `next start` or the
  // full node_modules tree.
  output: "standalone",
};

export default nextConfig;
