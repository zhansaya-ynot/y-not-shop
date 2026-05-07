import { NextResponse } from "next/server";
import { z } from "zod";
import { withAdmin } from "@/server/auth/admin-route";
import { prisma } from "@/server/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const PatchBody = z.object({
  status: z.enum(["READ", "REPLIED"]),
});

/**
 * Admin actions on a single ContactMessage. Status transitions are recorded
 * with timestamps (readAt / repliedAt) so the inbox can show the operator
 * when each step happened.
 */
export const PATCH = withAdmin<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const json = await req.json().catch(() => null);
  const parsed = PatchBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }
  const status = parsed.data.status;
  const now = new Date();
  await prisma.contactMessage.update({
    where: { id },
    data: {
      status,
      readAt: status === "READ" ? now : undefined,
      repliedAt: status === "REPLIED" ? now : undefined,
    },
  });
  return NextResponse.json({ ok: true });
});

export const DELETE = withAdmin<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  await prisma.contactMessage.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
