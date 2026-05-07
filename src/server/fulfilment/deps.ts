import type { Env } from '@/server/env';
import { DhlExpressProvider } from '@/server/shipping/dhl-express';
import { RoyalMailClickDropProvider } from '@/server/shipping/royal-mail-click-drop';
import { DhlTrackingProvider } from '@/server/tracking/dhl';
import { RoyalMailTrackingProvider } from '@/server/tracking/royal-mail';
import type { TrackingProviders } from '@/server/tracking/service';
import type { LabelStorage } from './label-storage';
import { getLabelStorage } from './storage-factory';
import {
  sendLabelFailureAlert,
  sendTrackingStaleAlert,
} from '@/server/alerts/service';
import {
  tryCreateShipment,
  type TryCreateShipmentDeps,
  type TryCreateShipmentResult,
} from './service';

/**
 * Production wiring for the worker container. One factory call up-front so
 * each cron tick reuses the same provider singletons (HTTP keep-alive,
 * fewer auth handshakes).
 *
 * Carrier credentials are optional in {@link Env} — the providers will throw
 * at first use if a real call goes through unconfigured. The worker stays
 * launchable in dev with no carrier keys so cron jobs that don't need them
 * (cleanup, recover-pending-payment, process-email-jobs, abandoned-cart)
 * keep ticking.
 */
export interface WorkerDeps {
  /** Carrier providers used by `tryCreateShipment`. */
  dhl: DhlExpressProvider;
  rm: RoyalMailClickDropProvider;
  /** PDF label persistence for whichever backend env selects. */
  storage: LabelStorage;
  /** Tracking providers keyed by carrier — feeds `syncTracking`. */
  providers: TrackingProviders;
  /** Operator-alert callbacks injected into the same call sites. */
  sendLabelFailureAlert: (
    shipment: import('@prisma/client').Shipment,
  ) => Promise<void>;
  sendTrackingStaleAlert: (
    affectedCount: number,
    oldestStaleSinceHours: number,
  ) => Promise<void>;
  /** Convenience handle for `retry-failed-shipments`. */
  tryCreateShipment: (
    shipmentId: string,
    overrides?: Partial<TryCreateShipmentDeps>,
  ) => Promise<TryCreateShipmentResult>;
}

export function buildDeps(env: Env): WorkerDeps {
  const dhl = new DhlExpressProvider({
    apiKey: env.DHL_API_KEY ?? '',
    apiSecret: env.DHL_API_SECRET ?? '',
    accountNumber: env.DHL_ACCOUNT_NUMBER ?? '',
    baseUrl: env.DHL_API_ENV ?? 'prod',
  });
  const rm = new RoyalMailClickDropProvider({
    apiKey: env.ROYAL_MAIL_API_KEY ?? '',
    serviceCode: env.ROYAL_MAIL_SERVICE_CODE,
    returnsServiceCode: env.ROYAL_MAIL_RETURNS_SERVICE_CODE,
  });
  const storage = getLabelStorage(env);

  const providers: TrackingProviders = {
    dhl: new DhlTrackingProvider({ apiKey: env.DHL_API_KEY ?? '' }),
    royalMail: new RoyalMailTrackingProvider({ apiKey: env.ROYAL_MAIL_API_KEY ?? '' }),
  };

  const baseTryDeps: TryCreateShipmentDeps = {
    dhl,
    rm,
    storage,
    sendLabelFailureAlert,
  };

  return {
    dhl,
    rm,
    storage,
    providers,
    sendLabelFailureAlert,
    sendTrackingStaleAlert,
    tryCreateShipment: (shipmentId, overrides) =>
      tryCreateShipment(shipmentId, { ...baseTryDeps, ...overrides }),
  };
}
