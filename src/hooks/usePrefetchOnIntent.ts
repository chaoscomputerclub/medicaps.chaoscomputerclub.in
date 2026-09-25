/**
 * usePrefetchOnIntent — Global Delegated Navigation Prefetcher
 *
 * Mounts a single document-level event listener that intercepts mouseenter
 * and touchstart on any <a> element anywhere in the app.
 *
 * When the user's pointer approaches a link (100–300ms before click), this hook
 * simultaneously fires:
 *   1. The lazy JS chunk preload for the target route.
 *   2. The SWR data fetch for that route's page data.
 *
 * By the time the user clicks, both the JS bundle and the API data are already
 * in memory — the page renders synchronously with zero skeleton flicker.
 *
 * Uses event delegation (document.addEventListener with closest()) so it works
 * for all links including dynamically rendered ones without any per-component
 * wiring. swrFetch deduplication ensures concurrent hovers are free (1 request max).
 */

import { useEffect } from "react";
import {
  prefetchRoute,
  prefetchContestRoute,
  prefetchProfileRoute,
} from "@/AppRoutes";

function parsePrefetchIntent(href: string): void {
  let pathname: string;
  try {
    // Support both absolute URLs and relative paths
    const url = new URL(href, window.location.origin);
    // Only prefetch same-origin navigations
    if (url.origin !== window.location.origin) return;
    pathname = url.pathname;
  } catch {
    return;
  }

  // Normalize trailing slashes
  const clean = pathname.replace(/\/+$/, "") || "/";

  // ── Static top-level routes ─────────────────────────────────────────────
  // Dashboard, Contests Hub, Leaderboard, My Contests, Problems, Settings…
  const staticRoutes = ["/", "/contests", "/my-contests", "/leaderboard", "/problems", "/verify", "/profile", "/settings"];
  if (staticRoutes.includes(clean)) {
    prefetchRoute(clean);
    return;
  }

  // ── Dynamic contest routes ───────────────────────────────────────────────
  // /contests/:slug              → overview
  // /contests/:slug/lobby        → lobby
  // /contests/:slug/results      → results
  const contestOverviewMatch = clean.match(/^\/contests\/([^/]+)$/);
  if (contestOverviewMatch) {
    prefetchContestRoute(contestOverviewMatch[1] || "", "overview");
    return;
  }

  const contestLobbyMatch = clean.match(/^\/contests\/([^/]+)\/lobby$/);
  if (contestLobbyMatch) {
    prefetchContestRoute(contestLobbyMatch[1] || "", "lobby");
    return;
  }

  const contestResultsMatch = clean.match(/^\/contests\/([^/]+)\/results$/);
  if (contestResultsMatch) {
    prefetchContestRoute(contestResultsMatch[1] || "", "results");
    return;
  }

  // ── Profile routes ───────────────────────────────────────────────────────
  // /profile/:handle  or  /u/:handle
  const profileMatch = clean.match(/^\/(?:profile|u)\/([^/]+)$/);
  if (profileMatch) {
    prefetchProfileRoute(decodeURIComponent(profileMatch[1] || ""));
    return;
  }

  // ── /profile (own profile) ───────────────────────────────────────────────
  if (clean === "/profile") {
    prefetchRoute("/profile");
    return;
  }
}

/**
 * Mount once at the app root. Uses passive event delegation for zero overhead.
 */
export function usePrefetchOnIntent(): void {
  useEffect(() => {
    let lastHref = "";
    let lastFiredAt = 0;

    function handleIntent(e: MouseEvent | TouchEvent): void {
      const target = e.target as Element | null;
      if (!target) return;

      // Walk up to the nearest anchor
      const anchor = target.closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;

      // Debounce: skip if same link was prefetched within 1 second
      const now = Date.now();
      if (href === lastHref && now - lastFiredAt < 1000) return;

      lastHref = href;
      lastFiredAt = now;

      parsePrefetchIntent(href);
    }

    // mouseover bubbles up through the DOM — one listener catches all links
    document.addEventListener("mouseover", handleIntent as EventListener, { passive: true });
    document.addEventListener("touchstart", handleIntent as EventListener, { passive: true });

    return () => {
      document.removeEventListener("mouseover", handleIntent as EventListener);
      document.removeEventListener("touchstart", handleIntent as EventListener);
    };
  }, []);
}
