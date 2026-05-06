"use client";

import * as React from "react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PhoneInput } from "@/components/ui/phone-input";
import { Button } from "@/components/ui/button";
import type { Address } from "@/lib/schemas";
import type { SavedAddress } from "@/lib/schemas/saved-address";

const COUNTRIES = [
  { value: "GB", label: "United Kingdom" },
  { value: "US", label: "United States" },
  { value: "FR", label: "France" },
  { value: "DE", label: "Germany" },
];

export interface AddressFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { label: string; address: Address }) => void;
  initial?: SavedAddress;
}

export function AddressFormModal({ open, onClose, onSubmit, initial }: AddressFormModalProps) {
  // Inner content is unmounted when closed; that gives us a fresh state machine
  // each time the modal opens, so we can use lazy initial state from `initial`
  // without resetting via setState in an effect.
  return (
    <Modal open={open} onClose={onClose} title={initial ? "Edit address" : "Add address"} width="min(560px, 95vw)">
      {open && (
        <AddressFormContent
          key={initial?.id ?? "new"}
          initial={initial}
          onCancel={onClose}
          onSubmit={(data) => {
            onSubmit(data);
            onClose();
          }}
        />
      )}
    </Modal>
  );
}

interface AddressFormContentProps {
  initial?: SavedAddress;
  onCancel: () => void;
  onSubmit: (data: { label: string; address: Address }) => void;
}

function AddressFormContent({ initial, onCancel, onSubmit }: AddressFormContentProps) {
  const [label, setLabel] = React.useState(initial?.label ?? "Home");
  const [firstName, setFirstName] = React.useState(initial?.address.firstName ?? "");
  const [lastName, setLastName] = React.useState(initial?.address.lastName ?? "");
  const [line1, setLine1] = React.useState(initial?.address.line1 ?? "");
  const [city, setCity] = React.useState(initial?.address.city ?? "");
  const [postcode, setPostcode] = React.useState(initial?.address.postcode ?? "");
  const [country, setCountry] = React.useState(initial?.address.country ?? "GB");
  const [phone, setPhone] = React.useState(initial?.address.phone ?? "");

  // Carriers reject non-Latin chars in name + address fields. Strip on input
  // so the saved value is always carrier-printable.
  const latinize = (s: string) => s.replace(/[^A-Za-z0-9 \-,./'#&()]/g, "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label || !firstName || !lastName || !line1 || !city || !postcode) return;
    onSubmit({
      label,
      address: { firstName, lastName, line1, line2: null, city, postcode, country, phone },
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <Input label="Label (Home, Work, etc.)" value={label} onChange={(e) => setLabel(e.target.value)} required />
      <p className="text-[11px] text-foreground-secondary -mt-2">
        Latin characters only — required by the courier.
      </p>
      <div className="grid gap-5 md:grid-cols-2">
        <Input label="First name" value={firstName} onChange={(e) => setFirstName(latinize(e.target.value))} required />
        <Input label="Last name" value={lastName} onChange={(e) => setLastName(latinize(e.target.value))} required />
      </div>
      <Input label="Street address" value={line1} onChange={(e) => setLine1(latinize(e.target.value))} required />
      <div className="grid gap-5 md:grid-cols-3">
        <Input label="City" value={city} onChange={(e) => setCity(latinize(e.target.value))} required />
        <Input label="Postcode" value={postcode} onChange={(e) => setPostcode(latinize(e.target.value))} required />
        <Select label="Country" value={country} onChange={setCountry} options={COUNTRIES} />
      </div>
      <PhoneInput label="Phone" value={phone} onChange={setPhone} />
      <div className="flex justify-end gap-3 mt-2">
        <Button variant="outline" size="md" type="button" onClick={onCancel}>Cancel</Button>
        <Button size="md" type="submit">{initial ? "Save changes" : "Add address"}</Button>
      </div>
    </form>
  );
}
