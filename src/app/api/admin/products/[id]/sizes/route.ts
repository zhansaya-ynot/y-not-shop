import { auth } from '@/server/auth/nextauth';
import { requireOwner, AuthorizationError } from '@/server/auth/guards';
import { ProductSizesUpdateSchema } from '@/lib/schemas/admin-product';
import { setProductSizes } from '@/server/admin/catalog/product-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: Request, ctx: Ctx): Promise<Response> {
  let session;
  try {
    session = requireOwner(await auth());
  } catch (e) {
    if (e instanceof AuthorizationError) return new Response('Forbidden', { status: 403 });
    throw e;
  }

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = ProductSizesUpdateSchema.safeParse(body);
  if (!parsed.success) {
    // Temporary diagnostics — a stale client bundle still sending XS/XL
    // sizes would 400 here; log the offending payload so it's visible in
    // `docker logs ynot-app`.
    const flat = parsed.error.flatten();
    process.stderr.write(
      `[admin/products/sizes PATCH 400] id=${id} fieldErrors=${JSON.stringify(
        flat.fieldErrors,
      )} body=${JSON.stringify(body)}\n`,
    );
    return Response.json({ error: flat }, { status: 400 });
  }

  const actorId = session.user?.id;
  if (!actorId) return new Response('Forbidden', { status: 403 });
  const sizes = await setProductSizes({
    productId: id,
    sizes: parsed.data.sizes,
    actorId,
    ip: req.headers.get('x-forwarded-for') ?? undefined,
    ua: req.headers.get('user-agent') ?? undefined,
  });
  return Response.json(sizes);
}
