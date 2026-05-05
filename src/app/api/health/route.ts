import { prisma } from "@/server/db/client";
import { redis } from "@/server/redis";

export const dynamic = "force-dynamic";

const VERSION = process.env.GIT_SHA ?? process.env.IMAGE_TAG ?? "dev";

export async function GET(): Promise<Response> {
  const checks: { db: "up" | "down"; redis: "up" | "down" } = {
    db: "down",
    redis: "down",
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.db = "up";
  } catch {
    // db down — leave as "down"
  }

  try {
    const pong = await redis.ping();
    if (pong === "PONG") checks.redis = "up";
  } catch {
    // redis down — leave as "down"
  }

  const allUp = checks.db === "up" && checks.redis === "up";
  return Response.json(
    { ok: allUp, db: checks.db, redis: checks.redis, version: VERSION },
    { status: allUp ? 200 : 503 },
  );
}
