import { NextResponse } from "next/server";
import { auth } from "@/server/auth/nextauth";
import { requireOwner, AuthorizationError } from "@/server/auth/guards";
import { prisma } from "@/server/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/shipping/zones — list zones with their countries + methods. */
export async function GET(): Promise<Response> {
  try {
    requireOwner(await auth());
  } catch (e) {
    if (e instanceof AuthorizationError) return new Response("Forbidden", { status: 403 });
    throw e;
  }
  const zones = await prisma.shippingZone.findMany({
    orderBy: { sortOrder: "asc" },
    include: { methods: { orderBy: { name: "asc" } } },
  });
  return NextResponse.json({ zones });
}
