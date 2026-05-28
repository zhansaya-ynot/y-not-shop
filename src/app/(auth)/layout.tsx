import * as React from "react";
import { AnnouncementBarServer } from "@/components/announcement-bar-server";
import { SiteHeader } from "@/components/site-header";

export const metadata = {
  title: "Account · YNOT London",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <AnnouncementBarServer />
      <SiteHeader />
      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  );
}
