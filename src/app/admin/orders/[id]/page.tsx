import * as React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getForAdmin } from "@/server/orders/service";
import { AdminActionButton } from "./_actions/admin-action-button";
import { UpdateTrackingForm } from "./_actions/update-tracking-form";
import { PartialRefundForm } from "./_actions/partial-refund-form";
import { CancelOrderForm } from "./_actions/cancel-order-form";
import { ManualLabelForm } from "./_actions/manual-label-form";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ id: string }>;
}

const CANCELLABLE = ["NEW", "PROCESSING", "PARTIALLY_SHIPPED"];

const PENDING_RETURN_STATUSES = new Set([
  "REQUESTED",
  "AWAITING_PARCEL",
  "RECEIVED",
]);

/** Human-readable reason the cancel button is disabled for a given status. */
function disabledCancelReason(status: string): string {
  switch (status) {
    case "PENDING_PAYMENT":
      return "Payment hasn't been captured yet — the order will auto-cancel if it doesn't complete.";
    case "PAYMENT_FAILED":
      return "Payment failed. There's nothing to cancel — let the customer retry on /checkout/resume.";
    case "SHIPPED":
    case "PARTIALLY_DELIVERED":
    case "DELIVERED":
      return "Parcel is already with the carrier — use the Returns flow to refund a delivered order.";
    case "RETURNED":
      return "Order was already returned and refunded.";
    case "CANCELLED":
      return "Already cancelled.";
    default:
      return `Cancel isn't available for status ${status}.`;
  }
}

