/**
 * Chaos Computer Club — Medi-Caps Chapter
 * src/lib/realtime.ts
 *
 * Single Global SSE Multiplexer Subsystem
 *
 * Maintains EXACTLY ONE browser EventSource connection shared across all
 * components and routes, with reference counting, automatic reconnection with
 * exponential backoff, connection grace periods (preventing disconnect/reconnect
 * thrashing during route transitions), and per-subscriber event routing.
 */

import { useEffect, useRef, useState } from "react";
import { getApiBase, getToken } from "@/lib/auth";
import { invalidateSwrCache } from "@/lib/cache/swrCache";

export interface RealtimeEvent<T = any> {
  event: string;
  timestamp: string;
  contest_slug?: string;
  data: T;
}

export type RealtimeEventHandler = (event: RealtimeEvent) => void | Promise<void>;

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "reconnecting";

export interface SubscriptionOptions {
  contestSlug?: string | null | undefined;
  eventFilter?: string[] | undefined;
  handler: RealtimeEventHandler;
  enabled?: boolean | undefined;
}

const CONTEST_CACHE_PATTERNS = [
  "contests:*",
  "contest:*",
  "passes:*",
  "scoreboard:*",
  "ranking:*",
  "leaderboard:*",
  "portal:*",
  "portal:public_data",
  "public:*",
  "public:portal:*",
  "member:profile:*",
  "profile:*",
  "student:*",
  "hub:*",
  "system:contests:*",
];

let cacheInvalidateTimer: ReturnType<typeof setTimeout> | null = null;

export function invalidateContestCaches(immediate = false): void {
  const execute = () => {
    for (const pattern of CONTEST_CACHE_PATTERNS) {
      invalidateSwrCache(pattern);
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("contest:cache_invalidated"));
      window.dispatchEvent(new CustomEvent("assessment:status_changed"));
      window.dispatchEvent(new CustomEvent("contest:status_changed"));
    }
  };

  if (immediate) {
    if (cacheInvalidateTimer) {
      clearTimeout(cacheInvalidateTimer);
      cacheInvalidateTimer = null;
    }
    execute();
    return;
  }

  if (cacheInvalidateTimer) {
    clearTimeout(cacheInvalidateTimer);
  }
  cacheInvalidateTimer = setTimeout(() => {
    cacheInvalidateTimer = null;
    execute();
  }, 350);
}

interface InternalSubscriber {
  id: string;
  contestSlug?: string | null;
  eventFilter?: Set<string> | null;
  handler: RealtimeEventHandler;
  enabled: boolean;
}

class GlobalSseMultiplexer {
  private static instance: GlobalSseMultiplexer;

  private eventSource: EventSource | null = null;
  private contestEventSources = new Map<string, EventSource>();
  private contestReconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private subscribers: Map<string, InternalSubscriber> = new Map();
  private status: ConnectionStatus = "disconnected";
  private statusListeners: Set<(status: ConnectionStatus) => void> = new Set();

  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private disconnectGraceTimer: ReturnType<typeof setTimeout> | null = null;
  private nextSubId = 0;

  private readonly GRACE_PERIOD_MS = 10_000; // 10s grace period on 0 subscribers to prevent thrashing
  private readonly BASE_RECONNECT_DELAY_MS = 1500;
  private readonly MAX_RECONNECT_DELAY_MS = 15_000;

  private constructor() {
    if (typeof window !== "undefined") {
      // Reconnect immediately when browser comes back online
      window.addEventListener("online", () => {
        if (this.subscribers.size > 0 && this.status !== "connected") {
          this.reconnectImmediate();
        }
      });

      // Disconnect when tab/page is hidden/closed to cleanly free server resources
      window.addEventListener("pagehide", () => {
        this.destroy();
      });

      // Tear down SSE connections immediately on logout / auth switch
      window.addEventListener("ccc:auth-changed", () => {
        this.destroy();
      });
    }
  }

  public static getInstance(): GlobalSseMultiplexer {
    if (!GlobalSseMultiplexer.instance) {
      GlobalSseMultiplexer.instance = new GlobalSseMultiplexer();
    }
    return GlobalSseMultiplexer.instance;
  }

  public getStatus(): ConnectionStatus {
    return this.status;
  }

  public onStatusChange(listener: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  private setStatus(newStatus: ConnectionStatus) {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.statusListeners.forEach((listener) => {
        try {
          listener(newStatus);
        } catch (e) {
          console.error("Error in SSE status listener:", e);
        }
      });
    }
  }

