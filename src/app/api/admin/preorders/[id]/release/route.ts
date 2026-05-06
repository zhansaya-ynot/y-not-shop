import { NextResponse } from 'next/server';
import { auth } from '@/server/auth/nextauth';
import { requireOwner, AuthorizationError } from '@/server/auth/guards';
import { releaseBatchForShipping } from '@/server/preorders/service';
import { buildDeps } from '@/server/fulfilment/deps';
import { env } from '@/server/env';
import { prisma } from '@/server/db/client';
import { splitOrderIntoShipments } from '@/server/orders/shipments';

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
 *
 * Backfills missing Shipment rows before the release: order detail pages
 * created before the auto-batch fix landed (preorderBatchId on the item but
 * no Shipment row yet) would otherwise have nothing for tryCreateShipment to
 * iterate over.
 */
export async function POST(_req: Request, ctx: Ctx): Promise<Response> {
  try {
    requireOwner(await auth());
  } catch (e) {
    if (e instanceof AuthorizationError) return new Response('Forbidden', { status: 403 });
    throw e;
  }
  const { id } = await ctx.params;

  // 1. Backfill: every paid order with items in this batch and no shipment
  //    row gets one created now, so the release call below has something to
  //    iterate over.
  await prisma.$transaction(async (tx) => {
    const orphanItems = await tx.orderItem.findMany({
      where: {
        preorderBatchId: id,
        shipmentId: null,
        order: { status: { notIn: ['PENDING_PAYMENT', 'PAYMENT_FAILED', 'CANCELLED'] } },
      },
      include: {
        order: { select: { id: true, shipCountry: true, items: true } },
      },
    });
    const byOrder = new Map<
      string,
      { country: string; items: typeof orphanItems }
    >();
    for (const it of orphanItems) {
      if (!it.order) continue;
      const entry = byOrder.get(it.order.id) ?? {
        country: it.order.shipCountry,
        items: [],
      };
      entry.items.push(it);
      byOrder.set(it.order.id, entry);
    }
    for (const [orderId, { country, items }] of byOrder) {
      const groups = splitOrderIntoShipments(items, country);
      for (const g of groups) {
        // Shipment doesn't carry preorderBatchId itself — that lives on the
        // joined OrderItem rows (preorderBatchId column).
        const shipment = await tx.shipment.create({
          data: {
            orderId,
            carrier: g.carrier,
          },
        });
        if (g.itemIds.length > 0) {
          await tx.orderItem.updateMany({
            where: { id: { in: g.itemIds } },
            data: { shipmentId: shipment.id },
          });
        }
      }
    }
  });

  // 2. Run the release flow as before.
  const deps = buildDeps(env);
  try {
    const result = await releaseBatchForShipping(id, {
      tryCreateShipment: (shipmentId) => deps.tryCreateShipment(shipmentId),
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
