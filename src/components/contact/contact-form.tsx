"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

/**
 * Contact form on /contact. Posts to /api/contact which writes a row to
 * ContactMessage; the operator triages the queue from /admin/messages.
 *
 * Inline confirmation replaces the form on success — no toast, the page
 * is a quiet narrative surface and a popup would feel out of place.
 */
export function ContactForm() {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || message.trim().length < 5) {
      setError("Please fill in your name, email, and a short message.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const r = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          subject: subject.trim(),
          message: message.trim(),
        }),
      });
      if (!r.ok) {
        const json = (await r.json().catch(() => ({}))) as { error?: string };
        setError(
          json.error === "INVALID_BODY"
            ? "Some fields look wrong — please check and resubmit."
            : "Couldn’t send right now. Try again in a moment.",
        );
        return;
      }
      setDone(true);
    } catch {
      setError("Couldn’t send — check your connection and retry.");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col gap-3 p-6 border border-border-light bg-surface-secondary text-[14px]">
        <p className="font-semibold">Thanks — message received.</p>
        <p className="text-foreground-secondary">
          We’ll reply to <strong>{email}</strong> within 24 hours, Monday to Friday.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="grid gap-5 md:grid-cols-2">
        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoComplete="name"
        />
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
      </div>
      <Input
        label="Subject"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="What’s this about?"
      />
      <Textarea
        label="Message"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={6}
        required
      />
      {error && <p className="text-[13px] text-error">{error}</p>}
      <Button type="submit" disabled={pending} size="lg">
        {pending ? "Sending…" : "Send message"}
      </Button>
    </form>
  );
}
