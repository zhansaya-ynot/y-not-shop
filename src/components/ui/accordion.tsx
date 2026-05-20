"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/cn";
import { duration, ease } from "@/lib/motion";

/**
 * Accordion items are either:
 * - regular collapsible rows (default): clicking toggles `content`.
 * - link rows (`href` supplied): the row navigates to that page and
 *   renders a `›` chevron instead of the `+`/`×` toggle. Use this for
 *   sections whose content lives on its own page (e.g. Care → /product-care).
 */
export type AccordionItem =
  | {
      value: string;
      title: React.ReactNode;
      content: React.ReactNode;
      href?: undefined;
    }
  | {
      value: string;
      title: React.ReactNode;
      href: string;
      content?: undefined;
    };

export interface AccordionProps {
  items: AccordionItem[];
  /** When true, multiple items can be open at once. Default false. */
  multiple?: boolean;
  className?: string;
}

export function Accordion({
  items,
  multiple = false,
  className,
}: AccordionProps) {
  const [open, setOpen] = React.useState<string[]>([]);

  const toggle = (value: string) => {
    setOpen((prev) => {
      if (prev.includes(value)) return prev.filter((v) => v !== value);
      if (multiple) return [...prev, value];
      return [value];
    });
  };

  return (
    <div className={cn("border-t border-border-light", className)}>
      {items.map((it) => {
        // Link variant — render as <Link>, no toggle state, chevron-right
        // icon matches the visual weight of the `+` so the row reads as
        // part of the same list.
        if (it.href) {
          return (
            <div key={it.value} className="border-b border-border-light">
              <Link
                href={it.href}
                className={cn(
                  "w-full flex items-center justify-between py-5",
                  "text-left text-[13px] font-semibold uppercase tracking-[0.15em] text-foreground-primary",
                )}
              >
                <span>{it.title}</span>
                <span aria-hidden className="text-[18px] font-light leading-none">
                  ›
                </span>
              </Link>
            </div>
          );
        }

        const isOpen = open.includes(it.value);
        return (
          <div key={it.value} className="border-b border-border-light">
            <button
              type="button"
              onClick={() => toggle(it.value)}
              aria-expanded={isOpen}
              className={cn(
                "w-full flex items-center justify-between py-5",
                "text-left text-[13px] font-semibold uppercase tracking-[0.15em] text-foreground-primary",
              )}
            >
              <span>{it.title}</span>
              <motion.span
                aria-hidden
                className="text-[18px] font-light"
                animate={{ rotate: isOpen ? 45 : 0 }}
                transition={{ duration: duration.fast, ease: ease.out }}
              >
                +
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  key="content"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{
                    height: "auto",
                    opacity: 1,
                    transition: { duration: duration.base, ease: ease.out },
                  }}
                  exit={{
                    height: 0,
                    opacity: 0,
                    transition: { duration: duration.fast, ease: ease.out },
                  }}
                  className="overflow-hidden"
                >
                  <div className="pb-5 text-[14px] leading-relaxed text-foreground-secondary">
                    {it.content}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
