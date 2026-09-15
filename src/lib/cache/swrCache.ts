/**
 * Chaos Computer Club India — Stale-While-Revalidate (SWR) Client Cache Engine
 * High-performance in-memory cache with in-flight request deduplication,
 * configurable TTL/stale times, and instant zero-flicker UI hydration.
 */

import { useState, useEffect, useRef, useCallback } from "react";

export interface SwrCacheOptions {
  /** Time in ms after which data is considered stale and revalidated in background (default: 30,000ms = 30s) */
  staleTime?: number;
  /** Time in ms after which cached entry is purged entirely (default: 300,000ms = 5min) */
  ttl?: number;
  /** If true, ignores existing cache and forces a fresh network call */
  forceRefresh?: boolean;
  /** Optional persistence to sessionStorage for persistence across page reloads */
  persistSession?: boolean;
  /** If false, disables automatic fetching and subscriber attachment */
  enabled?: boolean;
}

interface CacheRecord<T> {
  data: T;
  timestamp: number;
}

class SwrMemoryStore {
  private cache = new Map<string, CacheRecord<any>>();
  private inFlight = new Map<string, Promise<any>>();
  private subscribers = new Map<string, Set<(data: any) => void>>();

  constructor() {
    // Hydrate from sessionStorage if available
    if (typeof window !== "undefined" && window.sessionStorage) {
      try {
        const persisted = window.sessionStorage.getItem("__ccc_swr_cache__");
        if (persisted) {
          const parsed = JSON.parse(persisted);
          const now = Date.now();
          for (const [key, record] of Object.entries(parsed as Record<string, CacheRecord<any>>)) {
            // Only load entries that are younger than 10 minutes
            if (record && now - record.timestamp < 600000) {
              this.cache.set(key, record);
            }
          }
        }
      } catch {
        // Ignore storage parse issues
      }
    }
  }

  private saveToSession() {
    if (typeof window !== "undefined" && window.sessionStorage) {
      try {
        const obj: Record<string, CacheRecord<any>> = {};
        for (const [key, record] of this.cache.entries()) {
          obj[key] = record;
        }
        window.sessionStorage.setItem("__ccc_swr_cache__", JSON.stringify(obj));
      } catch {
        // Storage quota full or unavailable
      }
    }
  }

  public get<T>(key: string): CacheRecord<T> | undefined {
    return this.cache.get(key);
  }

  public set<T>(key: string, data: T, persistSession = false): void {
    const record: CacheRecord<T> = { data, timestamp: Date.now() };
    this.cache.set(key, record);

    if (persistSession) {
      this.saveToSession();
    }

    // Notify all active subscribers of this key
    const subs = this.subscribers.get(key);
    if (subs) {
      subs.forEach((cb) => {
        try {
          cb(data);
        } catch (e) {
          console.error("SWR subscriber notification error:", e);
        }
      });
    }
  }

  public getInFlight<T>(key: string): Promise<T> | undefined {
    return this.inFlight.get(key);
  }

  public setInFlight<T>(key: string, promise: Promise<T>): void {
    this.inFlight.set(key, promise);
  }

  public clearInFlight(key: string): void {
    this.inFlight.delete(key);
  }

