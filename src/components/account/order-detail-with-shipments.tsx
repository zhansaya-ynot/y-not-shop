import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/lib/format";
import { getTrackingUrl, type CarrierId } from "@/lib/tracking-url";
import { Display } from "@/components/ui/typography";

/**
 * Browser-safe shape mirrors the prisma row + relations the page loader
 * returns (`src/server/data/customer-orders.ts`). Kept local so this file
 * stays out of `@prisma/client` (forbidden in `src/components/**`).
 */
export type OrderForCustomer = {
  id: string;
  orderNumber: string;
  status: string;
  totalCents: number;
  carrier: CarrierId;
  createdAt: Date;
  shipFirstName: string;
  shipLastName: string;
  shipLine1: string;
  shipLine2: string | null;
  shipCity: string;
  shipPostcode: string;
  shipCountry: string;
  items: Array<{
    id: string;
    productImage: string;
    productName: string;
    colour: string;
    size: string;
    quantity: number;
    unitPriceCents: number;
    isPreorder: boolean;
  }>;
  shipments: Array<{
    id: string;
    carrier: CarrierId;
    trackingNumber: string | null;
    shippedAt: Date | null;
    deliveredAt: Date | null;
  }>;
  events: Array<{
    id: string;
    status: string;
    note: string | null;
    createdAt: Date;
  }>;
  returns: Array<{
    id: string;
    returnNumber: string;
    status: string;
    reason: string | null;
    createdAt: Date;
    items: Array<{
      id: string;
      quantity: number;
      orderItem: { productName: string; size: string };
    }>;
  }>;
};

const PENDING_RETURN_STATUSES = new Set([
  "REQUESTED",
  "AWAITING_PARCEL",
  "RECEIVED",
]);

const eventDateFormat = (d: Date) =>
  new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const carrierLabel = (c: CarrierId) =>
  c === "ROYAL_MAIL" ? "Royal Mail" : "DHL Express";

const statusLabel = (s: string) =>
  s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