export default async function AdminOrderDetail({ params }: Params) {
  const { id } = await params;
  const order = await getForAdmin(id);
  if (!order) notFound();

  const hasFailedShipment = order.shipments.some((s) => !s.labelGeneratedAt);
  const hasShippedShipment = order.shipments.some((s) => s.shippedAt);
  const isCancellable = CANCELLABLE.includes(order.status);
  const endpoint = (suffix: string) => `/api/admin/orders/${order.id}/${suffix}`;
  const pendingReturn = order.returns.find((r) =>
    PENDING_RETURN_STATUSES.has(r.status),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <Link href="/admin/orders" className="text-xs underline text-neutral-500">
            ← All orders
          </Link>
          <h2 className="text-2xl font-semibold mt-1">{order.orderNumber}</h2>
          <div className="text-sm text-neutral-600">
            {order.status} · {order.carrier} · {order.shipCountry}
          </div>
        </div>
        <Link
          href={`/admin/orders/${order.id}/ship`}
          className="px-3 py-2 text-xs uppercase tracking-wider rounded bg-neutral-900 text-white"
        >
          Print &amp; despatch
        </Link>
      </div>

      {pendingReturn && (
        <div className="border border-amber-300 bg-amber-50 rounded-lg p-4 flex items-start gap-3">
          <span className="text-amber-700 text-lg leading-none mt-0.5">●</span>
          <div className="flex-1 text-sm">
            <p className="font-semibold text-amber-900">
              Customer requested a return — {pendingReturn.returnNumber}
            </p>
            <p className="text-amber-800 mt-1">
              Status: {pendingReturn.status.replace(/_/g, " ").toLowerCase()}
              {pendingReturn.reasonCategory ? ` · Reason: ${pendingReturn.reasonCategory}` : ""}
            </p>
            <Link
              href={`/admin/returns/${pendingReturn.id}`}
              className="inline-block mt-2 text-xs uppercase tracking-wider underline text-amber-900"
            >
              Open return →
            </Link>
          </div>
        </div>
      )}

      <section className="bg-white border border-neutral-200 rounded-lg p-5">
        <h3 className="font-semibold mb-3">Customer</h3>
        <div className="text-sm">
          <div>
            {order.shipFirstName} {order.shipLastName}
          </div>
          <div className="text-neutral-600">{order.user?.email ?? "—"}</div>
          <div className="mt-2 text-neutral-700">
            {order.shipLine1}
            {order.shipLine2 ? `, ${order.shipLine2}` : ""}, {order.shipCity},{" "}
            {order.shipPostcode}, {order.shipCountry}
          </div>
        </div>
      </section>

      <section className="bg-white border border-neutral-200 rounded-lg p-5">
        <h3 className="font-semibold mb-3">Items</h3>
        <table className="w-full text-sm">
          <thead className="text-xs text-neutral-500 uppercase">
            <tr>
              <th className="text-left">Item</th>
              <th className="text-right">Qty</th>
              <th className="text-right">Unit</th>
              <th className="text-right">Line</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((it) => (
              <tr key={it.id} className="border-t border-neutral-100">
                <td className="py-1">
                  {it.productName}
                  <span className="text-neutral-500"> ({it.size})</span>
                  {it.isPreorder && (
                    <span className="ml-2 text-xs text-amber-700">[preorder]</span>
                  )}
                </td>
                <td className="py-1 text-right">{it.quantity}</td>
                <td className="py-1 text-right">
                  £{(it.unitPriceCents / 100).toFixed(2)}
                </td>
                <td className="py-1 text-right">
                  £{((it.unitPriceCents * it.quantity) / 100).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-neutral-200 font-semibold">
              <td className="py-2" colSpan={3}>
                Total
              </td>
              <td className="py-2 text-right">£{(order.totalCents / 100).toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      <section className="bg-white border border-neutral-200 rounded-lg p-5">
        <h3 className="font-semibold mb-3">Shipments</h3>
        {order.shipments.length === 0 && (
          <p className="text-sm text-neutral-500">No shipments yet.</p>
        )}
        <ul className="space-y-2">
          {order.shipments.map((s) => (
            <li
              key={s.id}
              className="border border-neutral-100 rounded p-3 text-sm flex flex-wrap gap-x-6 gap-y-1"
            >
              <span>
                <strong>{s.carrier}</strong> · {s.trackingNumber ?? "no tracking"}
              </span>
              <span className="text-neutral-600">
                Label:{" "}
                {s.labelGeneratedAt
                  ? new Date(s.labelGeneratedAt).toISOString().slice(0, 16)
                  : "—"}
              </span>
              <span className="text-neutral-600">
                Shipped:{" "}
                {s.shippedAt
                  ? new Date(s.shippedAt).toISOString().slice(0, 16)
                  : "—"}
              </span>
              <span className="text-neutral-600">
                Delivered:{" "}
                {s.deliveredAt
                  ? new Date(s.deliveredAt).toISOString().slice(0, 16)
                  : "—"}
              </span>
              {s.attemptCount > 0 && (
                <span className="text-red-600">
                  {s.attemptCount} attempt(s){s.lastAttemptError ? `: ${s.lastAttemptError}` : ""}
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-white border border-neutral-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-5">Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="space-y-6">
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.25em] text-neutral-500">
              Fulfilment
            </h4>
            <div className="flex flex-wrap items-center gap-3">
              {order.shipments.some((s) => s.labelStorageKey) && (
                <Link
                  href={`/admin/orders/${order.id}/ship`}
                  className="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] rounded bg-foreground-primary text-foreground-inverse"
                >
                  Print &amp; despatch
                </Link>
              )}
              <AdminActionButton
                endpoint={endpoint("retry-label")}
                disabled={!hasFailedShipment}
              >
                Retry label
              </AdminActionButton>
            </div>
            <div className="space-y-2 border-t border-neutral-100 pt-5">
              <h5 className="text-[11px] font-semibold uppercase tracking-[0.25em] text-neutral-500">
                Manual label override
              </h5>
              <ManualLabelForm shipments={order.shipments} />
            </div>
            <div className="space-y-2 border-t border-neutral-100 pt-5">
              <h5 className="text-[11px] font-semibold uppercase tracking-[0.25em] text-neutral-500">
                Update tracking
              </h5>
              <UpdateTrackingForm shipments={order.shipments} />
            </div>
            <div className="border-t border-neutral-100 pt-5">
              <AdminActionButton
                endpoint={endpoint("resend-tracking-email")}
                disabled={!hasShippedShipment}
              >
                Resend tracking email
              </AdminActionButton>
            </div>
          </div>

          <div className="space-y-6">
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.25em] text-neutral-500">
              Money &amp; lifecycle
            </h4>
            <div className="space-y-2">
              <h5 className="text-[11px] font-semibold uppercase tracking-[0.25em] text-neutral-500">
                Partial refund
              </h5>
              <PartialRefundForm
                items={order.items.map((i) => ({
                  id: i.id,
                  productName: i.productName,
                  size: i.size,
                  quantity: i.quantity,
                  unitPriceCents: i.unitPriceCents,
                }))}
              />
            </div>
            <div className="space-y-2 border-t border-neutral-100 pt-5">
              <h5 className="text-[11px] font-semibold uppercase tracking-[0.25em] text-neutral-500">
                Cancel order
              </h5>
              <CancelOrderForm
                disabledReason={
                  isCancellable
                    ? null
                    : disabledCancelReason(order.status)
                }
              />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white border border-neutral-200 rounded-lg p-5">
        <h3 className="font-semibold mb-3">Status history</h3>
        <ul className="space-y-1 text-sm">
          {order.events.map((ev) => (
            <li key={ev.id} className="flex gap-3 text-neutral-700">
              <span className="font-mono text-xs text-neutral-500 shrink-0 w-36">
                {new Date(ev.createdAt).toISOString().slice(0, 16).replace("T", " ")}
              </span>
              <span className="font-medium">{ev.status}</span>
              {ev.note && <span className="text-neutral-600">— {ev.note}</span>}
            </li>
          ))}
        </ul>
      </section>

      {order.returns.length > 0 && (
        <section className="bg-white border border-neutral-200 rounded-lg p-5">
          <h3 className="font-semibold mb-3">Returns</h3>
          <ul className="space-y-3 text-sm">
            {order.returns.map((r) => (
              <li
                key={r.id}
                className="border border-neutral-100 rounded p-3 flex flex-col gap-2"
              >
                <div className="flex justify-between items-baseline">
                  <Link
                    href={`/admin/returns/${r.id}`}
                    className="font-medium underline"
                  >
                    {r.returnNumber}
                  </Link>
                  <span className="text-xs uppercase tracking-wider text-neutral-600">
                    {r.status.replace(/_/g, " ").toLowerCase()}
                  </span>
                </div>
                <ul className="text-xs text-neutral-600">
                  {r.items.map((ri) => (
                    <li key={ri.id}>
                      {ri.orderItem.productName} · {ri.orderItem.size} · qty {ri.quantity}
                    </li>
                  ))}
                </ul>
                {r.reason && (
                  <p className="text-xs text-neutral-600">Reason: {r.reason}</p>
                )}
                <span className="text-xs text-neutral-500">
                  Requested {new Date(r.createdAt).toISOString().slice(0, 16).replace("T", " ")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {order.refundEvents.length > 0 && (
        <section className="bg-white border border-neutral-200 rounded-lg p-5">
          <h3 className="font-semibold mb-3">Refunds</h3>
          <ul className="text-sm space-y-1">
            {order.refundEvents.map((r) => (
              <li key={r.id}>
                £{(r.amountCents / 100).toFixed(2)} — {r.reason}{" "}
                <span className="text-xs text-neutral-500">
                  ({new Date(r.createdAt).toISOString().slice(0, 10)})
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
