import { NextResponse } from 'next/server';
import { auth } from '@/server/auth/nextauth';
import { requireOwner, AuthorizationError } from '@/server/auth/guards';
import { releaseBatchForShipping } from '@/server/preorders/service';
import { buildDeps } from '@/server/fulfilment/deps';
import { env } from '@/server/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Ctx {
  params: Promise<{ id: string }>;
}

/**
 * Mark a preorder batch as SHIPPING and fire carrier label creation for every
 * shipment in it. Idempotent — already-labelled shipments short-circuit, so
 * the operator can hit the button multiple times safely if a previous run
 * failed mid-way.
 */
export async function POST(_req: Request, ctx: Ctx): Promise<Response> {
  try {
    requireOwner(await auth());
  } catch (e) {
    if (e instanceof AuthorizationError) return new Response('Forbidden', { status: 403 });
    throw e;
  }
  const { id } = await ctx.params;

  const deps = buildDeps(env);
  try {
    const result = await releaseBatchForShipping(id, {
      // buildDeps' wrapper already closes over baseTryDeps; the second arg is
      // a no-op overrides slot, so we don't need to pass shipmentDeps.
      tryCreateShipment: (shipmentId) => deps.tryCreateShipment(shipmentId),
      // releaseBatchForShipping requires a placeholder; the wrapper ignores it.
      shipmentDeps: {} as never,
    });
    return NextResponse.json({
      ok: true,
      batchId: result.batchId,
      shipmentCount: result.shipmentIds.length,
      results: result.results.map((r) => ({
        shipmentId: r.shipmentId,
        status: r.result.ok ? 'ok' : 'failed',
        message: r.result.error ?? null,
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
