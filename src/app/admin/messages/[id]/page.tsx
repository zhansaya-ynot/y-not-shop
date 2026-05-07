import * as React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/server/db/client";
import { MessageActions } from "./message-actions";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminMessageDetailPage({ params }: PageProps) {
  const { id } = await params;
  const message = await prisma.contactMessage.findUnique({ where: { id } });
  if (!message) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/admin/messages" className="text-xs underline text-neutral-500">
          ← Inbox
        </Link>
        <h2 className="text-2xl font-semibold mt-1">{message.subject || "(no subject)"}</h2>
        <p className="text-sm text-neutral-600">
          From <strong>{message.name}</strong> ·{" "}
          <a href={`mailto:${message.email}`} className="underline">
            {message.email}
          </a>
        </p>
        <p className="text-xs text-neutral-500 mt-1">
          Received {new Date(message.createdAt).toISOString().slice(0, 16).replace("T", " ")}
          {message.readAt && ` · Read ${new Date(message.readAt).toISOString().slice(0, 16).replace("T", " ")}`}
          {message.repliedAt && ` · Replied ${new Date(message.repliedAt).toISOString().slice(0, 16).replace("T", " ")}`}
        </p>
      </div>

      <section className="bg-white border border-neutral-200 rounded-lg p-5">
        <h3 className="font-semibold mb-3 text-sm uppercase tracking-wider text-neutral-500">
          Message
        </h3>
        <p className="whitespace-pre-line text-[15px] leading-relaxed">{message.message}</p>
      </section>

      <section className="bg-white border border-neutral-200 rounded-lg p-5">
        <h3 className="font-semibold mb-3 text-sm uppercase tracking-wider text-neutral-500">
          Actions
        </h3>
        <MessageActions
          id={message.id}
          status={message.status}
          mailto={`mailto:${message.email}?subject=${encodeURIComponent("Re: " + (message.subject || "your message"))}`}
        />
      </section>
    </div>
  );
}
