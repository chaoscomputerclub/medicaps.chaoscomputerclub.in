/**
 * Chaos Computer Club — Medi-Caps Chapter
 * src/lib/realtime.ts
 *
 * Single Global SSE Multiplexer Subsystem (Facade over ApplicationSseClient)
 *
 * Maintains EXACTLY ONE browser EventSource connection shared across all
 * components, routes, and cross-tab sessions via BroadcastChannel multiplexing.
 */

import { useEffect, useRef, useState } from "react";
import { getApiBase, getToken } from "@/lib/auth";
import { invalidateSwrCache } from "@/lib/cache/swrCache";
import { applicationSseClient, type SSEConnectionStatus } from "@/realtime/sseClient";

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

export function invalidateContestCaches(): void {
  for (const pattern of CONTEST_CACHE_PATTERNS) {
    invalidateSwrCache(pattern);
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("contest:cache_invalidated"));
    window.dispatchEvent(new CustomEvent("assessment:status_changed"));
    window.dispatchEvent(new CustomEvent("contest:status_changed"));
  }
}

/**
 * Unified Global SSE Multiplexer
 * Delegates to the centralized ApplicationSseClient singleton to ensure
 * zero duplicate SSE connections across components and tabs.
 */
class GlobalSseMultiplexer {
  private static instance: GlobalSseMultiplexer;

  public static getInstance(): GlobalSseMultiplexer {
    if (!GlobalSseMultiplexer.instance) {
      GlobalSseMultiplexer.instance = new GlobalSseMultiplexer();
    }
    return GlobalSseMultiplexer.instance;
  }

  public getStatus(): ConnectionStatus {
    return applicationSseClient.getStatus() as ConnectionStatus;
  }

  public onStatusChange(listener: (status: ConnectionStatus) => void): () => void {
    return applicationSseClient.onStatusChange(listener as (status: SSEConnectionStatus) => void);
  }

  public subscribe(options: SubscriptionOptions): () => void {
    return applicationSseClient.subscribe({
      contestSlug: options.contestSlug,
      eventFilter: options.eventFilter,
      handler: options.handler,
      enabled: options.enabled,
    });
  }

  public reconnectImmediate(): void {
    applicationSseClient.reconnectImmediate();
  }

  public destroy(): void {
    // Shared singleton lifecycle managed by application
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

    const unsubscribe = applicationSseClient.subscribe({
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
    return applicationSseClient.getStatus() as ConnectionStatus;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    return applicationSseClient.onStatusChange((newStatus) => {
      setStatus(newStatus as ConnectionStatus);
    });
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
