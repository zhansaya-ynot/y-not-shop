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
      <p className="text-sm text-neutral-600 mb-6">
        Each zone groups destination countries by carrier. Customers from a
        country present in a zone see the methods linked to that zone on
        checkout. Activate / deactivate zones to control where you ship.
      </p>
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
