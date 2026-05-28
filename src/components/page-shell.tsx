import * as React from "react";
import { AnnouncementBarServer } from "./announcement-bar-server";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";

export interface PageShellProps {
  children: React.ReactNode;
  /** When true, header starts transparent over a hero. */
  overHero?: boolean;
  /** Hides AnnouncementBar (e.g. checkout flow). */
  hideAnnouncement?: boolean;
  /** Hides SiteFooter (rare). */
  hideFooter?: boolean;
  /** Hides full SiteHeader and replaces with a minimal one (passed in). */
  header?: React.ReactNode;
}

export function PageShell({
  children,
  overHero,
  hideAnnouncement,
  hideFooter,
  header,
}: PageShellProps) {
  return (
    <>
      {!hideAnnouncement && <AnnouncementBarServer />}
      {header ?? <SiteHeader overHero={overHero} />}
      <main className="flex-1">{children}</main>
      {!hideFooter && <SiteFooter />}
    </>
  );
}