  public invalidate(patternOrKey: string): void {
    if (patternOrKey.includes("*")) {
      const regex = new RegExp("^" + patternOrKey.replace(/\*/g, ".*") + "$");
      for (const key of this.cache.keys()) {
        if (regex.test(key)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.delete(patternOrKey);
    }
    this.saveToSession();
  }

  public clear(): void {
    this.cache.clear();
    this.inFlight.clear();
    if (typeof window !== "undefined" && window.sessionStorage) {
      window.sessionStorage.removeItem("__ccc_swr_cache__");
    }
  }

  public subscribe(key: string, callback: (data: any) => void): () => void {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    this.subscribers.get(key)!.add(callback);
    return () => {
      const set = this.subscribers.get(key);
      if (set) {
        set.delete(callback);
        if (set.size === 0) {
          this.subscribers.delete(key);
        }
      }
    };
  }
}

export const globalSwrStore = new SwrMemoryStore();

/**
 * Perform a Stale-While-Revalidate fetch:
 * 1. If fresh cache exists, return it immediately.
 * 2. If stale cache exists, return stale cache while silently fetching in the background.
 * 3. If no cache exists, await the network promise.
 * 4. In-flight requests for the same key are deduplicated automatically.
 */
export async function swrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: SwrCacheOptions = {}
): Promise<T> {
  const {
    staleTime = 30000, // 30s stale window
    ttl = 300000, // 5m total TTL
    forceRefresh = false,
    persistSession = false,
  } = options;

  const now = Date.now();
  const cached = globalSwrStore.get<T>(key);

  // 1. Check valid cache
  if (!forceRefresh && cached) {
    const age = now - cached.timestamp;
    if (age < ttl) {
      // If data is still within fresh staleTime, return immediately
      if (age < staleTime) {
        return cached.data;
      }
      // If data is stale but within TTL, trigger background revalidation without blocking caller
      triggerBackgroundRevalidate(key, fetcher, persistSession);
      return cached.data;
    }
  }

  // 2. Check in-flight promise for deduplication
  const existingPromise = globalSwrStore.getInFlight<T>(key);
  if (!forceRefresh && existingPromise) {
    return existingPromise;
  }

  // 3. Dispatch new network request
  const fetchPromise = (async () => {
    try {
      const freshData = await fetcher();
      if (freshData !== undefined && freshData !== null) {
        globalSwrStore.set(key, freshData, persistSession);
      }
      return freshData;
    } finally {
      globalSwrStore.clearInFlight(key);
    }
  })();

  globalSwrStore.setInFlight(key, fetchPromise);
  return fetchPromise;
}

function triggerBackgroundRevalidate<T>(
  key: string,
  fetcher: () => Promise<T>,
  persistSession = false
) {
  if (globalSwrStore.getInFlight(key)) return;

  const bgPromise = (async () => {
    try {
      const freshData = await fetcher();
      if (freshData !== undefined && freshData !== null) {
        globalSwrStore.set(key, freshData, persistSession);
      }
    } catch (e) {
      // Silent background catch
    } finally {
      globalSwrStore.clearInFlight(key);
    }
  })();

  globalSwrStore.setInFlight(key, bgPromise);
}

/**
 * React Hook for seamless component-level SWR caching:
 * - Instant synchronous render if data is already in cache (0ms latency, no skeleton flicker!).
 * - `loading` is only `true` on cold start with NO cached data.
 * - `isValidating` is `true` while background network sync runs.
 * - Subscribes to updates from any other component mutating the same key.
 */
export function useSwrData<T>(
  key: string | null | undefined,
  fetcher: () => Promise<T>,
  options: SwrCacheOptions = {}
) {
  const { staleTime = 30000, ttl = 300000, forceRefresh = false, persistSession = false, enabled = true } = options;

  // Synchronous cache lookup for instant initial state
  const isQueryActive = Boolean(key && enabled);
  const initialCache = isQueryActive && key ? globalSwrStore.get<T>(key) : undefined;
  const isFresh = initialCache ? Date.now() - initialCache.timestamp < ttl : false;

  const [data, setData] = useState<T | null>(isFresh && initialCache ? initialCache.data : null);
  const [loading, setLoading] = useState<boolean>(isQueryActive && (!isFresh || !initialCache));
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const executeFetch = useCallback(
    async (force = false) => {
      if (!key || !enabled) {
        setLoading(false);
        return;
      }

      const cached = globalSwrStore.get<T>(key);
      const hasValidData = cached && Date.now() - cached.timestamp < ttl;

      if (!hasValidData || force) {
        if (!data) setLoading(true);
      }
      setIsValidating(true);

      try {
        const res = await swrFetch(key, () => fetcherRef.current(), {
          staleTime,
          ttl,
          forceRefresh: force,
          persistSession,
        });
        setData(res);
        setError(null);
      } catch (err: any) {
        setError(err);
      } finally {
        setLoading(false);
        setIsValidating(false);
      }
    },
    [key, enabled, staleTime, ttl, persistSession]
  );

  useEffect(() => {
    if (!key || !enabled) {
      setLoading(false);
      return;
    }

    // Check if store has updated data immediately
    const currentCached = globalSwrStore.get<T>(key);
    if (currentCached && Date.now() - currentCached.timestamp < ttl) {
      setData(currentCached.data);
      setLoading(false);
    } else {
      executeFetch(forceRefresh);
    }

    // Subscribe to external mutations or background syncs
    const unsubscribe = globalSwrStore.subscribe(key, (newData) => {
      setData(newData);
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [key, enabled, executeFetch, forceRefresh, ttl]);

  const mutate = useCallback(
    (newData: T | ((prev: T | null) => T), shouldRevalidate = false) => {
      if (!key) return;
      const resolved =
        typeof newData === "function" ? (newData as any)(data) : newData;
      globalSwrStore.set(key, resolved, persistSession);
      setData(resolved);
      if (shouldRevalidate) {
        executeFetch(true);
      }
    },
    [key, data, persistSession, executeFetch]
  );

  const revalidate = useCallback(() => executeFetch(true), [executeFetch]);

  return {
    data,
    loading,
    isValidating,
    error,
    mutate,
    revalidate,
  };
}

/** Invalidate cache keys matching exact name or glob pattern (e.g. "contests:*") */
export function invalidateSwrCache(patternOrKey: string): void {
  globalSwrStore.invalidate(patternOrKey);
}

/** Direct programmatic mutation into the SWR store */
export function setSwrCache<T>(key: string, data: T, persistSession = false): void {
  globalSwrStore.set(key, data, persistSession);
}
