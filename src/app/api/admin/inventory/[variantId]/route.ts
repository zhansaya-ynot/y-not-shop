import { z } from 'zod';
import { requireAdmin } from '@/server/auth/admin';
import { setVariantStock, InventoryError } from '@/server/inventory/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Ctx {
  params: Promise<{ variantId: string }>;
}

const PatchBody = z.object({
  stock: z.number().int().nonnegative(),
});

/**
 * PATCH /api/admin/inventory/:variantId
 *
 * Sets absolute stock for a single (productId, size) variant. Body:
 *   { stock: number } — non-negative integer.
 *
 * Returns 200 + { stock } on success, 400 on validation failure,
 * 401/403 on auth failure, 404 when the variant doesn't exist.
 */
export async function PATCH(req: Request, ctx: Ctx): Promise<Response> {
  try {
    await requireAdmin();
  } catch (e) {
    const status = (e as Error & { status?: number }).status ?? 500;
    return new Response(status === 401 ? 'Unauthenticated' : 'Forbidden', {
      status,
    });
  }

  const { variantId } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = PatchBody.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const stock = await setVariantStock(variantId, parsed.data.stock);
    return Response.json({ stock });
  } catch (e) {
    if (e instanceof InventoryError) {
      return Response.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
