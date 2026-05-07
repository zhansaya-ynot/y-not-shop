"use client";

import * as React from "react";
import Link from "next/link";
import { Drawer } from "@/components/ui/drawer";
import { Accordion } from "@/components/ui/accordion";
import { useUIStore } from "@/lib/stores/ui-store";

interface MenuCategory {
  slug: string;
  name: string;
}

export interface MenuSidebarProps {
  categories: MenuCategory[];
}

/**
 * Mobile menu drawer. Layout follows the DUCIE / minimalist convention the
 * founder asked for: short body-sized list of top-level destinations, with
 * categories tucked behind a Shop accordion (motion-animated, matching
 * the rest of our UI). Avoids the previous 24px Playfair stack which read
 * as display copy and crowded the small mobile viewport.
 */
export function MenuSidebar({ categories }: MenuSidebarProps) {
  const isOpen = useUIStore((s) => s.isMenuOpen);
  const close = useUIStore((s) => s.closeMenu);

  const linkClass =
    "block py-3 text-[13px] font-semibold uppercase tracking-[0.15em] text-foreground-primary hover:text-foreground-secondary transition-colors";
  const subLinkClass =
    "block py-2 text-[13px] text-foreground-secondary hover:text-foreground-primary transition-colors";

  return (
    <Drawer open={isOpen} onClose={close} side="left" title="Menu">
      <nav className="flex flex-col px-6">
        <Accordion
          items={[
            {
              value: "shop",
              title: "Shop",
              content: (
                <div className="flex flex-col">
                  <Link href="/collection/jackets" onClick={close} className={subLinkClass}>
                    All
                  </Link>
                  {categories.map((c) => (
                    <Link
                      key={c.slug}
                      href={`/collection/${c.slug}`}
                      onClick={close}
                      className={subLinkClass}
                    >
                      {c.name}
                    </Link>
                  ))}
                </div>
              ),
            },
          ]}
        />
        <div className="border-b border-border-light">
          <Link href="/our-story" onClick={close} className={linkClass}>
            Our Story
          </Link>
        </div>
        <div className="border-b border-border-light">
          <Link href="/contact" onClick={close} className={linkClass}>
            Contact
          </Link>
        </div>
        <div className="border-b border-border-light">
          <Link href="/shipping-returns" onClick={close} className={linkClass}>
            Shipping &amp; Returns
          </Link>
        </div>
        <div className="border-b border-border-light">
          <Link href="/account" onClick={close} className={linkClass}>
            Account
          </Link>
        </div>
      </nav>
    </Drawer>
  );
}
