import 'dotenv/config';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import cron from 'node-cron';
import { env } from '@/server/env';
import { buildDeps } from '@/server/fulfilment/deps';
import { recoverPendingPayments } from './jobs/recover-pending-payment';
import { cleanupExpiredCarts } from './jobs/cleanup-expired-carts';
import { syncTracking } from './jobs/sync-tracking';
import { processEmailJobs } from './jobs/process-email-jobs';
import { retryFailedShipments } from './jobs/retry-failed-shipments';
import { enqueueAbandonedCart } from './jobs/enqueue-abandoned-cart';

const execp = promisify(exec);

if (!env.WORKER_ENABLED) {
  process.stderr.write('[ynot-worker] WORKER_ENABLED=false; exiting.\n');
  process.exit(0);
}

const deps = buildDeps(env);

interface JobSpec {
  name: string;
  cron: string;
  run: () => Promise<unknown>;
}

const JOBS: JobSpec[] = [
  {
    name: 'recover-pending-payment',
    cron: '*/5 * * * *',
    run: () => recoverPendingPayments(),
  },
  {
    name: 'cleanup-expired-carts',
    cron: '0 * * * *',
    run: () => cleanupExpiredCarts(),
  },
  {
    name: 'sync-tracking',
    cron: '0 * * * *',
    run: () =>
      syncTracking({
        providers: deps.providers,
        sendTrackingStaleAlert: deps.sendTrackingStaleAlert,
      }),
  },
  {
    name: 'process-email-jobs',
    cron: '*/5 * * * *',
    run: () => processEmailJobs(),
  },
  {
    name: 'retry-failed-shipments',
    cron: '*/5 * * * *',
    run: () =>
      retryFailedShipments({
        dhl: deps.dhl,
        rm: deps.rm,
        storage: deps.storage,
        sendLabelFailureAlert: deps.sendLabelFailureAlert,
      }),
  },
  {
    name: 'enqueue-abandoned-cart',
    cron: '*/5 * * * *',
    run: () => enqueueAbandonedCart(),
  },
];

for (const job of JOBS) {
  cron.schedule(job.cron, async () => {
    const started = Date.now();
    process.stderr.write(`[ynot-worker] tick ${job.name}\n`);
    try {
      const result = await job.run();
      process.stderr.write(
        `[ynot-worker] done ${job.name} (${Date.now() - started}ms): ${
          result ? JSON.stringify(result) : 'ok'
        }\n`,
      );
    } catch (err) {
      process.stderr.write(
        `[ynot-worker] error ${job.name}: ${
          err instanceof Error ? err.stack ?? err.message : String(err)
        }\n`,
      );
    }
  });
  process.stderr.write(`[ynot-worker] scheduled ${job.name} (${job.cron})\n`);
}

process.stderr.write('[ynot-worker] all jobs scheduled\n');

// Phase 8 — daily backups (only run in production)
if (process.env.NODE_ENV === 'production') {
  cron.schedule('0 3 * * *', async () => {
    try {
      const { stdout, stderr } = await execp('/app/scripts/prod-backup-postgres.sh');
      if (stdout) console.log(stdout);
      if (stderr) console.error(stderr);
    } catch (e) {
      console.error('[worker] postgres backup failed:', e);
    }
  });

  cron.schedule('30 3 * * *', async () => {
    try {
      const { stdout, stderr } = await execp('/app/scripts/prod-backup-media.sh');
      if (stdout) console.log(stdout);
      if (stderr) console.error(stderr);
    } catch (e) {
      console.error('[worker] media backup failed:', e);
    }
  });

  console.log(
    '[ynot-worker] backup schedules registered (postgres 03:00 UTC, media 03:30 UTC)',
  );
}

// Keep process alive so Docker keeps the container running.
setInterval(() => {}, 1 << 30);
