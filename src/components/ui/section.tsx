import * as React from "react";
import { cn } from "@/lib/cn";

type SectionPadding = "none" | "sm" | "md" | "lg";
type SectionBackground = "white" | "cream" | "dark";

// Mobile values are deliberately tighter than desktop — 64px+ vertical
// padding stacks into large dead gaps on a phone (the catalogue page
// chains three Sections). Desktop (`md:`) values are unchanged.
const padding: Record<SectionPadding, string> = {
  none: "py-0",
  sm: "py-6 md:py-12",
  md: "py-8 md:py-20",
  lg: "py-14 md:py-32",
};

const background: Record<SectionBackground, string> = {
  white: "bg-surface-primary text-foreground-primary",
  cream: "bg-surface-secondary text-foreground-on-cream",
  dark: "bg-surface-dark text-foreground-inverse",
};

export interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  padding?: SectionPadding;
  background?: SectionBackground;
}

export function Section({
  className,
  padding: p = "md",
  background: b = "white",
  ...props
}: SectionProps) {
  return (
    <section
      className={cn("w-full block", padding[p], background[b], className)}
      {...props}
    />
  );
}
