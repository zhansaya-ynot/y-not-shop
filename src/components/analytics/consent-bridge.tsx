'use client';

import * as React from 'react';
import { useCookieConsentStore } from '@/lib/stores/cookie-consent-store';

/**
 * Bridges the cookie banner to the ad platforms' consent APIs.
 *
 * The Google tag boots with Consent Mode v2 defaults = denied and the Meta
 * pixel boots with consent revoked (see google-ads.tsx / meta-pixel.tsx). This
 * component watches the persisted consent status and:
 *  - "accepted"  → grant ad/analytics storage (Google) + grant pixel (Meta),
 *                  which flushes the queued PageView.
 *  - "declined"  → keep everything denied/revoked.
 *  - "pending"   → leave the boot defaults untouched.
 *
 * Returning visitors who already accepted get granted on mount, so their
 * PageView isn't delayed. Renders nothing.
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
      window.fbq?.('consent', 'grant');
    } else if (status === 'declined') {
      window.gtag?.('consent', 'update', {
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
        analytics_storage: 'denied',
      });
      window.fbq?.('consent', 'revoke');
    }
    // "pending": leave the denied/revoked boot defaults in place.
  }, [status]);

  return null;
}
