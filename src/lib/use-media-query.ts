"use client";

import * as React from "react";

/**
 * Subscribe to a CSS media query from React.
 *
 * Exists for the cases CSS alone can't cover — picking a `<video>` source,
 * say, where browsers ignore the `media` attribute on `<source>`. Prefer
 * plain Tailwind breakpoints for anything that is purely visual; this hook
 * costs a hydration pass and can only answer after mount.
 *
 * During SSR (and the first client render) it reports `serverValue`, so the
 * markup both sides produce agrees. Callers pass the value that matches
 * their mobile-first or desktop-first default.
 */
export function useMediaQuery(query: string, serverValue = false): boolean {
  const subscribe = React.useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query],
  );

  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}
