'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';
import * as React from 'react';

// Meta Pixel ID. Defaults to the YNOT London pixel from Meta Events Manager;
// overridable via NEXT_PUBLIC_META_PIXEL_ID (inlined at build time) so the same
// build can point at a different pixel without a code change.
const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || '1669136137533422';

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

/**
 * Installs the Meta (Facebook) Pixel base code and tracks SPA navigations.
 *
 * The base snippet fires one `PageView` when it loads. Next.js client-side
 * route changes don't reload the page, so we fire an additional `PageView` on
 * each pathname change — skipping the very first render to avoid double-counting
 * the initial load.
 */
export function MetaPixel(): React.ReactElement | null {
  const pathname = usePathname();
  const isFirstRender = React.useRef(true);

  React.useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    window.fbq?.('track', 'PageView');
  }, [pathname]);

  if (!PIXEL_ID) return null;

  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">
        {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${PIXEL_ID}');
fbq('track', 'PageView');`}
      </Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: 'none' }}
          src={`https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  );
}
