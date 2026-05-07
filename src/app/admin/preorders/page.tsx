import * as React from "react";
import Link from "next/link";
import { prisma } from "@/server/db/client";
import { ReleaseBatchButton } from "./_components/release-batch-button";
import type { PreorderBatchStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const ACTIVE_STATUSES: PreorderBatchStatus[] = ["PENDING", "IN_PRODUCTION"];
const SHIPPED_STATUSES: PreorderBatchStatus[] = ["SHIPPING", "COMPLETED"];

interface PageProps {
  searchParams?: Promise<{ view?: string }>;
}

/** Filter tabs at the top of /admin/preorders. Default 'active' so a batch
 *  whose product was later flagged as in-stock (and therefore moved past
 *  PENDING/IN_PRODUCTION) doesn't keep cluttering the operator's working
 *  view. The historical batches remain accessible under the 'shipped' tab. */
type View = "active" | "shipped" | "all";

export default async function AdminPreordersPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const view: View =
    params.view === "shipped" || params.view === "all" ? params.view : "active";

  const where =
    view === "active"
      ? { status: { in: ACTIVE_STATUSES } }
      : view === "shipped"
        ? { status: { in: SHIPPED_STATUSES } }
        : {};

  // Fetch batches matching the selected view with item counts so the operator
  // can see how big a release will be before they hit the button.
  const batches = await prisma.preorderBatch.findMany({
    where,
    orderBy: [{ status: "asc" }, { estimatedShipFrom: "asc" }],
    include: {
      product: { select: { id: true, name: true, slug: true } },
      _count: { select: { orderItems: true, cartItems: true } },
    },
  });

  // Per-batch: how many orders + how many of those are paid (NEW or later)
  // + how many shipments still need a label (so the operator only sees the
  // Retry button when retrying would actually do something).
  const orderCounts = await Promise.all(
    batches.map(async (b) => {
      const items = await prisma.orderItem.findMany({
        where: { preorderBatchId: b.id },
        select: { orderId: true, order: { select: { status: true } } },
      });
      const orderIds = new Set(items.map((i) => i.orderId));
      const paidOrderIds = new Set(
        items
          .filter((i) => i.order && i.order.status !== "PENDING_PAYMENT" && i.order.status !== "PAYMENT_FAILED")
          .map((i) => i.orderId),
      );
      const pendingShipments = await prisma.shipment.count({
        where: {
          orderId: { in: Array.from(paidOrderIds) },
          labelGeneratedAt: null,
          cancelledAt: null,
        },
      });
      return {
        id: b.id,
        orders: orderIds.size,
        paid: paidOrderIds.size,
        pendingShipments,
      };
    }),
  );
  const countsById = new Map(orderCounts.map((c) => [c.id, c]));

  return (
    <div className="max-w-5xl">
      <h2 className="text-2xl font-semibold mb-2">Preorders</h2>
      <div className="text-sm text-neutral-700 space-y-2 mb-6">
        <p>
          A <strong>preorder batch</strong>{" "}groups customer orders for a
          product that hasn&rsquo;t been produced yet. While the batch is
          <em> Pending</em> or <em>In production</em>, no carrier label is
          generated — customers see <code>Preparing</code> on their order.
        </p>
        <p>
          When the stock arrives at the despatch desk, hit{" "}
          <strong>Release for shipping</strong> on the relevant batch. We
          mark the batch as <em>Shipping</em> and create labels for every
          shipment in it (DHL or Royal Mail, by destination). Customers get
          their tracking emails automatically.
        </p>
      </div>

      <div className="flex gap-1 mb-4 border-b border-neutral-200">
        {(
          [
            { key: "active", label: "Active" },
            { key: "shipped", label: "Shipping & completed" },
            { key: "all", label: "All" },
          ] as { key: View; label: string }[]
        ).map((tab) => (
          <Link
            key={tab.key}
            href={tab.key === "active" ? "/admin/preorders" : `/admin/preorders?view=${tab.key}`}
            className={
              "px-4 py-2 text-xs uppercase tracking-wider border-b-2 -mb-px " +
              (view === tab.key
                ? "border-foreground-primary text-foreground-primary font-semibold"
                : "border-transparent text-neutral-500 hover:text-neutral-800")
            }
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-md border border-neutral-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-600 text-xs uppercase">
            <tr>
              <th className="text-left px-3 py-2">Batch</th>
              <th className="text-left px-3 py-2">Product</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-right px-3 py-2">Orders</th>
              <th className="text-left px-3 py-2">Ship from</th>
              <th className="text-left px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {batches.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-neutral-500">
                  {view === "active"
                    ? "No active preorder batches. New batches appear here when a customer adds a preorder product to their bag."
                    : view === "shipped"
                      ? "No shipped or completed batches yet."
                      : "No preorder batches yet."}
                </td>
              </tr>
            )}
            {batches.map((b) => {
              const c = countsById.get(b.id);
              // PENDING/IN_PRODUCTION batches are awaiting first release.
              // SHIPPING batches only get a Retry button if they actually have
              // shipments still missing a label — otherwise the action is just
              // noise. COMPLETED batches are always closed.
              const isFirstRelease =
                b.status === "PENDING" || b.status === "IN_PRODUCTION";
              const canRetry =
                b.status === "SHIPPING" && (c?.pendingShipments ?? 0) > 0;
              const releasable = isFirstRelease || canRetry;
              return (
                <tr key={b.id} className="border-t border-neutral-100 hover:bg-neutral-50">
                  <td className="px-3 py-3 font-medium">{b.name}</td>
                  <td className="px-3 py-3">
                    {b.product ? (
                      <Link
                        href={`/admin/catalog/products/${b.product.id}`}
                        className="underline"
                      >
                        {b.product.name}
                      </Link>
                    ) : (
                      <span className="text-neutral-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={
                        b.status === "PENDING" || b.status === "IN_PRODUCTION"
                          ? "text-accent-warm"
                          : b.status === "SHIPPING"
                            ? "text-foreground-primary"
                            : "text-foreground-tertiary"
                      }
                    >
                      {b.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right">
                    {c?.orders ?? 0}
                    {c && c.paid !== c.orders && (
                      <span className="text-[12px] text-neutral-500">
                        {" "}
                        ({c.paid} paid)
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-xs text-neutral-600">
                    {b.estimatedShipFrom.toISOString().slice(0, 10)}
                    {" – "}
                    {b.estimatedShipTo.toISOString().slice(0, 10)}
                  </td>
                  <td className="px-3 py-3">
                    {releasable ? (
                      <ReleaseBatchButton
                        batchId={b.id}
                        batchName={b.name}
                        paidOrderCount={c?.paid ?? 0}
                        alreadyShipping={b.status === "SHIPPING"}
                      />
                    ) : (
                      <span className="text-[12px] text-neutral-500">
                        {b.status === "SHIPPING"
                          ? "All labels ready"
                          : b.status === "COMPLETED"
                            ? "Done"
                            : "Closed"}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
