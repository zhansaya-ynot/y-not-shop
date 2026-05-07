"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";

interface Props {
  id: string;
  status: "NEW" | "READ" | "REPLIED";
  mailto: string;
}

/**
 * Inline action panel on /admin/messages/[id]: open the customer's email
 * client (mailto:), then mark the message as read or replied via the
 * /api/admin/messages/[id] PATCH endpoint, or delete the row entirely.
 *
 * 'Mark as replied' is a hint, not a guarantee — we trust the operator to
 * actually send the reply via their own email client; this just records
 * the disposition so the inbox tab counts stay useful.
 */
export function MessageActions({ id, status, mailto }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = React.useState<"read" | "replied" | "delete" | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  async function patch(next: "READ" | "REPLIED") {
    setBusy(next === "READ" ? "read" : "replied");
    const r = await fetch(`/api/admin/messages/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setBusy(null);
    if (!r.ok) {
      toast.show("Couldn’t update — try again.");
      return;
    }
    toast.show(next === "READ" ? "Marked as read." : "Marked as replied.");
    router.refresh();
  }

  async function destroy() {
    setBusy("delete");
    const r = await fetch(`/api/admin/messages/${id}`, { method: "DELETE" });
    setBusy(null);
    if (!r.ok) {
      toast.show("Couldn’t delete — try again.");
      return;
    }
    toast.show("Message deleted.");
    router.push("/admin/messages");
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <a href={mailto}>
          <Button variant="primary" size="md">
            Reply by email
          </Button>
        </a>
        {status === "NEW" && (
          <Button
            variant="outline"
            size="md"
            disabled={busy !== null}
            onClick={() => patch("READ")}
          >
            {busy === "read" ? "…" : "Mark as read"}
          </Button>
        )}
        {status !== "REPLIED" && (
          <Button
            variant="outline"
            size="md"
            disabled={busy !== null}
            onClick={() => patch("REPLIED")}
          >
            {busy === "replied" ? "…" : "Mark as replied"}
          </Button>
        )}
        <Button
          variant="ghost"
          size="md"
          disabled={busy !== null}
          onClick={() => setConfirmDelete(true)}
        >
          Delete
        </Button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={destroy}
        title="Delete this message?"
        description="The message and the customer's contact info are removed permanently. This action can't be undone."
        confirmLabel="Delete"
        destructive
      />
    </>
  );
}
