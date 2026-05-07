import * as React from "react";
import Link from "next/link";
import { prisma } from "@/server/db/client";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams?: Promise<{ status?: string }>;
}

const TABS = [
  { key: "new", label: "New", filter: "NEW" as const },
  { key: "read", label: "Read", filter: "READ" as const },
  { key: "replied", label: "Replied", filter: "REPLIED" as const },
  { key: "all", label: "All", filter: null },
] as const;

export default async function AdminMessagesPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const tabKey = TABS.find((t) => t.key === params.status)?.key ?? "new";
  const filter = TABS.find((t) => t.key === tabKey)?.filter ?? null;

  const where = filter ? { status: filter } : {};
  const [messages, counts] = await Promise.all([
    prisma.contactMessage.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.contactMessage.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ]);
  const countByStatus = new Map(counts.map((c) => [c.status, c._count._all]));

  return (
    <div className="max-w-5xl">
      <h2 className="text-2xl font-semibold mb-2">Inbox</h2>
      <p className="text-sm text-neutral-700 mb-6">
        Customer enquiries from the public /contact form. Open a message to
        reply by email and mark it as read.
      </p>

      <div className="flex gap-1 mb-4 border-b border-neutral-200">
        {TABS.map((tab) => {
          const count = tab.filter ? (countByStatus.get(tab.filter) ?? 0) : null;
          const href = tab.key === "new" ? "/admin/messages" : `/admin/messages?status=${tab.key}`;
          const active = tabKey === tab.key;
          return (
            <Link
              key={tab.key}
              href={href}
              className={
                "px-4 py-2 text-xs uppercase tracking-wider border-b-2 -mb-px " +
                (active
                  ? "border-foreground-primary text-foreground-primary font-semibold"
                  : "border-transparent text-neutral-500 hover:text-neutral-800")
              }
            >
              {tab.label}
              {count !== null && count > 0 && (
                <span className="ml-2 text-[11px] text-neutral-400">{count}</span>
              )}
            </Link>
          );
        })}
      </div>

      <div className="bg-white rounded-md border border-neutral-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-600 text-xs uppercase">
            <tr>
              <th className="text-left px-3 py-2 w-24">Status</th>
              <th className="text-left px-3 py-2">From</th>
              <th className="text-left px-3 py-2">Subject</th>
              <th className="text-left px-3 py-2 w-40">Received</th>
            </tr>
          </thead>
          <tbody>
            {messages.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-neutral-500">
                  No messages in this view.
                </td>
              </tr>
            )}
            {messages.map((m) => (
              <tr key={m.id} className="border-t border-neutral-100 hover:bg-neutral-50">
                <td className="px-3 py-3">
                  <span
                    className={
                      "inline-block px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded " +
                      (m.status === "NEW"
                        ? "bg-amber-100 text-amber-900"
                        : m.status === "REPLIED"
                          ? "bg-emerald-100 text-emerald-900"
                          : "bg-neutral-100 text-neutral-700")
                    }
                  >
                    {m.status.toLowerCase()}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <Link href={`/admin/messages/${m.id}`} className="font-medium underline">
                    {m.name}
                  </Link>
                  <div className="text-[12px] text-neutral-500">{m.email}</div>
                </td>
                <td className="px-3 py-3 max-w-md">
                  <span className="line-clamp-1">{m.subject || "(no subject)"}</span>
                </td>
                <td className="px-3 py-3 text-xs text-neutral-600">
                  {new Date(m.createdAt).toISOString().slice(0, 16).replace("T", " ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
