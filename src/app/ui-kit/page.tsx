"use client";

import * as React from "react";
import { AnnouncementBar } from "@/components/announcement-bar";
import { ProductCard } from "@/components/product-card";
import { SiteFooterStatic, STATIC_FOOTER_FALLBACK } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Input } from "@/components/ui/input";
import { Display, Eyebrow } from "@/components/ui/typography";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup } from "@/components/ui/radio-group";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PasswordInput } from "@/components/ui/password-input";
import { PhoneInput } from "@/components/ui/phone-input";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { SizeSelector } from "@/components/ui/size-selector";
import { ColourSwatch } from "@/components/ui/colour-swatch";
import { IconButton } from "@/components/ui/icon-button";
import { Skeleton } from "@/components/ui/skeleton";
import { CardInput } from "@/components/ui/card-input";
import { Prose } from "@/components/ui/prose";
import { Grid } from "@/components/ui/grid";
import { Drawer } from "@/components/ui/drawer";
import { Modal } from "@/components/ui/modal";
import { ToastProvider, useToast } from "@/components/ui/toast";
import { Tabs } from "@/components/ui/tabs";
import { Accordion } from "@/components/ui/accordion";
import { WhatsAppWidget } from "@/components/whatsapp-widget";
import { MenuIcon, BagIcon } from "@/components/icons";

const COLORS = [
  { name: "foreground-primary", value: "#1A1A1A", className: "bg-foreground-primary" },
  { name: "foreground-secondary", value: "#666666", className: "bg-foreground-secondary" },
  { name: "foreground-tertiary", value: "#999999", className: "bg-foreground-tertiary" },
  { name: "foreground-on-cream", value: "#3D3428", className: "bg-foreground-on-cream" },
  { name: "surface-primary", value: "#FFFFFF", className: "bg-surface-primary border border-border-light" },
  { name: "surface-secondary", value: "#F5F0EB", className: "bg-surface-secondary" },
  { name: "surface-dark", value: "#1A1A1A", className: "bg-surface-dark" },
  { name: "surface-announcement", value: "#111111", className: "bg-surface-announcement" },
  { name: "border-light", value: "#E5E5E5", className: "bg-border-light" },
  { name: "border-dark", value: "#333333", className: "bg-border-dark" },
  { name: "accent-gold", value: "#C4A87C", className: "bg-accent-gold" },
  { name: "accent-warm", value: "#8B7355", className: "bg-accent-warm" },
  { name: "success", value: "#27AE60", className: "bg-success" },
  { name: "error", value: "#C0392B", className: "bg-error" },
];

const SAMPLE_PRODUCTS = [
  { name: "Camden Leather Jacket", price: "£890", image: "/sample/jacket-1.svg" },
  { name: "Soho Suede Bomber", price: "£720", image: "/sample/jacket-2.svg", badge: "new" as const },
  { name: "Mayfair Wool Coat", price: "£1,240", image: "/sample/jacket-3.svg" },
  { name: "Notting Cotton Trench", price: "£560", image: "/sample/jacket-4.svg", badge: "pre-order" as const },
];

