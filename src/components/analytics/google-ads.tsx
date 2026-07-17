'use client';

import Script from 'next/script';
import * as React from 'react';

// Google Ads account tag + Purchase conversion, created in account
// 239-786-8268 (Y Not Fashion). Env-overridable so a future account move
// (e.g. to Ynot Fashion Limited once its billing is set up) is a config
// change, not a code change.
const ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID || 'AW-11422329422';
const PURCHASE_LABEL =
  process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL || 'xJxLCL3kidIcEM7Uy8Yq';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/** Site-wide Google tag (gtag.js) — required before any conversion event. */
export function GoogleAdsTag(): React.ReactElement | null {
  if (!ADS_ID) return null;
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${ADS_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-ads-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
gtag('js', new Date());
// Consent Mode v2: deny ad/analytics storage until the visitor accepts
// cookies (see ConsentBridge). Google still does cookieless conversion
// modelling while denied; granted state is set on Accept.
gtag('consent', 'default', {
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  analytics_storage: 'denied',
  wait_for_update: 500,
});
gtag('config', '${ADS_ID}');`}
      </Script>
    </>
  );
}

/**
 * Report a paid order to Google Ads. `transaction_id` = order number, which
 * Google uses to deduplicate — a customer refreshing the success page won't
 * double-count the sale.
 */
export function reportPurchaseConversion(p: {
  valueCents: number;
  orderNumber: string;
}): void {
  window.gtag?.('event', 'conversion', {
    send_to: `${ADS_ID}/${PURCHASE_LABEL}`,
    value: p.valueCents / 100,
    currency: 'GBP',
    transaction_id: p.orderNumber,
  });
}
