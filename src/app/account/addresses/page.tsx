"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { AddressCard } from "@/components/account/address-card";
import { AddressFormModal } from "@/components/account/address-form-modal";
import { authFetch } from "@/lib/auth-fetch";
import type { SavedAddress } from "@/lib/schemas/saved-address";
import type { Address } from "@/lib/schemas";

const ADDRESSES_URL = "/api/auth/account/addresses";

export default function AccountAddressesPage() {
  const [addresses, setAddresses] = React.useState<SavedAddress[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<SavedAddress | null>(null);
  const [open, setOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    setError(null);
    try {
      const r = await fetch(ADDRESSES_URL, { credentials: "same-origin" });
      if (!r.ok) {
        setError("Couldn't load addresses.");
        return;
      }
      const j = (await r.json()) as { addresses: SavedAddress[] };
      setAddresses(j.addresses);
    } catch {
      setError("Couldn't load addresses.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const onSubmit = async (data: { label: string; address: Address }) => {
    setError(null);
    const payload = {
      label: data.label,
      isDefault: editing?.isDefault ?? addresses.length === 0,
      firstName: data.address.firstName,
      lastName: data.address.lastName,
      line1: data.address.line1,
      line2: data.address.line2 ?? null,
      city: data.address.city,
      postcode: data.address.postcode,
      country: data.address.country,
      phone: data.address.phone ?? "",
    };
    const url = editing ? `${ADDRESSES_URL}/${editing.id}` : ADDRESSES_URL;
    const method = editing ? "PATCH" : "POST";
    const r = await authFetch(url, { method, body: JSON.stringify(payload) });
    if (!r.ok) {
      setError(editing ? "Couldn't update address." : "Couldn't add address.");
      return;
    }
    setEditing(null);
    setOpen(false);
    await load();
  };

  const onDelete = async (id: string) => {
    setError(null);
    const r = await authFetch(`${ADDRESSES_URL}/${id}`, { method: "DELETE" });
    if (!r.ok) {
      setError("Couldn't delete address.");
      return;
    }
    await load();
  };

  const onSetDefault = async (id: string) => {
    setError(null);
    const r = await authFetch(`${ADDRESSES_URL}/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ isDefault: true }),
    });
    if (!r.ok) {
      setError("Couldn't update default address.");
      return;
    }
    await load();
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          Add address
        </Button>
      </div>

      {error && <p className="text-[13px] text-error">{error}</p>}

      {loading ? (
        <p className="text-[13px] text-foreground-secondary">Loading…</p>
      ) : addresses.length === 0 ? (
        <p className="text-[13px] text-foreground-secondary">
          No saved addresses yet.
        </p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {addresses.map((a) => (
            <AddressCard
              key={a.id}
              saved={a}
              onEdit={(s) => {
                setEditing(s);
                setOpen(true);
              }}
              onDelete={onDelete}
              onSetDefault={onSetDefault}
            />
          ))}
        </div>
      )}

      <AddressFormModal
        open={open}
        onClose={() => {
          setOpen(false);
          setEditing(null);
        }}
        onSubmit={onSubmit}
        initial={editing ?? undefined}
      />
    </div>
  );
}
