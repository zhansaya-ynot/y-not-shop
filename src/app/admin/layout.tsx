import * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth/session";
import { isAdminRole } from "@/server/auth/admin";
import { AdminSignOutButton } from "./_components/sign-out-button";
import { NAV_SECTIONS } from "./_components/nav-sections";
import { AdminShell } from "./_components/admin-shell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/sign-in?next=/admin");
  }
  if (!isAdminRole(user.role)) {
    // Optimistic redirect — middleware can't verify the role from the JWT
    // alone, so the layout is the first server-side place we can check.
    redirect("/sign-in?next=/admin");
  }
  const envName = process.env.NODE_ENV ?? "development";
  // Nested layouts must NOT render <html>/<body> — only the root layout owns
  // those. Returning a div here keeps the root font/style chain intact.
  return (
    <AdminShell>
    <div className="flex min-h-screen bg-neutral-50 text-neutral-900">
      {/* Sticky sidebar that scrolls independently of the main column. With
         all nav sections expanded the user/sign-out block was sliding below
         the fold on shorter laptops; sticky + h-screen keeps it visible. */}
      <aside className="w-60 shrink-0 border-r border-neutral-200 bg-white px-5 py-6 flex flex-col sticky top-0 h-screen overflow-y-auto">
        <div className="mb-8">
          <h1 className="text-lg font-semibold tracking-tight">YNOT Admin</h1>
          <p className="mt-1 text-xs uppercase tracking-wider text-neutral-500">
            env: {envName}
          </p>
        </div>
        <nav className="flex flex-col gap-5 text-sm">
          {NAV_SECTIONS.map((section) => (
            <div key={section.heading}>
              <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
                {section.heading}
              </p>
              <div className="flex flex-col gap-0.5">
                {section.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded px-3 py-1.5 hover:bg-neutral-100"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="mt-auto pt-6 border-t border-neutral-200 text-xs text-neutral-600">
          <div className="mb-2">
            <div className="font-medium text-neutral-900">{user.name ?? user.email}</div>
            <div>{user.role}</div>
          </div>
          <AdminSignOutButton />
        </div>
      </aside>
      <main className="flex-1 px-8 py-8 overflow-x-auto">{children}</main>
    </div>
    </AdminShell>
  );
}
