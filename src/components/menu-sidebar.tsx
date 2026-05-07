"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import gsap from "gsap";
import { useUIStore } from "@/lib/stores/ui-store";
import { Accordion } from "@/components/ui/accordion";
import logoWhite from "../../public/brand/ynot-logo-white.png";

interface MenuCategory {
  slug: string;
  name: string;
}

export interface MenuSidebarProps {
  categories: MenuCategory[];
}

/**
 * Mobile menu — full-screen black overlay revealed via a GSAP-driven
 * circular wave that radiates from the hamburger button's position. The
 * wordmark inside the overlay is the white-on-black variant, so the
 * brand reads as the ink expanding to fill the screen. Closing reverses
 * the same tween.
 *
 * Implementation notes:
 * - We animate clip-path: circle(R% at X Y) on the panel container.
 *   Webkit needs the `-webkit-clip-path` mirror; gsap.set + .to handle
 *   both via the proxied CSSPlugin.
 * - The wave's origin (X, Y) defaults to the top-left where the
 *   hamburger sits at 24px / 24px on phone breakpoints — adjust here
 *   if the icon ever moves.
 * - Locking body scroll is unnecessary on a 100vh fixed overlay, but
 *   we still null-out background scroll to avoid touch-scroll bleed
 *   when the user drags inside the menu on iOS Safari.
 */
export function MenuSidebar({ categories }: MenuSidebarProps) {
  const isOpen = useUIStore((s) => s.isMenuOpen);
  const close = useUIStore((s) => s.closeMenu);
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  // Track mounted-but-closing so the panel stays in the DOM through the
  // close tween — unmounting mid-animation snaps to nothing.
  const [present, setPresent] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) setPresent(true);
  }, [isOpen]);

  React.useEffect(() => {
    if (!present) return;
    const panel = panelRef.current;
    if (!panel) return;
    const origin = "32px 32px"; // hamburger button centre on mobile
    if (isOpen) {
      gsap.set(panel, {
        clipPath: `circle(0% at ${origin})`,
        webkitClipPath: `circle(0% at ${origin})`,
        pointerEvents: "auto",
      });
      gsap.to(panel, {
        clipPath: `circle(150% at ${origin})`,
        webkitClipPath: `circle(150% at ${origin})`,
        duration: 0.65,
        ease: "expo.out",
      });
    } else {
      gsap.to(panel, {
        clipPath: `circle(0% at ${origin})`,
        webkitClipPath: `circle(0% at ${origin})`,
        duration: 0.45,
        ease: "expo.in",
        onComplete: () => setPresent(false),
      });
    }
  }, [isOpen, present]);

  // Lock background scroll while the overlay is animating in or visible.
  React.useEffect(() => {
    if (!present) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [present]);

  if (!present) return null;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      className="fixed inset-0 z-[60] bg-foreground-primary text-foreground-inverse"
      style={{
        clipPath: "circle(0% at 32px 32px)",
        WebkitClipPath: "circle(0% at 32px 32px)",
      }}
    >
      <div className="flex items-center justify-between px-6 py-5">
        <Link href="/" onClick={close} className="relative block h-12 w-[110px]">
          <Image
            src={logoWhite}
            alt="YNOT London"
            fill
            sizes="110px"
            priority
            className="object-contain"
          />
        </Link>
        <button
          type="button"
          onClick={close}
          aria-label="Close menu"
          className="text-[24px] leading-none w-10 h-10 flex items-center justify-center"
        >
          ×
        </button>
      </div>

      <nav className="px-6">
        <MenuLinks categories={categories} close={close} />
      </nav>
    </div>
  );
}

function MenuLinks({
  categories,
  close,
}: {
  categories: MenuCategory[];
  close: () => void;
}) {
  const linkClass =
    "block py-3 text-[13px] font-semibold uppercase tracking-[0.15em] text-foreground-inverse hover:opacity-70 transition-opacity";
  const subLinkClass =
    "block py-2 text-[13px] text-foreground-inverse/70 hover:text-foreground-inverse transition-colors";

  return (
    <div className="border-t border-foreground-inverse/20">
      <Accordion
        items={[
          {
            value: "shop",
            title: <span className="text-foreground-inverse">Shop</span>,
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
      <div className="border-b border-foreground-inverse/20">
        <Link href="/our-story" onClick={close} className={linkClass}>
          Our Story
        </Link>
      </div>
      <div className="border-b border-foreground-inverse/20">
        <Link href="/contact" onClick={close} className={linkClass}>
          Contact
        </Link>
      </div>
      <div className="border-b border-foreground-inverse/20">
        <Link href="/shipping-returns" onClick={close} className={linkClass}>
          Shipping &amp; Returns
        </Link>
      </div>
      <div className="border-b border-foreground-inverse/20">
        <Link href="/account" onClick={close} className={linkClass}>
          Account
        </Link>
      </div>
    </div>
  );
}
