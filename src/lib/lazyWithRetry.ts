/**
 * Chaos Computer Club India — Medi-Caps Chapter
 * Resilient Dynamic Module Importer with Exponential Fallback & Auto-Refresh
 * Compliant with modern SPA chunk invalidation best practices.
 */

import React from "react";

/**
 * Wraps React.lazy with automated retry and auto-reload on stale chunk hashes.
 * Protects against Vite re-bundling, network drops, and post-deployment chunk 404s.
 */
export function lazyWithRetry<T extends Record<string, any>, K extends keyof T>(
  importer: () => Promise<T>,
  exportName?: K
): React.LazyExoticComponent<React.ComponentType<any>> {
  return React.lazy(async () => {
    const pageKey = exportName ? String(exportName) : "module";
    const sessionKey = `ccc_chunk_reload_${pageKey}`;

    try {
      const module = await importer();
      // Clean up reload guard on successful import
      sessionStorage.removeItem(sessionKey);
      return { default: exportName ? module[exportName] : (module.default || module) };
    } catch (primaryError: any) {
      console.warn(`[CCC] Dynamic import failed for ${pageKey}. Initiating retry...`, primaryError);

      // Short delay before second attempt
      await new Promise((resolve) => setTimeout(resolve, 200));

      try {
        const retryModule = await importer();
        sessionStorage.removeItem(sessionKey);
        return { default: exportName ? retryModule[exportName] : (retryModule.default || retryModule) };
      } catch (retryError: any) {
        // Check if we haven't auto-reloaded in the past 15 seconds
        const lastReload = sessionStorage.getItem(sessionKey);
        const now = Date.now();

        if (!lastReload || now - parseInt(lastReload, 10) > 15000) {
          sessionStorage.setItem(sessionKey, String(now));
          console.error(`[CCC] Chunk stale or missing for ${pageKey}. Reloading application window...`);
          window.location.reload();
          // Return a placeholder promise while page reloads
          return new Promise(() => {});
        }

        throw retryError;
      }
    }
  });
}