export function OrderDetailWithShipments({ order }: { order: OrderForCustomer }) {
  const date = new Date(order.createdAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const pendingReturn = order.returns.find((r) =>
    PENDING_RETURN_STATUSES.has(r.status),
  );

  return (
    <div className="flex flex-col gap-12">
      <Link
        href="/account/orders"
        className="self-start inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.2em] text-foreground-secondary hover:text-foreground-primary transition-colors"
      >
        <span aria-hidden="true">←</span> Back to orders
      </Link>
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-foreground-secondary mb-2">
            Order #{order.orderNumber}
          </p>
          <Display level="md" as="h1">
            {date}
          </Display>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span
            data-testid="order-status"
            className="inline-flex items-center px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] bg-foreground-primary text-foreground-inverse"
          >
            {statusLabel(order.status)}
          </span>
          <p className="text-[14px] font-medium">
            {formatPrice(order.totalCents, "GBP")}
          </p>
        </div>
      </div>

      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.25em] text-foreground-secondary mb-4">
          Items
        </h2>
        <ul className="divide-y divide-border-light">
          {order.items.map((item) => (
            <li key={item.id} className="flex gap-4 py-5">
              <div className="relative h-24 w-20 flex-shrink-0 bg-surface-secondary">
                <Image
                  src={item.productImage}
                  alt={item.productName}
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              </div>
              <div className="flex flex-1 flex-col justify-between">
                <div>
                  <p className="text-[14px] font-medium">{item.productName}</p>
                  <p className="text-[12px] text-foreground-secondary">
                    {item.colour} · Size {item.size} · Qty {item.quantity}
                  </p>
                  {item.isPreorder && (
                    <p className="text-[11px] uppercase tracking-[0.15em] text-accent-warm mt-1">
                      Pre-order — ships in 4-6 weeks
                    </p>
                  )}
                </div>
                <p className="text-[14px]">
                  {formatPrice(item.unitPriceCents * item.quantity, "GBP")}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex justify-between border-t border-border-light pt-4 text-[14px] font-semibold">
          <span>Total</span>
          <span>{formatPrice(order.totalCents, "GBP")}</span>
        </div>
      </section>

      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.25em] text-foreground-secondary mb-4">
          Shipments
        </h2>
        {order.shipments.length === 0 ? (
          <p className="text-[13px] text-foreground-secondary">
            No shipments yet — your order is being prepared.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {order.shipments.map((s) => {
              const url = getTrackingUrl(s.carrier, s.trackingNumber);
              return (
                <li
                  key={s.id}
                  className="border border-border-light p-4 flex flex-col gap-2 text-[13px]"
                >
                  <div className="flex justify-between items-baseline">
                    <p className="font-medium">{carrierLabel(s.carrier)}</p>
                    {s.deliveredAt ? (
                      <span className="text-[11px] uppercase tracking-[0.15em] text-success">
                        Delivered
                      </span>
                    ) : s.shippedAt ? (
                      <span className="text-[11px] uppercase tracking-[0.15em] text-foreground-secondary">
                        In transit
                      </span>
                    ) : (
                      <span className="text-[11px] uppercase tracking-[0.15em] text-foreground-tertiary">
                        Preparing
                      </span>
                    )}
                  </div>
                  {s.trackingNumber ? (
                    url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="underline hover:no-underline"
                      >
                        Track shipment ({s.trackingNumber})
                      </a>
                    ) : (
                      <p>Tracking: {s.trackingNumber}</p>
                    )
                  ) : (
                    <p className="text-foreground-secondary">
                      Tracking number not yet available.
                    </p>
                  )}
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-[12px] text-foreground-secondary">
                    {s.shippedAt && (
                      <span>Shipped: {eventDateFormat(s.shippedAt)}</span>
                    )}
                    {s.deliveredAt && (
                      <span>Delivered: {eventDateFormat(s.deliveredAt)}</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.25em] text-foreground-secondary mb-4">
          Status timeline
        </h2>
        {order.events.length === 0 ? (
          <p className="text-[13px] text-foreground-secondary">No status events.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-[13px]">
            {order.events.map((ev) => (
              <li key={ev.id} className="flex gap-3">
                <span className="text-foreground-secondary leading-6">⏺</span>
                <div className="flex flex-col">
                  <p className="font-medium">{statusLabel(ev.status)}</p>
                  <p className="text-[12px] text-foreground-secondary">
                    {eventDateFormat(ev.createdAt)}
                    {ev.note ? ` — ${ev.note}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {order.returns.length > 0 && (
        <section>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.25em] text-foreground-secondary mb-4">
            Returns
          </h2>
          <ul className="flex flex-col gap-4">
            {order.returns.map((r) => (
              <li
                key={r.id}
                className="border border-border-light p-4 flex flex-col gap-2 text-[13px]"
              >
                <div className="flex justify-between items-baseline">
                  <p className="font-medium">Return #{r.returnNumber}</p>
                  <span className="text-[11px] uppercase tracking-[0.15em] text-foreground-secondary">
                    {statusLabel(r.status)}
                  </span>
                </div>
                <ul className="text-[12px] text-foreground-secondary">
                  {r.items.map((ri) => (
                    <li key={ri.id}>
                      {ri.orderItem.productName} · Size {ri.orderItem.size} · Qty {ri.quantity}
                    </li>
                  ))}
                </ul>
                {r.status === "AWAITING_PARCEL" && (
                  <p className="text-[12px] text-foreground-secondary">
                    Instructions emailed — please post the parcel by the date in your email.
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid gap-12 md:grid-cols-2">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.25em] text-foreground-secondary mb-4">
            Shipping address
          </h2>
          <p className="text-[13px] leading-relaxed">
            {order.shipFirstName} {order.shipLastName}
            <br />
            {order.shipLine1}
            <br />
            {order.shipLine2 && (
              <>
                {order.shipLine2}
                <br />
              </>
            )}
            {order.shipCity}, {order.shipPostcode}
            <br />
            {order.shipCountry}
          </p>
        </div>
      </section>

      <div className="flex flex-wrap gap-4 border-t border-border-light pt-8">
        {order.status === "PENDING_PAYMENT" || order.status === "PAYMENT_FAILED" ? (
          <Link
            href={`/checkout/resume/${order.id}`}
            className="inline-flex items-center justify-center bg-foreground-primary text-foreground-inverse px-8 py-3 text-[12px] font-semibold uppercase tracking-[0.2em] hover:bg-foreground-secondary transition-colors"
          >
            Resume payment
          </Link>
        ) : (
          <Link
            href="/"
            className="inline-flex items-center justify-center bg-foreground-primary text-foreground-inverse px-8 py-3 text-[12px] font-semibold uppercase tracking-[0.2em] hover:bg-foreground-secondary transition-colors"
          >
            Continue shopping
          </Link>
        )}
        {(order.status === "DELIVERED" || order.status === "PARTIALLY_DELIVERED") && !pendingReturn && (
          <Link
            href={`/initiate-return?orderId=${encodeURIComponent(order.orderNumber)}`}
            className="inline-flex items-center justify-center border border-border-dark px-8 py-3 text-[12px] font-semibold uppercase tracking-[0.2em] hover:bg-foreground-primary hover:text-foreground-inverse transition-colors"
          >
            Request return
          </Link>
        )}
        <Link
          href="/account/orders"
          className="inline-flex items-center justify-center border border-border-dark px-8 py-3 text-[12px] font-semibold uppercase tracking-[0.2em] hover:bg-foreground-primary hover:text-foreground-inverse transition-colors"
        >
          Back to orders
        </Link>
      </div>
    </div>
  );
}
