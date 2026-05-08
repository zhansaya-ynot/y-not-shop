"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { useCartStore } from "@/lib/stores/cart-store";
import { useUIStore } from "@/lib/stores/ui-store";
import {
  AccountIcon,
  BagIcon,
  MenuIcon,
  SearchIcon,
} from "./icons";

import logoBlack from "../../public/brand/ynot-logo-black.png";
import logoWhite from "../../public/brand/ynot-logo-white.png";

export interface SiteHeaderProps {
  /**
   * When true, header starts transparent over a hero and crossfades to white
   * as the user scrolls past the first viewport.
   */
  overHero?: boolean;
}

/** Returns a 0..1 progress that grows as the user scrolls down the first 70% of viewport height.
 *  When `active` is false (e.g. header on a page without a hero), the hook returns 1 — the
 *  fully-solid header state — without touching state inside an effect. */
function useScrollProgress(active: boolean): number {
  const [scrollValue, setScrollValue] = React.useState(0);
  React.useEffect(() => {
    if (!active) return;
    let raf = 0;
    const compute = () => {
      const range = window.innerHeight * 0.7;
      const next = Math.min(1, Math.max(0, window.scrollY / range));
      setScrollValue(next);
    };
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(compute);
    };
    compute();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, [active]);
  return active ? scrollValue : 1;
}

/** Linear interpolation between two channel values. */
function lerp(a: number, b: number, t: number) {
  return Math.round(a + (b - a) * t);
}

/**
 * Read cart count via useSyncExternalStore so the server snapshot is always 0
 * and the real count from the server-driven snapshot loads after hydration
 * without an HTML mismatch.
 */
function useHydratedCartCount(): number {
  return React.useSyncExternalStore(
    (cb) => useCartStore.subscribe(cb),
    () => useCartStore.getState().snapshot?.itemCount ?? 0,
    () => 0,
  );
}

export function SiteHeader({ overHero = false }: SiteHeaderProps) {
  const progress = useScrollProgress(overHero);
  const itemCount = useHydratedCartCount();
  const openCart = useCartStore((s) => s.openDrawer);
  const openMenu = useUIStore((s) => s.openMenu);
  const openSearch = useUIStore((s) => s.openSearch);
  // Owners/admins land in /admin straight from the header instead of having
  // to detour through the customer cabinet at /account. Fetch the role from
  // NextAuth's session endpoint once on mount; default to /account so the
  // link still works for the unauthenticated/customer case.
  const [accountHref, setAccountHref] = React.useState("/account");
  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/session", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((s: { user?: { role?: string } } | null) => {
        if (cancelled) return;
        const role = s?.user?.role;
        if (role === "ADMIN" || role === "OWNER") setAccountHref("/admin");
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Interpolate: progress 0 -> transparent bg + white text; 1 -> white bg + dark text
  const bgAlpha = progress;
  const textChannel = lerp(255, 26, progress); // 255 (white) -> 26 (#1A)
  const headerStyle: React.CSSProperties = overHero
    ? {
        backgroundColor: `rgba(255, 255, 255, ${bgAlpha})`,
        color: `rgb(${textChannel}, ${textChannel}, ${textChannel})`,
        borderBottomColor: progress > 0.95 ? "#E5E5E5" : "transparent",
        borderBottomWidth: 1,
        borderBottomStyle: "solid",
      }
    : {};

  return (
    <header
      className={cn(
        "w-full",
        // When NOT over hero, just a normal solid header
        !overHero &&
          "bg-surface-primary text-foreground-primary border-b border-border-light",
      )}
      style={headerStyle}
    >
      <div className="grid h-12 grid-cols-3 items-center px-5 md:h-16 md:px-8">
        <div className="flex items-center">
          <button
            type="button"
            aria-label="Open menu"
            onClick={openMenu}
            className="-ml-2 flex h-10 w-10 items-center justify-center"
          >
            <MenuIcon />
          </button>
        </div>

        <div className="flex items-center justify-center">
          <Link
            href="/"
            aria-label="YNOT London"
            className="relative block h-9 w-[130px] md:h-11 md:w-[170px]"
          >
            <Image
              src={logoWhite}
              alt=""
              priority
              fill
              sizes="(min-width: 768px) 170px, 130px"
              className="object-contain"
              style={{ opacity: overHero ? 1 - progress : 0 }}
            />
            <Image
              src={logoBlack}
              alt="YNOT London"
              priority
              fill
              sizes="(min-width: 768px) 170px, 130px"
              className="object-contain"
              style={{ opacity: overHero ? progress : 1 }}
            />
          </Link>
        </div>

        <div className="flex items-center justify-end gap-0 md:gap-2">
          <button
            type="button"
            aria-label="Search"
            onClick={openSearch}
            className="flex h-10 w-10 items-center justify-center"
          >
            <SearchIcon />
          </button>
          <Link
            href={accountHref}
            aria-label="Account"
            className="flex h-10 w-10 items-center justify-center"
          >
            <AccountIcon />
          </Link>
          <button
            type="button"
            aria-label={`Cart, ${itemCount} items`}
            onClick={openCart}
            className="relative -mr-2 flex h-10 w-10 items-center justify-center"
          >
            <BagIcon />
            {itemCount > 0 && (
              <span
                className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold"
                style={{
                  backgroundColor: overHero
                    ? `rgb(${textChannel}, ${textChannel}, ${textChannel})`
                    : undefined,
                  color: overHero
                    ? `rgb(${255 - textChannel + 26}, ${255 - textChannel + 26}, ${255 - textChannel + 26})`
                    : undefined,
                }}
              >
                {itemCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
