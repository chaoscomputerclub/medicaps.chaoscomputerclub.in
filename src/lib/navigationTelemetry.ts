/**
 * Chaos Computer Club India — Zero-Lag Navigation Performance Telemetry
 * Provides high-precision measurement of SPA route transitions, SWR cache hydration,
 * and perceived render latencies using standard Performance API marks & measures.
 */

export interface NavigationMetric {
  id: string;
  fromPath: string;
  toPath: string;
  startTime: number;
  urlChangedTime?: number;
  mountTime?: number;
  contentReadyTime?: number;
  clickToUrlMs?: number;
  clickToMountMs?: number;
  clickToContentMs?: number;
  cacheStatus: "hit" | "stale" | "miss" | "unknown";
  timestamp: string;
}

declare global {
  interface Window {
    __CCC_NAV_METRICS__?: NavigationMetric[];
  }
}

let activeMetric: NavigationMetric | null = null;

export function markNavigationClick(toPath: string): void {
  if (typeof window === "undefined") return;

  const fromPath = window.location.pathname;
  const now = performance.now();
  const id = `nav_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  activeMetric = {
    id,
    fromPath,
    toPath,
    startTime: now,
    cacheStatus: "unknown",
    timestamp: new Date().toISOString(),
  };

  try {
    performance.mark(`ccc:nav:start:${toPath}`);
  } catch {
    // Ignore marker errors
  }
}

export function markNavigationMount(
  toPath: string,
  cacheStatus: "hit" | "stale" | "miss" | "unknown" = "unknown"
): void {
  if (typeof window === "undefined" || !activeMetric) return;

  const now = performance.now();
  activeMetric.mountTime = now;
  activeMetric.urlChangedTime = now;
  activeMetric.cacheStatus = cacheStatus;
  activeMetric.clickToUrlMs = Math.round((now - activeMetric.startTime) * 10) / 10;
  activeMetric.clickToMountMs = Math.round((now - activeMetric.startTime) * 10) / 10;

  try {
    performance.mark(`ccc:nav:mount:${toPath}`);
  } catch {
    // Ignore marker errors
  }
}

export function markNavigationContentReady(toPath: string): void {
  if (typeof window === "undefined" || !activeMetric) return;

  const now = performance.now();
  activeMetric.contentReadyTime = now;
  activeMetric.clickToContentMs = Math.round((now - activeMetric.startTime) * 10) / 10;

  try {
    performance.mark(`ccc:nav:ready:${toPath}`);
    performance.measure(
      `ccc:nav:${activeMetric.fromPath}->${activeMetric.toPath}`,
      `ccc:nav:start:${activeMetric.toPath}`,
      `ccc:nav:ready:${activeMetric.toPath}`
    );
  } catch {
    // Ignore marker errors
  }

  // Record into circular buffer on window for QA audits & automated tests
  if (!window.__CCC_NAV_METRICS__) {
    window.__CCC_NAV_METRICS__ = [];
  }
  window.__CCC_NAV_METRICS__.push({ ...activeMetric });
  if (window.__CCC_NAV_METRICS__.length > 50) {
    window.__CCC_NAV_METRICS__.shift();
  }

  if (import.meta.env.DEV) {
    const statusBadge =
      activeMetric.cacheStatus === "hit"
        ? "[CACHE HIT: 0ms blocking]"
        : activeMetric.cacheStatus === "stale"
        ? "[STALE CACHE: bg-revalidating]"
        : "[CACHE MISS: network fetched]";
    console.info(
      `%c⚡ [NAV] ${activeMetric.fromPath} → ${activeMetric.toPath} in ${activeMetric.clickToContentMs}ms ${statusBadge}`,
      "color: #a3e635; font-weight: bold;"
    );
  }

  activeMetric = null;
}
