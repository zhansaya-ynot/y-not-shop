import * as React from "react";
import { cache } from "react";
import { WhatsAppIcon } from "./icons";
import { cn } from "@/lib/cn";
import { prisma } from "@/server/db/client";

export interface WhatsAppWidgetProps {
  phone: string;
  message?: string;
  className?: string;
}

/**
 * Sync presentational widget. Client-component pages (ui-kit,
 * initiate-return) render this directly with bundled fallback values
 * so they don't pull an async server component into a client tree.
 * Server pages should use the default `WhatsAppWidget` below, which
 * fetches live phone + message from SitePolicy.
 */
export function WhatsAppWidgetStatic({
  phone,
  message,
  className,
}: WhatsAppWidgetProps) {
  // Empty phone = hide the widget entirely. Operators clear the
  // SitePolicy.whatsappNumber field when they want to disable the
  // floating chat button site-wide.
  if (!phone || !phone.trim()) return null;
  const href = `https://wa.me/${phone.replace(/[^0-9]/g, "")}${
    message ? `?text=${encodeURIComponent(message)}` : ""
  }`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      className={cn(
        "fixed bottom-6 right-6 z-40",
        "h-14 w-14 rounded-full bg-[#25D366] text-white",
        "flex items-center justify-center shadow-lg",
        "hover:scale-105 transition-transform",
        className,
      )}
    >
      <WhatsAppIcon />
    </a>
  );
}

const getWhatsAppContent = cache(async () => {
  const policy = await prisma.sitePolicy.findUnique({
    where: { id: "singleton" },
    select: { whatsappNumber: true, whatsappMessage: true },
  });
  return {
    phone: policy?.whatsappNumber ?? "",
    message: policy?.whatsappMessage ?? "Hi YNOT, I have a question.",
  };
});

/**
 * Async widget used by server-component pages. Reads phone + message
 * from SitePolicy so admin edits at /admin/content/settings propagate
 * across the entire site on the next request.
 */
export async function WhatsAppWidget({ className }: { className?: string }) {
  const { phone, message } = await getWhatsAppContent();
  return <WhatsAppWidgetStatic phone={phone} message={message} className={className} />;
}