function KitSection({
  title,
  caption,
  children,
}: {
  title: string;
  caption?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-border-light py-16 first:border-t-0">
      <div className="mb-10 flex flex-col gap-2">
        <Eyebrow>{title}</Eyebrow>
        {caption && (
          <p className="max-w-[65ch] text-[14px] text-foreground-secondary">
            {caption}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

function CheckboxDemo() {
  const [v, setV] = React.useState(false);
  return (
    <div className="flex flex-col gap-4 max-w-[384px]">
      <Checkbox
        label="I agree to the Terms & Conditions"
        checked={v}
        onChange={(e) => setV(e.target.checked)}
      />
      <Checkbox label="Subscribe to newsletter" defaultChecked />
      <Checkbox label="Disabled" disabled />
      <Checkbox label="With error" error="This field is required" />
    </div>
  );
}

function RadioDemo() {
  const [v, setV] = React.useState("rm");
  return (
    <div className="max-w-[448px]">
      <RadioGroup
        name="ship"
        value={v}
        onChange={setV}
        options={[
          { value: "rm", label: "Royal Mail — Free", description: "2–3 business days" },
          { value: "dhl", label: "DHL Worldwide", description: "8–10 business days" },
        ]}
      />
    </div>
  );
}

function SelectDemo() {
  const [v, setV] = React.useState("GB");
  return (
    <div className="max-w-[384px]">
      <Select
        label="Country"
        value={v}
        onChange={setV}
        options={[
          { value: "GB", label: "United Kingdom" },
          { value: "US", label: "United States" },
          { value: "FR", label: "France" },
          { value: "DE", label: "Germany" },
        ]}
      />
    </div>
  );
}

function PhoneDemo() {
  const [v, setV] = React.useState("");
  return (
    <div className="max-w-[384px]">
      <PhoneInput label="Phone" value={v} onChange={setV} placeholder="7700 900123" />
    </div>
  );
}

function QtyDemo() {
  const [v, setV] = React.useState(1);
  return <QuantityStepper value={v} onChange={setV} max={10} />;
}

function SizeDemo() {
  const [v, setV] = React.useState<"S" | "M" | "L">("M");
  return (
    <SizeSelector
      sizes={["S", "M", "L"]}
      value={v}
      onChange={(s) => setV(s as "S" | "M" | "L")}
      stock={{ S: 0, M: 3, L: 1 }}
    />
  );
}

function CardDemo() {
  const [v, setV] = React.useState({ number: "", expiry: "", cvc: "" });
  return (
    <div className="max-w-[448px]">
      <CardInput value={v} onChange={setV} />
    </div>
  );
}

function DrawerDemo() {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Open right drawer
      </Button>
      <Drawer open={open} onClose={() => setOpen(false)} side="right" title="Cart">
        <div className="p-5">Drawer content goes here.</div>
      </Drawer>
    </>
  );
}

function ModalDemo() {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Open modal
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Confirm">
        <p className="text-[14px] text-foreground-secondary">
          Are you sure you want to delete this address?
        </p>
        <div className="mt-6 flex gap-3 justify-end">
          <Button variant="outline" onClick={() => setOpen(false)} size="md">
            Cancel
          </Button>
          <Button onClick={() => setOpen(false)} size="md">
            Confirm
          </Button>
        </div>
      </Modal>
    </>
  );
}

function ToastDemo() {
  const { show } = useToast();
  return (
    <Button variant="outline" onClick={() => show("Promo code applied")}>
      Show toast
    </Button>
  );
}

function UIKitPage() {
  return (
    <>
      <AnnouncementBar />
      <SiteHeader />

      <main className="flex-1">
        <Container size="wide" className="py-12">
          <Eyebrow>Design system</Eyebrow>
          <Display level="lg" as="h1" className="mt-4">
            UI kit
          </Display>
          <p className="mt-4 max-w-[65ch] text-[15px] text-foreground-secondary">
            Every primitive used across the site, sourced from the YNOT Pencil
            design tokens. Use this page to verify spacing, colour and
            typography before composing screens.
          </p>

          <KitSection
            title="Typography"
            caption="Playfair Display for editorial headings, Inter for body and UI."
          >
            <div className="flex flex-col gap-8">
              <Display level="xl" as="p">
                YNOT
              </Display>
              <Display level="lg" as="p">
                Urban outerwear, built to endure.
              </Display>
              <Display level="md" as="p">
                Designed to be relied on.
              </Display>
              <Display level="sm" as="p">
                Why not is not a question. It&apos;s how she lives.
              </Display>
              <p className="text-[15px] leading-relaxed text-foreground-primary max-w-[65ch]">
                Body copy — Inter regular at 15px / 1.6 line height. Used for
                product descriptions, static pages and anything narrative.
              </p>
              <p className="text-[13px] leading-relaxed text-foreground-secondary max-w-[65ch]">
                Secondary body — 13px Inter, used for metadata, captions and
                supporting text alongside primary copy.
              </p>
              <Eyebrow>Eyebrow / label · 11px · 0.25em tracking</Eyebrow>
            </div>
          </KitSection>

          <KitSection title="Colour tokens" caption="Reference values mirror ynot.pen.">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {COLORS.map((c) => (
                <div key={c.name} className="flex flex-col gap-2">
                  <div className={`${c.className} aspect-[4/3] w-full`} />
                  <div className="flex flex-col">
                    <span className="text-[12px] font-medium text-foreground-primary">
                      {c.name}
                    </span>
                    <span className="text-[11px] uppercase tracking-[0.15em] text-foreground-tertiary">
                      {c.value}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </KitSection>

          <KitSection
            title="Buttons"
            caption="Primary CTA matches checkout, hero, sign-in actions. 52px desktop / 48px tablet / 44px small."
          >
            <div className="flex flex-col gap-8">
              <div className="flex flex-wrap items-end gap-4">
                <Button size="lg">Shop</Button>
                <Button size="md">See more</Button>
                <Button size="sm">Sign in</Button>
              </div>
              <div className="flex flex-wrap items-end gap-4">
                <Button variant="outline">Continue shopping</Button>
                <Button variant="ghost">Forgot password</Button>
                <Button variant="link">Initiate a return</Button>
              </div>
              <div className="max-w-[384px]">
                <Button fullWidth size="lg">
                  Add to bag
                </Button>
              </div>
              <div className="flex flex-wrap gap-4">
                <Button disabled>Disabled</Button>
                <Button variant="outline" disabled>
                  Disabled outline
                </Button>
              </div>
            </div>
          </KitSection>

          <KitSection
            title="Form fields"
            caption="Inline labels with bottom border, used in checkout and account flows."
          >
            <div className="grid max-w-[672px] gap-8 md:grid-cols-2">
              <Input label="Email" type="email" placeholder="you@example.com" />
              <Input label="Password" type="password" placeholder="••••••••" />
              <Input
                label="Postal code"
                placeholder="SW1A 1AA"
                hint="Used to estimate delivery."
              />
              <Input
                label="Promo code"
                placeholder="WELCOME10"
                error="This code has expired."
              />
            </div>
          </KitSection>

          <KitSection
            title="Product cards"
            caption="Grid card used in collection pages, new arrivals and recommendations."
          >
            <div className="grid grid-cols-2 gap-6 md:grid-cols-4 md:gap-8">
              {SAMPLE_PRODUCTS.map((p) => (
                <ProductCard
                  key={p.name}
                  href="#"
                  name={p.name}
                  price={p.price}
                  image={p.image}
                  badge={p.badge}
                />
              ))}
            </div>
          </KitSection>

          <KitSection
            title="Brand block"
            caption="Centred editorial statement used on the homepage between hero and grid."
          >
            <div className="bg-surface-secondary px-6 py-24 text-center">
              <Display level="md" as="p" className="mx-auto max-w-[768px] text-foreground-on-cream">
                Urban outerwear, built to endure. Designed to be relied on.
              </Display>
              <p className="mx-auto mt-6 max-w-[576px] text-[14px] uppercase tracking-[0.25em] text-foreground-on-cream">
                Why not is not a question. It&apos;s how she lives.
              </p>
            </div>
          </KitSection>

          <KitSection
            title="New form primitives"
            caption="Form inputs added in Phase 1."
          >
            <div className="grid gap-12 md:grid-cols-2">
              <div>
                <h4 className="text-[12px] uppercase tracking-[0.2em] text-foreground-secondary mb-4">
                  Checkbox
                </h4>
                <CheckboxDemo />
              </div>
              <div>
                <h4 className="text-[12px] uppercase tracking-[0.2em] text-foreground-secondary mb-4">
                  RadioGroup
                </h4>
                <RadioDemo />
              </div>
              <div>
                <h4 className="text-[12px] uppercase tracking-[0.2em] text-foreground-secondary mb-4">
                  Select
                </h4>
                <SelectDemo />
              </div>
              <div>
                <h4 className="text-[12px] uppercase tracking-[0.2em] text-foreground-secondary mb-4">
                  Textarea
                </h4>
                <Textarea label="Reason for return" placeholder="Tell us why" />
              </div>
              <div>
                <h4 className="text-[12px] uppercase tracking-[0.2em] text-foreground-secondary mb-4">
                  PasswordInput
                </h4>
                <PasswordInput label="Password" placeholder="••••••••" />
              </div>
              <div>
                <h4 className="text-[12px] uppercase tracking-[0.2em] text-foreground-secondary mb-4">
                  PhoneInput
                </h4>
                <PhoneDemo />
              </div>
            </div>
          </KitSection>

          <KitSection
            title="Commerce primitives"
            caption="QuantityStepper, SizeSelector, ColourSwatch, CardInput."
          >
            <div className="grid gap-12 md:grid-cols-2">
              <div>
                <h4 className="text-[12px] uppercase tracking-[0.2em] text-foreground-secondary mb-4">
                  QuantityStepper
                </h4>
                <QtyDemo />
              </div>
              <div>
                <h4 className="text-[12px] uppercase tracking-[0.2em] text-foreground-secondary mb-4">
                  SizeSelector
                </h4>
                <SizeDemo />
              </div>
              <div>
                <h4 className="text-[12px] uppercase tracking-[0.2em] text-foreground-secondary mb-4">
                  ColourSwatch
                </h4>
                <div className="flex gap-3">
                  <ColourSwatch name="Chocolate Brown" hex="#3D3428" selected />
                  <ColourSwatch name="Cream" hex="#F5F0EB" />
                  <ColourSwatch name="Black" hex="#1A1A1A" />
                </div>
              </div>
              <div>
                <h4 className="text-[12px] uppercase tracking-[0.2em] text-foreground-secondary mb-4">
                  CardInput (stub)
                </h4>
                <CardDemo />
              </div>
            </div>
          </KitSection>

          <KitSection
            title="Layout primitives"
            caption="Section, Grid, Skeleton, IconButton, WhatsAppWidget, Prose."
          >
            <div className="space-y-12">
              <div>
                <h4 className="text-[12px] uppercase tracking-[0.2em] text-foreground-secondary mb-4">
                  IconButton
                </h4>
                <div className="flex gap-2">
                  <IconButton aria-label="Open menu">
                    <MenuIcon />
                  </IconButton>
                  <IconButton aria-label="Open bag">
                    <BagIcon />
                  </IconButton>
                </div>
              </div>
              <div>
                <h4 className="text-[12px] uppercase tracking-[0.2em] text-foreground-secondary mb-4">
                  Skeleton
                </h4>
                <div className="space-y-2 max-w-[384px]">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-32 w-full" />
                </div>
              </div>
              <div>
                <h4 className="text-[12px] uppercase tracking-[0.2em] text-foreground-secondary mb-4">
                  Grid (4-col / 2-col mobile)
                </h4>
                <Grid cols={4} mobileCols={2}>
                  {[1, 2, 3, 4].map((n) => (
                    <div
                      key={n}
                      className="aspect-square bg-surface-secondary flex items-center justify-center"
                    >
                      {n}
                    </div>
                  ))}
                </Grid>
              </div>
              <div>
                <h4 className="text-[12px] uppercase tracking-[0.2em] text-foreground-secondary mb-4">
                  Prose
                </h4>
                <Prose>
                  <h2>Heading two</h2>
                  <p>
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                    Suspendisse euismod, leo nec consectetur ornare.
                  </p>
                  <ul>
                    <li>List item one</li>
                    <li>List item two</li>
                  </ul>
                </Prose>
              </div>
            </div>
          </KitSection>

          <KitSection title="Overlays" caption="Drawer, Modal, Toast — try them out.">
            <div className="flex flex-wrap gap-4">
              <DrawerDemo />
              <ModalDemo />
              <ToastDemo />
            </div>
          </KitSection>

          <KitSection title="Tabs and Accordion">
            <div className="grid gap-12 md:grid-cols-2">
              <div>
                <h4 className="text-[12px] uppercase tracking-[0.2em] text-foreground-secondary mb-4">
                  Tabs
                </h4>
                <Tabs
                  items={[
                    {
                      value: "delivery",
                      label: "Delivery",
                      content: (
                        <p className="text-[14px]">
                          UK 2–3 days · Worldwide 8–10 days. All free.
                        </p>
                      ),
                    },
                    {
                      value: "returns",
                      label: "Returns",
                      content: (
                        <p className="text-[14px]">
                          14 days unworn, free returns.
                        </p>
                      ),
                    },
                  ]}
                />
              </div>
              <div>
                <h4 className="text-[12px] uppercase tracking-[0.2em] text-foreground-secondary mb-4">
                  Accordion
                </h4>
                <Accordion
                  items={[
                    { value: "desc", title: "Description", content: "A timeless field jacket." },
                    { value: "mat", title: "Materials", content: "100% Italian suede." },
                    { value: "care", title: "Care", content: "Dry clean only." },
                  ]}
                />
              </div>
            </div>
          </KitSection>
        </Container>
      </main>

      <SiteFooterStatic content={STATIC_FOOTER_FALLBACK} />
    </>
  );
}

export default function UIKitPageWrapper() {
  return (
    <ToastProvider>
      <UIKitPage />
      <WhatsAppWidget phone="+44 7000 000000" message="Hi YNOT, I have a question." />
    </ToastProvider>
  );
}