  public subscribe(options: SubscriptionOptions): () => void {
    const id = `sub_${++this.nextSubId}_${Date.now()}`;
    const sub: InternalSubscriber = {
      id,
      contestSlug: options.contestSlug || null,
      eventFilter: options.eventFilter && options.eventFilter.length > 0 ? new Set(options.eventFilter) : null,
      handler: options.handler,
      enabled: options.enabled ?? true,
    };

    this.subscribers.set(id, sub);
    if (sub.enabled && sub.contestSlug) this.connectContest(sub.contestSlug);

    // Cancel any pending disconnect grace timer since a subscriber is active
    if (this.disconnectGraceTimer) {
      clearTimeout(this.disconnectGraceTimer);
      this.disconnectGraceTimer = null;
    }

    // Ensure connection is active if subscriber is enabled
    if (sub.enabled && !this.eventSource && this.status !== "connecting") {
      this.connect();
    }

    // Return unsubscriber function
    return () => {
      this.unsubscribe(id);
    };
  }

  private unsubscribe(id: string) {
    const removed = this.subscribers.get(id);
    this.subscribers.delete(id);
    if (removed?.contestSlug && !Array.from(this.subscribers.values()).some((s) => s.enabled && s.contestSlug === removed.contestSlug)) {
      this.disconnectContest(removed.contestSlug);
    }

    const hasActiveSubscribers = Array.from(this.subscribers.values()).some((s) => s.enabled);
    if (!hasActiveSubscribers) {
      this.scheduleGracefulDisconnect();
    }
  }

  private scheduleGracefulDisconnect() {
    if (this.disconnectGraceTimer) {
      clearTimeout(this.disconnectGraceTimer);
    }

    this.disconnectGraceTimer = setTimeout(() => {
      this.disconnectGraceTimer = null;
      const hasActive = Array.from(this.subscribers.values()).some((s) => s.enabled);
      if (!hasActive) {
        this.disconnect();
      }
    }, this.GRACE_PERIOD_MS);
  }

  private connect() {
    if (typeof window === "undefined") return;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.setStatus(this.reconnectAttempts > 0 ? "reconnecting" : "connecting");

    const base = getApiBase();
    // Connect strictly to the unified global event stream which receives all chapter and contest events
    const endpoint = `${base}/events/stream`;

    try {
      this.eventSource = new EventSource(endpoint);

      this.eventSource.onopen = () => {
        const wasReconnecting = this.reconnectAttempts > 0;
        this.reconnectAttempts = 0;
        this.setStatus("connected");
        if (wasReconnecting) {
          // Reconnect state reconciliation: on network reconnect, invalidate local caches
          // to pull authoritative domain state from PostgreSQL (Section 21 SSOT invariant)
          invalidateContestCaches(true);
        }
      };

      this.eventSource.onmessage = (e: MessageEvent) => {
        this.handleRawMessage(e.data);
      };

      const NAMED_EVENTS = [
        "leaderboard.updated",
        "leaderboard_updated",
        "scoreboard.updated",
        "scoreboard_updated",
        "contest.updated",
        "contest_status_changed",
        "contest_concluded",
        "contest_finished",
        "contest_created",
        "contest_updated",
        "contest_deleted",
        "contest_timer_reset",
        "contest_registered",
        "contest_unregistered",
        "pass_checked_in",
        "top30_qualified",
        "submission_evaluated",
        "submission_completed",
        "assessment_finished",
        "ratings_updated",
        "member_profile_updated",
        "resync_required",
        "cache_sync",
      ];
      for (const evtName of NAMED_EVENTS) {
        this.eventSource.addEventListener(evtName, (e: MessageEvent) => {
          this.handleRawMessage(e.data);
        });
      }

      this.eventSource.onerror = () => {
        if (this.eventSource) {
          this.eventSource.close();
          this.eventSource = null;
        }

        const hasActive = Array.from(this.subscribers.values()).some((s) => s.enabled);
        if (hasActive) {
          this.scheduleReconnect();
        } else {
          this.setStatus("disconnected");
        }
      };
    } catch (err) {
      console.warn("[SSE Multiplexer] Connection initialization error:", err);
      this.scheduleReconnect();
    }
  }

