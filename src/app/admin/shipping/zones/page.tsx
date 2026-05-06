import * as React from "react";
import { prisma } from "@/server/db/client";
import { ShippingZoneEditor } from "./_components/shipping-zone-editor";

export const dynamic = "force-dynamic";

export default async function AdminShippingZonesPage() {
  const zones = await prisma.shippingZone.findMany({
    orderBy: { sortOrder: "asc" },
    include: { methods: { orderBy: { name: "asc" } } },
  });

  return (
    <div className="max-w-3xl">
      <h2 className="text-2xl font-semibold mb-2">Shipping zones</h2>

      <div className="text-sm text-neutral-700 space-y-2 mb-6">
        <p>
          A <strong>shipping zone</strong> is a list of destination countries
          mapped to one or more carrier methods. When a customer fills in their
          address at checkout, we look up which zone covers their country and
          show only the methods linked to that zone.
        </p>
        <p>
          You have three zones below — keep, edit, or deactivate each one
          independently:
        </p>
        <ul className="list-disc pl-5 space-y-1 text-neutral-600">
          <li>
            <strong>United Kingdom</strong> — domestic. Royal Mail Tracked 48
            (free for the customer).
          </li>
          <li>
            <strong>European Union</strong> — DHL Express EU. Live rates.
          </li>
          <li>
            <strong>Worldwide</strong> — DHL Express Worldwide for the rest.
            Add or remove destinations here to control where you ship outside
            the UK / EU.
          </li>
        </ul>
        <p className="text-neutral-500">
          Tip: tick <em>Active</em> off on a zone to temporarily stop accepting
          orders to those countries — customers from there will still see the
          checkout form, but no shipping methods will appear and the
          &quot;Continue to payment&quot; button stays disabled.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        {zones.map((z) => (
          <ShippingZoneEditor
            key={z.id}
            zone={{
              id: z.id,
              name: z.name,
              countries: z.countries,
              isActive: z.isActive,
              methods: z.methods.map((m) => ({
                id: m.id,
                name: m.name,
                carrier: m.carrier,
                isActive: m.isActive,
              })),
            }}
          />
        ))}
      </div>
    </div>
  );
}
