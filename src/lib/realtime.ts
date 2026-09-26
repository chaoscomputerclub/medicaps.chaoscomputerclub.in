/**
 * Chaos Computer Club — Medi-Caps Chapter
 * src/lib/realtime.ts
 *
 * Real-Time Event Stream Subsystem & Webhook Triggers
 * Provides SSE subscriptions to eliminate server interval polling.
 */

import { useEffect, useRef } from "react";
import { getApiBase, getToken } from "@/lib/auth";
import { invalidateSwrCache } from "@/lib/cache/swrCache";

export interface RealtimeEvent<T = any> {
  event: string;
  timestamp: string;
  contest_slug?: string;
  data: T;
}

export type RealtimeEventHandler = (event: RealtimeEvent) => void | Promise<void>;

const CONTEST_CACHE_PATTERNS = [
  "contests:*",
  "contest:*",
  "passes:*",
  "scoreboard:*",
  "ranking:*",
  "leaderboard:*",
  "portal:*",
];

function invalidateContestCaches(): void {
  for (const pattern of CONTEST_CACHE_PATTERNS) {
    invalidateSwrCache(pattern);
  }
}

/**
 * Hook to subscribe to real-time events via Server-Sent Events (SSE).
 * @param contestSlug Optional contest slug to filter events. If omitted, connects to global stream.
 * @param onEvent Callback function invoked on every matching real-time event.
 * @param eventFilter Optional list of event names to listen for (e.g. ["pass_checked_in", "contest_status_changed"]).
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

    const base = getApiBase();
    const endpoint = contestSlug
      ? `${base}/events/contest/${encodeURIComponent(contestSlug)}/stream`
      : `${base}/events/stream`;

    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let isSubscribed = true;

    function connect() {
      if (!isSubscribed) return;

      try {
        eventSource = new EventSource(endpoint);

        eventSource.onmessage = (e) => {
          if (!e.data || e.data.trim() === ": ping" || e.data.trim() === ": connected") {
            return;
          }

          try {
            const parsed: RealtimeEvent = JSON.parse(e.data);

            // Invalidate corresponding SWR cache entries immediately on incoming event
            if (
              parsed.event === "pass_checked_in" ||
              parsed.event === "contest_status_changed" ||
              parsed.event === "contest_created" ||
              parsed.event === "contest_updated" ||
              parsed.event === "contest_deleted"
              || parsed.event === "contest_timer_reset"
            ) {
              invalidateContestCaches();
            } else if (parsed.event === "top30_qualified" || parsed.event === "submission_evaluated") {
              invalidateContestCaches();
            }

            // Check if matches filter
            if (!eventFilter || eventFilter.length === 0 || eventFilter.includes(parsed.event)) {
              const handler = handlerRef.current;
              if (handler) {
                void Promise.resolve(handler(parsed)).catch((error) => {
                  console.error("Realtime event handler failed:", error);
                });
              }
            }
          } catch {
            // Ignore parse errors for keep-alive frames
          }
        };

        eventSource.onerror = () => {
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          if (isSubscribed) {
            // Reconnect after 3 seconds on drop
            reconnectTimeout = setTimeout(connect, 3000);
          }
        };
      } catch (err) {
        if (isSubscribed) {
          reconnectTimeout = setTimeout(connect, 5000);
        }
      }
    }

    connect();

    return () => {
      isSubscribed = false;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
    };
  }, [contestSlug, enabled, JSON.stringify(eventFilter)]);
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