  private connectContest(slug: string) {
    if (typeof window === "undefined" || this.contestEventSources.has(slug)) return;
    const source = new EventSource(`${getApiBase()}/events/contest/${encodeURIComponent(slug)}/stream`);
    this.contestEventSources.set(slug, source);
    const onMessage = (event: MessageEvent) => this.handleRawMessage(event.data, `contest:${slug}`);
    source.onmessage = onMessage;
    for (const eventName of ["submission_evaluated", "submission_completed"]) {
      source.addEventListener(eventName, onMessage as EventListener);
    }
    source.onerror = () => {
      if (this.contestEventSources.get(slug) !== source) return;
      source.close();
      this.contestEventSources.delete(slug);
      if (!Array.from(this.subscribers.values()).some((s) => s.enabled && s.contestSlug === slug)) return;
      const timer = setTimeout(() => {
        this.contestReconnectTimers.delete(slug);
        this.connectContest(slug);
      }, this.BASE_RECONNECT_DELAY_MS);
      this.contestReconnectTimers.set(slug, timer);
    };
  }

  private disconnectContest(slug: string) {
    this.contestEventSources.get(slug)?.close();
    this.contestEventSources.delete(slug);
    const timer = this.contestReconnectTimers.get(slug);
    if (timer) clearTimeout(timer);
    this.contestReconnectTimers.delete(slug);
  }

  private scheduleReconnect() {
    this.setStatus("reconnecting");
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectAttempts++;
    // Exponential backoff with jitter (1.5x up to 15s)
    const delay = Math.min(
      this.BASE_RECONNECT_DELAY_MS * Math.pow(1.5, Math.min(this.reconnectAttempts, 6)) + Math.random() * 500,
      this.MAX_RECONNECT_DELAY_MS
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      const hasActive = Array.from(this.subscribers.values()).some((s) => s.enabled);
      if (hasActive) {
        this.connect();
      } else {
        this.setStatus("disconnected");
      }
    }, delay);
  }

  public reconnectImmediate() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = 0;
    this.connect();
  }

  private disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.disconnectGraceTimer) {
      clearTimeout(this.disconnectGraceTimer);
      this.disconnectGraceTimer = null;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    for (const slug of new Set([...this.contestEventSources.keys(), ...this.contestReconnectTimers.keys()])) {
      this.disconnectContest(slug);
    }
    this.setStatus("disconnected");
  }

  public destroy() {
    this.subscribers.clear();
    this.statusListeners.clear();
    this.disconnect();
  }

  private handleRawMessage(rawData: string, sourceChannel = "global") {
    if (!rawData) return;
    const trimmed = rawData.trim();
    if (trimmed === ": ping" || trimmed === ": connected" || trimmed.startsWith(": connected to")) {
      if (this.status !== "connected") {
        this.reconnectAttempts = 0;
        this.setStatus("connected");
      }
      return;
    }

    try {
      const parsed: RealtimeEvent = JSON.parse(rawData);
      if (sourceChannel.startsWith("contest:") && !["submission_evaluated", "submission_completed"].includes(parsed.event)) return;

      // 1. Process Global Platform Cache & Lifecycle Invalidation (Executed ONCE per event)
      if (
        parsed.event === "pass_checked_in" ||
        parsed.event === "contest_status_changed" ||
        parsed.event === "contest_concluded" ||
        parsed.event === "contest_finished" ||
        parsed.event === "contest_created" ||
        parsed.event === "contest_updated" ||
        parsed.event === "contest.updated" ||
        parsed.event === "contest_deleted" ||
        parsed.event === "contest_timer_reset" ||
        parsed.event === "contest_registered" ||
        parsed.event === "contest_unregistered" ||
        parsed.event === "top30_qualified" ||
        parsed.event === "assessment_finished" ||
        parsed.event === "leaderboard_updated" ||
        parsed.event === "leaderboard.updated" ||
        parsed.event === "scoreboard_updated" ||
        parsed.event === "scoreboard.updated" ||
        parsed.event === "ratings_updated" ||
        parsed.event === "member_profile_updated" ||
        parsed.event === "resync_required" ||
        parsed.event === "cache_sync"
      ) {
        const isImmediate =
          parsed.event === "contest_registered" ||
          parsed.event === "contest_unregistered" ||
          parsed.event === "resync_required" ||
          parsed.event === "cache_sync";
        invalidateContestCaches(isImmediate);
      }

      if (
        parsed.event === "leaderboard_updated" ||
        parsed.event === "ratings_updated"
      ) {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("leaderboard:invalidate", { detail: parsed }));
        }
      }

      if (
        parsed.event === "contest_concluded" ||
        (parsed.event === "contest_status_changed" &&
          (parsed.data?.new_status === "finished" || parsed.data?.status === "finished"))
      ) {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("contest:concluded", { detail: parsed }));
        }
      }

      // 2. Dispatch to Subscribed Components with Selective Filtering
      this.subscribers.forEach((sub) => {
        if (!sub.enabled) return;

        if (sourceChannel.startsWith("contest:") && sub.contestSlug !== sourceChannel.slice("contest:".length)) return;
        if (sourceChannel === "global" && parsed.event === "submission_evaluated") return;

        // Contest filter: if subscriber specified a contestSlug, only dispatch matching contest events
        if (sub.contestSlug && parsed.contest_slug && parsed.contest_slug !== sub.contestSlug) {
          return;
        }

        // Event name filter: if subscriber specified an eventFilter set, only dispatch matching events
        if (sub.eventFilter && !sub.eventFilter.has(parsed.event)) {
          return;
        }

        try {
          void Promise.resolve(sub.handler(parsed)).catch((error) => {
            console.error(`[SSE Multiplexer] Handler error for sub ${sub.id}:`, error);
          });
        } catch (err) {
          console.error(`[SSE Multiplexer] Synchronous handler error for sub ${sub.id}:`, err);
        }
      });
    } catch {
      // Ignore keep-alive or malformed frames safely
    }
  }

  public getSubscriberCount(): number {
    return this.subscribers.size;
  }
}

