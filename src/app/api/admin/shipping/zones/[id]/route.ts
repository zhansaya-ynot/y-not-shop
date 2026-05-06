import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/server/auth/nextauth";
import { requireOwner, AuthorizationError } from "@/server/auth/guards";
import { prisma } from "@/server/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  countries: z
    .array(
      z
        .string()
        .length(2)
        .regex(/^[A-Z]{2}$/, "ISO-3166-1 alpha-2 only"),
    )
    .optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: Request, ctx: Ctx): Promise<Response> {
  try {
    requireOwner(await auth());
  } catch (e) {
    if (e instanceof AuthorizationError) return new Response("Forbidden", { status: 403 });
    throw e;
  }
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION", issues: parsed.error.issues }, { status: 422 });
  }
  const updated = await prisma.shippingZone.update({
    where: { id },
    data: parsed.data,
    include: { methods: true },
  });
  return NextResponse.json({ zone: updated });
}
