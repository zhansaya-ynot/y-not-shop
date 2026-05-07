"use client";

import * as React from "react";
import { ToastProvider } from "@/components/ui/toast";

/**
 * Client wrapper that mounts ToastProvider over every admin page so
 * forms / action buttons can call useToast().show() to surface
 * "Saved." / "Refunded." / "Cancelled." confirmations site-wide
 * without each page registering its own provider.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
