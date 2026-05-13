"use client";

import * as React from "react";
import { Section } from "@/components/ui/section";
import { Container } from "@/components/ui/container";
import { Display } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";

/**
 * 'Stay in the loop' email-capture block on the homepage. Renders on every
 * breakpoint.
 *
 * Posts to /api/newsletter/subscribe and shows a quiet confirmation in
 * place of the form on success. No toast: the surrounding section is
 * already centred copy, the inline state is the right amount of feedback.
 */
export function NewsletterSignup() {
  const [email, setEmail] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setPending(true);
    setError(null);
    try {
      const r = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!r.ok) {
        setError("Couldn’t subscribe — try again in a moment.");
        return;
      }
      setDone(true);
    } catch {
      setError("Couldn’t subscribe — check your connection and retry.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Section background="cream" padding="lg">
      <Container size="narrow">
        <div className="text-center text-foreground-on-cream">
          <Display level="md" as="h2" className="mb-4">
            Stay in the loop
          </Display>
          <p className="text-[14px] text-foreground-on-cream/70 mb-8 max-w-[420px] mx-auto">
            New drops, restocks, and the occasional London editorial — direct
            to your inbox.
          </p>
          {done ? (
            <p className="text-[13px] uppercase tracking-[0.2em]">Thanks — you’re on the list.</p>
          ) : (
            <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-3 max-w-[460px] mx-auto">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className="flex-1 bg-transparent border-b border-foreground-on-cream/40 px-1 py-2 text-[14px] focus:outline-none focus:border-foreground-on-cream"
              />
              <Button type="submit" disabled={pending} variant="primary" size="md">
                {pending ? "…" : "Subscribe"}
              </Button>
            </form>
          )}
          {error && (
            <p className="mt-4 text-[12px] text-error">{error}</p>
          )}
        </div>
      </Container>
    </Section>
  );
}
