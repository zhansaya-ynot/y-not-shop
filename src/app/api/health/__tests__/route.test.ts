import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/server/db/client", () => ({
  prisma: { $queryRaw: vi.fn().mockResolvedValue([{ "?column?": 1 }]) },
}));
vi.mock("@/server/redis", () => ({
  redis: { ping: vi.fn().mockResolvedValue("PONG") },
}));

import { GET } from "../route";
import { prisma } from "@/server/db/client";
import { redis } from "@/server/redis";

beforeEach(() => {
  vi.mocked(prisma.$queryRaw).mockResolvedValue([{ "?column?": 1 }]);
  vi.mocked(redis.ping).mockResolvedValue("PONG");
});

describe("GET /api/health", () => {
  it("returns ok+db+redis+version on success", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.db).toBe("up");
    expect(body.redis).toBe("up");
    expect(typeof body.version).toBe("string");
  });

  it("returns 503 when db is down", async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValueOnce(new Error("connection refused"));
    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.db).toBe("down");
    expect(body.redis).toBe("up");
  });

  it("returns 503 when redis is down", async () => {
    vi.mocked(redis.ping).mockRejectedValueOnce(new Error("redis down"));
    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.db).toBe("up");
    expect(body.redis).toBe("down");
  });
});
