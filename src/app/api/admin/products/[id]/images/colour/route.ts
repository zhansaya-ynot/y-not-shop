import { auth } from '@/server/auth/nextauth';
import { requireOwner, AuthorizationError } from '@/server/auth/guards';
import { ProductImageColourSchema } from '@/lib/schemas/admin-product';
import { setProductImageColour } from '@/server/admin/catalog/product-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Ctx {
  params: Promise<{ id: string }>;
}

/**
 * `PATCH` tags a single product image with a colour (or clears it).
 * Used by the admin image grid's per-image colour dropdown.
 */
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
  const parsed = ProductImageColourSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const actorId = session.user?.id;
  if (!actorId) return new Response('Forbidden', { status: 403 });
  try {
    const updated = await setProductImageColour({
      productId: id,
      imageId: parsed.data.imageId,
      colour: parsed.data.colour,
      actorId,
      ip: req.headers.get('x-forwarded-for') ?? undefined,
      ua: req.headers.get('user-agent') ?? undefined,
    });
    return Response.json(updated);
  } catch (e) {
    if (/not found/i.test((e as Error).message)) return new Response('Not Found', { status: 404 });
    throw e;
  }
}
