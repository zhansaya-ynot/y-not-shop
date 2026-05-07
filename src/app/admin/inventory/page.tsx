import * as React from "react";
import { listInventoryForAdmin } from "@/server/inventory/service";
import { InventoryFilters } from "./_components/inventory-filters";
import { InventoryRow } from "./_components/inventory-row";

export const dynamic = "force-dynamic";

interface SP {
  searchParams: Promise<{
    search?: string;
    lowOnly?: string;
  }>;
}

export default async function AdminInventoryPage({ searchParams }: SP) {
  const sp = await searchParams;
  const filters = {
    search: sp.search?.trim() || undefined,
    lowOnly: sp.lowOnly === "1",
  };
  const rows = await listInventoryForAdmin(filters);

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6">Inventory</h2>
      <InventoryFilters
        initial={{ search: filters.search, lowOnly: filters.lowOnly }}
      />

      <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-600 text-xs uppercase">
            <tr>
              <th className="text-left px-3 py-2">Product</th>
              <th className="text-left px-3 py-2 w-20">Size</th>
              <th className="text-left px-3 py-2 w-32">Stock</th>
              <th className="text-left px-3 py-2 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-3 py-8 text-center text-neutral-500"
                >
                  No variants match these filters.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <InventoryRow key={r.variantId} row={r} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
