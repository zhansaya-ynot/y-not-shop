import * as React from 'react';
import { prisma } from '@/server/db/client';
import { BroadcastForm } from './_components/broadcast-form';

export const dynamic = 'force-dynamic';

export default async function AdminNewsletterPage(): Promise<React.ReactElement> {
  const [activeCount, totalCount, recent] = await Promise.all([
    prisma.newsletterSubscriber.count({ where: { isActive: true } }),
    prisma.newsletterSubscriber.count(),
    prisma.newsletterSubscriber.findMany({
      orderBy: { subscribedAt: 'desc' },
      take: 50,
      select: {
        email: true,
        source: true,
        isActive: true,
        subscribedAt: true,
      },
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold mb-2">Newsletter</h2>
        <p className="text-sm text-neutral-600">
          Subscribers from the &ldquo;Stay in the loop&rdquo; homepage form.
          Compose and send a broadcast through Resend, or export the list
          for an external tool.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 max-w-md">
        <div className="border border-neutral-200 rounded p-4">
          <div className="text-xs uppercase tracking-wider text-neutral-500">Active</div>
          <div className="text-3xl font-semibold mt-1">{activeCount}</div>
        </div>
        <div className="border border-neutral-200 rounded p-4">
          <div className="text-xs uppercase tracking-wider text-neutral-500">Total ever</div>
          <div className="text-3xl font-semibold mt-1">{totalCount}</div>
        </div>
      </div>

      <div>
        <a
          href="/api/admin/marketing/newsletter/export"
          className="inline-block px-4 py-2 border border-neutral-300 rounded text-xs uppercase tracking-wider hover:bg-neutral-50"
        >
          Export CSV
        </a>
      </div>

      <div className="border-t border-neutral-200 pt-8">
        <h3 className="text-lg font-semibold mb-2">Compose broadcast</h3>
        <p className="text-sm text-neutral-600 mb-4">
          Sends one email per active subscriber via Resend. Each email
          includes a personal unsubscribe link in the footer.
        </p>
        <BroadcastForm activeCount={activeCount} />
      </div>

      <div className="border-t border-neutral-200 pt-8">
        <h3 className="text-lg font-semibold mb-3">Recent subscribers</h3>
        <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-600 text-xs uppercase">
              <tr>
                <th className="text-left px-3 py-2">Email</th>
                <th className="text-left px-3 py-2 w-24">Source</th>
                <th className="text-left px-3 py-2 w-24">Status</th>
                <th className="text-left px-3 py-2 w-40">Subscribed</th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-neutral-500">
                    No subscribers yet.
                  </td>
                </tr>
              )}
              {recent.map((s) => (
                <tr key={s.email} className="border-t border-neutral-100">
                  <td className="px-3 py-2 font-mono text-xs">{s.email}</td>
                  <td className="px-3 py-2 text-xs">{s.source}</td>
                  <td className="px-3 py-2 text-xs">
                    {s.isActive ? (
                      <span className="inline-block px-2 py-0.5 rounded bg-green-100 text-green-800 border border-green-200">
                        Active
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 rounded bg-neutral-100 text-neutral-600 border border-neutral-200">
                        Unsubbed
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-neutral-600">
                    {s.subscribedAt.toISOString().slice(0, 16).replace('T', ' ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