/**
 * Hook to subscribe to real-time events via the single global SSE multiplexer.
 * Multiple components subscribing share exactly ONE underlying EventSource connection.
 *
 * @param contestSlug Optional contest slug to filter events. If omitted, connects to global stream.
 * @param onEvent Callback function invoked on every matching real-time event.
 * @param eventFilter Optional list of event names to listen for (e.g. ["pass_checked_in", "contest_status_changed"]).
 * @param enabled Whether this subscription is currently active (defaults to true).
 */
export function useRealtimeEvents(
  contestSlug?: string | null,
  onEvent?: RealtimeEventHandler,
  eventFilter?: string[],
  enabled: boolean = true
) {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    if (typeof window === "undefined" || !enabled) return;

    const multiplexer = GlobalSseMultiplexer.getInstance();

    const unsubscribe = multiplexer.subscribe({
      contestSlug,
      eventFilter,
      enabled,
      handler: (event) => {
        if (handlerRef.current) {
          return handlerRef.current(event);
        }
      },
    });

    return () => {
      unsubscribe();
    };
  }, [contestSlug, enabled, JSON.stringify(eventFilter)]);
}

/**
 * Hook to inspect the global SSE connection status in UI telemetry badges.
 */
export function useRealtimeStatus(): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>(() => {
    if (typeof window === "undefined") return "disconnected";
    return GlobalSseMultiplexer.getInstance().getStatus();
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const multiplexer = GlobalSseMultiplexer.getInstance();
    return multiplexer.onStatusChange(setStatus);
  }, []);

  return status;
}

export function getGlobalRealtimeMultiplexer(): GlobalSseMultiplexer {
  return GlobalSseMultiplexer.getInstance();
}


/**
 * Webhook client helper: Inbound Gate Scan (IoT Turnstile / Hardware Scanner).
 */
export async function triggerWebhookGateScan(
  passCodeOrQr: string,
  proctorName: string = "Hardware Gate Scanner",
  contestSlug?: string
) {
  const base = getApiBase();
  const token = getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${base}/webhooks/gate-scan`, {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify({
      pass_code_or_qr: passCodeOrQr,
      proctor_name: proctorName,
      contest_slug: contestSlug,
    }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to process gate scan webhook.");
  }

  return await res.json();
}

/**
 * Webhook client helper: Contest Lifecycle / Timer Overrides.
 */
export async function triggerWebhookContestEvent(
  slug: string,
  action: "start_live" | "finish" | "reset_timer" | "qualify_top30",
  timerMinutes: number = 90
) {
  const base = getApiBase();
  const token = getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${base}/webhooks/contest-event`, {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify({
      slug,
      action,
      timer_minutes: timerMinutes,
    }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to trigger contest event webhook.");
  }

  return await res.json();
}
