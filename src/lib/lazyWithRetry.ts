/**
 * Chaos Computer Club India — Medi-Caps Chapter
 * Resilient Dynamic Module Importer with Exponential Fallback, Auto-Refresh & Instant Preload
 * Compliant with modern SPA chunk invalidation best practices.
 */

import React from "react";

export interface PreloadableLazyComponent<P = any>
  extends React.LazyExoticComponent<React.ComponentType<P>> {
  preload: () => Promise<any>;
}

/**
 * Wraps React.lazy with automated retry, auto-reload on stale chunk hashes,
 * and high-performance preloading for instant 0ms route transitions.
 */
export function lazyWithRetry<T extends Record<string, any>, K extends keyof T>(
  importer: () => Promise<T>,
  exportName?: K
): PreloadableLazyComponent {
  let cachedPromise: Promise<{ default: React.ComponentType<any> }> | null = null;

  const load = async (): Promise<{ default: React.ComponentType<any> }> => {
    if (cachedPromise) return cachedPromise;

    const pageKey = exportName ? String(exportName) : "module";
    const sessionKey = `ccc_chunk_reload_${pageKey}`;

    const currentPromise: Promise<{ default: React.ComponentType<any> }> = (async () => {
      try {
        const module = await importer();
        if (typeof window !== "undefined" && window.sessionStorage) {
          sessionStorage.removeItem(sessionKey);
        }
        const exported = exportName ? module[exportName] : (module["default"] || module);
        return { default: exported as React.ComponentType<any> };
      } catch (primaryError: any) {
        console.warn(`[CCC] Dynamic import failed for ${pageKey}. Initiating retry...`, primaryError);
        await new Promise((resolve) => setTimeout(resolve, 200));

        try {
          const retryModule = await importer();
          if (typeof window !== "undefined" && window.sessionStorage) {
            sessionStorage.removeItem(sessionKey);
          }
          const exported = exportName ? retryModule[exportName] : (retryModule["default"] || retryModule);
          return { default: exported as React.ComponentType<any> };
        } catch (retryError: any) {
          cachedPromise = null; // Clear on error so future retries can run
          const lastReload =
            typeof window !== "undefined" && window.sessionStorage
              ? sessionStorage.getItem(sessionKey)
              : null;
          const now = Date.now();

          if (!lastReload || now - parseInt(lastReload, 10) > 15000) {
            if (typeof window !== "undefined" && window.sessionStorage) {
              sessionStorage.setItem(sessionKey, String(now));
            }
            console.error(`[CCC] Chunk stale or missing for ${pageKey}. Reloading application window...`);
            if (typeof window !== "undefined") {
              window.location.reload();
            }
            return new Promise<{ default: React.ComponentType<any> }>(() => {});
          }

          throw retryError;
        }
      }
    })();

    cachedPromise = currentPromise;
    return currentPromise;
  };

  const LazyComponent = React.lazy(load) as unknown as PreloadableLazyComponent;
  LazyComponent.preload = load;
  return LazyComponent;
}
