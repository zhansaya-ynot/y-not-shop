import { auth } from '@/server/auth/nextauth';
import { requireOwner, AuthorizationError } from '@/server/auth/guards';
import { ProductUpdateSchema } from '@/lib/schemas/admin-product';
import {
  updateProduct,
  changeProductStatus,
  hardDeleteProduct,
} from '@/server/admin/catalog/product-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Ctx {
  params: Promise<{ id: string }>;
}

/**
 * `PATCH` updates editable fields (name, description, price, materials, etc.)
 * AND optionally re-links categories when `categoryIds` is provided. The
 * categoryIds extension is delegated to the service layer via the same
 * audit-wrapped write so the before/after JSON snapshot captures both.
 *
 * `DELETE` defaults to a soft archive. Passing `?hard=1` permanently removes
 * the product instead — order history is preserved via `OrderItem`'s SetNull
 * relation + denormalised snapshots, so this is safe even for products that
 * have been ordered.
 */
export async function PATCH(req: Request, ctx: Ctx): Promise<Response> {
  let session;
  try {
    session = requireOwner(await auth());
  } catch (e) {
    if (e instanceof AuthorizationError) return new Response('Forbidden', { status: 403 });
    throw e;
  }

  const actorId = session.user?.id;
  if (!actorId) return new Response('Forbidden', { status: 403 });
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = ProductUpdateSchema.safeParse(body);
  if (!parsed.success) {
    // Temporary diagnostics: surface exactly which field(s) failed
    // validation so a 400 from a stale client bundle is debuggable from
    // `docker logs ynot-app` without devtools.
    const flat = parsed.error.flatten();
    process.stderr.write(
      `[admin/products PATCH 400] id=${id} fieldErrors=${JSON.stringify(
        flat.fieldErrors,
      )} formErrors=${JSON.stringify(flat.formErrors)} bodyKeys=${JSON.stringify(
        body && typeof body === 'object' ? Object.keys(body) : null,
      )}\n`,
    );
    return Response.json({ error: flat }, { status: 400 });
  }

  const product = await updateProduct({
    id,
    input: parsed.data,
    actorId,
    ip: req.headers.get('x-forwarded-for') ?? undefined,
    ua: req.headers.get('user-agent') ?? undefined,
  });
  return Response.json(product);
}

export async function DELETE(req: Request, ctx: Ctx): Promise<Response> {
  let session;
  try {
    session = requireOwner(await auth());
  } catch (e) {
    if (e instanceof AuthorizationError) return new Response('Forbidden', { status: 403 });
    throw e;
  }

  const actorId = session.user?.id;
  if (!actorId) return new Response('Forbidden', { status: 403 });
  const { id } = await ctx.params;
  const hard = new URL(req.url).searchParams.get('hard') === '1';
  const ip = req.headers.get('x-forwarded-for') ?? undefined;
  const ua = req.headers.get('user-agent') ?? undefined;

  if (hard) {
    await hardDeleteProduct({ id, actorId, ip, ua });
    return Response.json({ id, deleted: true });
  }

  const product = await changeProductStatus({ id, to: 'ARCHIVED', actorId, ip, ua });
  return Response.json(product);
}
