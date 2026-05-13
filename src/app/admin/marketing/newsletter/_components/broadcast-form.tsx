'use client';

import * as React from 'react';

interface Props {
  activeCount: number;
}

interface BroadcastResult {
  total: number;
  sent: number;
  failed: number;
  failures: Array<{ email: string; error: string }>;
}

export function BroadcastForm({ activeCount }: Props): React.ReactElement {
  const [subject, setSubject] = React.useState('');
  const [body, setBody] = React.useState('');
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<BroadcastResult | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (activeCount === 0) {
      setError('No active subscribers — nothing to send.');
      return;
    }
    const confirmed = confirm(
      `Send to ${activeCount} active subscriber${activeCount === 1 ? '' : 's'} now?`,
    );
    if (!confirmed) return;
    startTransition(async () => {
      const res = await fetch('/api/admin/marketing/newsletter/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, body }),
      });
      if (!res.ok) {
        setError(`Send failed (${res.status})`);
        return;
      }
      const data: BroadcastResult = await res.json();
      setResult(data);
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 max-w-2xl">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs uppercase tracking-wider text-neutral-600">Subject</span>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
          maxLength={200}
          placeholder="New drops at YNOT London"
          className="border border-neutral-300 rounded px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs uppercase tracking-wider text-neutral-600">Body</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
          rows={12}
          maxLength={20000}
          placeholder="Hi there,&#10;&#10;We've just released our autumn collection..."
          className="border border-neutral-300 rounded px-3 py-2 font-mono text-xs"
        />
        <span className="text-xs text-neutral-500">
          Plain text. Two newlines start a new paragraph. Unsubscribe link added automatically.
        </span>
      </label>

      {error && <p className="text-sm text-red-700">{error}</p>}

      {result && (
        <div className="border border-neutral-200 rounded p-4 bg-neutral-50 text-sm">
          <div className="font-semibold mb-2">Send complete</div>
          <div>Sent: {result.sent} / {result.total}</div>
          {result.failed > 0 && (
            <>
              <div className="text-red-700">Failed: {result.failed}</div>
              <ul className="mt-2 text-xs text-red-700">
                {result.failures.slice(0, 10).map((f) => (
                  <li key={f.email}>{f.email}: {f.error}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      <div>
        <button
          type="submit"
          disabled={pending || activeCount === 0}
          className="px-4 py-2 bg-neutral-900 text-white text-xs uppercase tracking-wider rounded disabled:opacity-50"
        >
          {pending ? `Sending… (this can take a while)` : `Send to ${activeCount} subscribers`}
        </button>
      </div>
    </form>
  );
}
