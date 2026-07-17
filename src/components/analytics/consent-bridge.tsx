'use client';

import * as React from 'react';
import { useCookieConsentStore } from '@/lib/stores/cookie-consent-store';

/**
 * Bridges the cookie banner to the ad platforms' consent APIs.
 *
 * The Google tag boots with Consent Mode v2 defaults = denied (see
 * google-ads.tsx). This component watches the persisted consent status and
 * grants ad/analytics storage on Accept, keeps it denied on Decline, and
 * leaves the denied default while pending.
 *
 * NOTE: the Meta pixel is intentionally NOT gated here. The documented
 * `fbq('consent','revoke')`-before-init pattern broke pixel registration in
 * prod (pixelsByID stayed empty, queue never drained), so the pixel fires on
 * load for now; proper Meta consent gating needs a CMP / different approach.
 * Renders nothing.
 */
export function ConsentBridge(): null {
  const status = React.useSyncExternalStore(
    (cb) => useCookieConsentStore.subscribe(cb),
    () => useCookieConsentStore.getState().status,
    // SSR snapshot — effects don't run on the server, so this value is unused
    // for side effects; matches the CookieBanner's pattern.
    () => 'pending' as const,
  );

  React.useEffect(() => {
    if (status === 'accepted') {
      window.gtag?.('consent', 'update', {
        ad_storage: 'granted',
        ad_user_data: 'granted',
        ad_personalization: 'granted',
        analytics_storage: 'granted',
      });
    } else if (status === 'declined') {
      window.gtag?.('consent', 'update', {
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
        analytics_storage: 'denied',
      });
    }
    // "pending": leave the denied Consent Mode default in place.
  }, [status]);

  return null;
}
