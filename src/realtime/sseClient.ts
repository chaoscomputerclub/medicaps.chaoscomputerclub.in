import { getApiBase, getToken } from "@/lib/auth";
import { globalEventRouter } from "./eventRouter";
import type { ServerEventEnvelope } from "./eventTypes";

export type SSEConnectionStatus = "disconnected" | "connecting" | "connected" | "reconnecting";

export interface SSEClientOptions {
  autoConnect?: boolean;
  baseReconnectDelayMs?: number;
  maxReconnectDelayMs?: number;
}

export interface RealtimeSubscriber {
  id: string;
  contestSlug?: string | null | undefined;
  eventFilter?: Set<string> | null | undefined;
  handler: (event: any) => void | Promise<void>;
  enabled: boolean;
}

export class ApplicationSseClient {
  private static instance: ApplicationSseClient;

  private eventSource: EventSource | null = null;
  private status: SSEConnectionStatus = "disconnected";
  private statusListeners: Set<(status: SSEConnectionStatus) => void> = new Set();
  private subscribers: Map<string, RealtimeSubscriber> = new Map();
  private nextSubId = 0;

  private shouldConnect = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private lastEventId: string | null = null;

  private readonly baseDelay: number;
  private readonly maxDelay: number;

  // Cross-Tab Broadcast Channel (leader election & multiplexing across tabs)
  private broadcastChannel: BroadcastChannel | null = null;
  private isLeader = true; // Optimistic leader: 1st tab connects immediately
  private leaderHeartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private lastLeaderHeartbeatReceived = 0;
  private leaderWatchdogTimer: ReturnType<typeof setInterval> | null = null;
  private channelId: string;
  private createdAt: number;

  private constructor(options: SSEClientOptions = {}) {
    this.baseDelay = options.baseReconnectDelayMs ?? 1000;
    this.maxDelay = options.maxReconnectDelayMs ?? 20000;
    this.createdAt = Date.now();
    this.channelId = `tab_${Math.random().toString(36).slice(2, 9)}_${this.createdAt}`;

    if (typeof window !== "undefined") {
      this.initCrossTabChannel();
      this.initBrowserLifecycle();
    }
  }

  public static getInstance(options?: SSEClientOptions): ApplicationSseClient {
    if (!ApplicationSseClient.instance) {
      ApplicationSseClient.instance = new ApplicationSseClient(options);
    }
    return ApplicationSseClient.instance;
  }

  public getStatus(): SSEConnectionStatus {
    return this.status;
  }

  public getLastEventId(): string | null {
    return this.lastEventId;
  }

  public onStatusChange(listener: (status: SSEConnectionStatus) => void): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  private setStatus(newStatus: SSEConnectionStatus) {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.statusListeners.forEach((l) => {
        try {
          l(newStatus);
        } catch (e) {
          console.error("Error in SSE status listener:", e);
        }
      });
    }
  }

  /**
   * Subscribe a component or callback to real-time events.
   * Auto-connects the SSE client if not already connected.
   */
  public subscribe(options: {
    contestSlug?: string | null | undefined;
    eventFilter?: string[] | undefined;
    handler: (event: any) => void | Promise<void>;
    enabled?: boolean | undefined;
  }): () => void {
    const id = `sub_${++this.nextSubId}`;
    const sub: RealtimeSubscriber = {
      id,
      contestSlug: options.contestSlug,
      eventFilter: options.eventFilter ? new Set(options.eventFilter.map((e) => e.toLowerCase())) : null,
      handler: options.handler,
      enabled: options.enabled ?? true,
    };
    this.subscribers.set(id, sub);

    if (this.status === "disconnected") {
      this.connect();
    }

    return () => {
      this.subscribers.delete(id);
    };
  }

  private notifySubscribers(event: ServerEventEnvelope) {
    const rawEventName = (event.event || event.type || "").toLowerCase().trim();
    const normalizedEventName = rawEventName.replace(/\./g, "_");
    const contestSlug = event.contest_slug || (event.payload as any)?.contest_slug || (event.data as any)?.contest_slug;

    this.subscribers.forEach((sub) => {
      if (!sub.enabled) return;
      if (sub.contestSlug && contestSlug && sub.contestSlug !== contestSlug) return;
      if (
        sub.eventFilter &&
        !sub.eventFilter.has(rawEventName) &&
        !sub.eventFilter.has(normalizedEventName)
      ) {
        return;
      }

      try {
        void Promise.resolve(
          sub.handler({
            event: event.event || event.type,
            timestamp: event.timestamp || new Date().toISOString(),
            contest_slug: contestSlug,
            data: event.data || event.payload,
          })
        ).catch((err) => {
          console.error(`[SSE Client] Handler error for sub ${sub.id}:`, err);
        });
      } catch (err) {
        console.error(`[SSE Client] Synchronous handler error for sub ${sub.id}:`, err);
      }
    });
  }

  /**
   * Cross-Tab Coordination via BroadcastChannel:
   * Only one tab connects via network SSE to the backend; other tabs receive
   * the synchronized broadcast events seamlessly.
   */
  private initCrossTabChannel() {
    if (typeof BroadcastChannel === "undefined") {
      this.isLeader = true;
      return;
    }

    try {
      this.broadcastChannel = new BroadcastChannel("ccc_realtime_multiplex");

      this.broadcastChannel.onmessage = (event: MessageEvent) => {
        const msg = event.data;
        if (!msg || typeof msg !== "object") return;

        if (msg.type === "EVENT_BROADCAST" && msg.event) {
          // Route event received from leader tab to RTK Query
          globalEventRouter.route(msg.event);
          // Dispatch to local component subscribers in this follower tab
          this.notifySubscribers(msg.event);
          // Broadcast to local window for legacy listeners
          this.emitWindowEvents(msg.event);
        } else if (msg.type === "LEADER_HEARTBEAT") {
          this.lastLeaderHeartbeatReceived = Date.now();
          // If another tab claims leadership:
          // Use creation timestamp and channelId to break tie deterministically
          if (this.isLeader && msg.channelId !== this.channelId) {
            const otherCreatedAt = Number(msg.createdAt ?? 0);
            if (otherCreatedAt < this.createdAt || (otherCreatedAt === this.createdAt && msg.channelId < this.channelId)) {
              // Yield to the older/higher-priority tab
              this.relinquishLeadership();
            }
          }
        } else if (msg.type === "LEADER_EXIT") {
          // Active leader tab was closed; claim leadership immediately
          if (!this.isLeader) {
            this.claimLeadership();
          }
        }
      };

      // Start leader heartbeat
      this.startLeaderHeartbeat();

      // Watchdog: If follower tab doesn't hear a leader heartbeat for > 7000ms, take over
      this.leaderWatchdogTimer = setInterval(() => {
        if (!this.isLeader && this.shouldConnect) {
          const silenceDuration = Date.now() - this.lastLeaderHeartbeatReceived;
          if (this.lastLeaderHeartbeatReceived > 0 && silenceDuration > 7000) {
            this.claimLeadership();
          }
        }
      }, 3500);
      (this.leaderWatchdogTimer as any)?.unref?.();
    } catch {
      this.isLeader = true;
    }
  }

  private startLeaderHeartbeat() {
    if (this.leaderHeartbeatTimer) clearInterval(this.leaderHeartbeatTimer);
    if (!this.broadcastChannel) return;

    // Send initial announcement
    this.broadcastChannel.postMessage({
      type: "LEADER_HEARTBEAT",
      channelId: this.channelId,
      createdAt: this.createdAt,
    });

    this.leaderHeartbeatTimer = setInterval(() => {
      if (this.broadcastChannel && this.isLeader) {
        this.broadcastChannel.postMessage({
          type: "LEADER_HEARTBEAT",
          channelId: this.channelId,
          createdAt: this.createdAt,
        });
      }
    }, 3000);
    (this.leaderHeartbeatTimer as any)?.unref?.();
  }

  private claimLeadership() {
    this.isLeader = true;
    this.startLeaderHeartbeat();

    // If we should be connected, start network stream
    if (this.shouldConnect && !this.eventSource) {
      this.connectNetworkStream();
    }
  }

  private relinquishLeadership() {
    this.isLeader = false;
    if (this.leaderHeartbeatTimer) {
      clearInterval(this.leaderHeartbeatTimer);
      this.leaderHeartbeatTimer = null;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    // Still connected from perspective of UI (receiving via BroadcastChannel)
    if (this.shouldConnect) {
      this.setStatus("connected");
    }
  }

  private initBrowserLifecycle() {
    // Reconnect immediately when coming back online
    window.addEventListener("online", () => {
      if (this.shouldConnect && this.isLeader && this.status !== "connected") {
        this.reconnectImmediate();
      }
    });

    // Cleanup on tab close/unload
    window.addEventListener("pagehide", () => {
      if (this.isLeader && this.broadcastChannel) {
        try {
          this.broadcastChannel.postMessage({
            type: "LEADER_EXIT",
            channelId: this.channelId,
          });
        } catch {
          // ignore on exit
        }
      }
      this.destroy();
    });

    // On tab visibility change
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        if (this.shouldConnect && this.isLeader && (this.status === "disconnected" || !this.eventSource)) {
          this.connectNetworkStream();
        }
      }
    });
  }

  /**
   * Connects to the platform's unified server-sent events stream.
   */
  public connect(): void {
    if (typeof window === "undefined") return;

    this.shouldConnect = true;

    // Non-leader tabs rely on cross-tab broadcast
    if (!this.isLeader && this.broadcastChannel) {
      this.setStatus("connected");
      return;
    }

    this.connectNetworkStream();
  }

  private connectNetworkStream(): void {
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
    let endpoint = `${base}/events/stream`;
    if (this.lastEventId) {
      const sep = endpoint.includes("?") ? "&" : "?";
      endpoint = `${endpoint}${sep}last_event_id=${encodeURIComponent(this.lastEventId)}`;
    }

    try {
      this.eventSource = new EventSource(endpoint);

      this.eventSource.onopen = () => {
        this.reconnectAttempts = 0;
        this.setStatus("connected");
      };

      this.eventSource.onmessage = (e: MessageEvent) => {
        this.handleRawMessage(e.data, e.lastEventId);
      };

      // Named event listeners registered by the backend event stream
      const EVENT_NAMES = [
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
        "submission.judged",
        "submission_judged",
        "assessment_finished",
        "ratings_updated",
        "rating.updated",
        "rating_updated",
        "member_profile_updated",
        "profile.updated",
        "profile_updated",
        "resync_required",
        "cache_sync",
        "announcement.created",
        "announcement_created",
        "activity.created",
        "activity_created",
      ];

      for (const name of EVENT_NAMES) {
        this.eventSource.addEventListener(name, (e: MessageEvent) => {
          this.handleRawMessage(e.data, e.lastEventId, name);
        });
      }

      this.eventSource.onerror = () => {
        this.scheduleReconnect();
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  private emitWindowEvents(event: ServerEventEnvelope) {
    if (typeof window === "undefined") return;

    const eventName = (event.event || event.type || "").toLowerCase().trim().replace(/\./g, "_");
    const payload = event.data || event.payload;

    window.dispatchEvent(new CustomEvent("ccc:realtime_event", { detail: event }));

    if (
      eventName === "contest_status_changed" ||
      eventName === "contest_concluded" ||
      eventName === "contest_finished" ||
      eventName === "contest_created" ||
      eventName === "contest_updated" ||
      eventName === "contest_deleted" ||
      eventName === "contest_registered" ||
      eventName === "contest_unregistered" ||
      eventName === "pass_checked_in" ||
      eventName === "top30_qualified" ||
      eventName === "assessment_finished" ||
      eventName === "resync_required" ||
      eventName === "cache_sync"
    ) {
      window.dispatchEvent(new CustomEvent("contest:cache_invalidated"));
      window.dispatchEvent(new CustomEvent("contest:status_changed"));
    }

    if (
      eventName === "contest_concluded" ||
      (eventName === "contest_status_changed" && (payload?.new_status === "finished" || payload?.status === "finished"))
    ) {
      window.dispatchEvent(new CustomEvent("contest:concluded", { detail: event }));
    }

    if (eventName === "leaderboard_updated" || eventName === "ratings_updated" || eventName === "rating_updated") {
      window.dispatchEvent(new CustomEvent("leaderboard:invalidate", { detail: event }));
    }
  }

  private handleRawMessage(rawData: any, lastEventId?: string, fallbackEventName?: string) {
    if (!rawData) return;

    // Handle connection pings / comments
    if (typeof rawData === "string") {
      const trimmed = rawData.trim();
      if (trimmed === ": ping" || trimmed === ": connected" || trimmed.startsWith(": connected to") || trimmed === ": heartbeat") {
        if (this.status !== "connected") {
          this.reconnectAttempts = 0;
          this.setStatus("connected");
        }
        return;
      }
    }

    if (lastEventId) {
      this.lastEventId = lastEventId;
    }

    try {
      const parsed: ServerEventEnvelope =
        typeof rawData === "string" ? JSON.parse(rawData) : rawData;

      if (!parsed.event && fallbackEventName) {
        parsed.event = fallbackEventName;
      }
      if (lastEventId && !parsed.id) {
        parsed.id = lastEventId;
      }

      // 1. Route to centralized RTK Query event router
      try {
        globalEventRouter.route(parsed);
      } catch (routeErr) {
        console.error("[SSE] Event router failed:", routeErr, parsed.event);
      }

      // 2. Dispatch to local component subscribers (feeds useRealtimeEvents)
      this.notifySubscribers(parsed);

      // 3. Emit window events for legacy components
      this.emitWindowEvents(parsed);

      // 4. Broadcast across tabs via BroadcastChannel
      if (this.broadcastChannel && this.isLeader) {
        this.broadcastChannel.postMessage({
          type: "EVENT_BROADCAST",
          event: parsed,
        });
      }
    } catch (e) {
      console.warn("[SSE] Failed to parse incoming realtime event frame:", e);
    }
  }

  /**
   * Reconnect with Exponential Backoff + Jitter.
   */
  private scheduleReconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    if (!this.shouldConnect) {
      this.setStatus("disconnected");
      return;
    }

    this.setStatus("reconnecting");
    this.reconnectAttempts++;

    const factor = 1.5;
    const rawDelay = Math.min(
      this.baseDelay * Math.pow(factor, Math.min(this.reconnectAttempts, 6)),
      this.maxDelay
    );

    const jitter = rawDelay * 0.2 * (Math.random() * 2 - 1);
    const delay = Math.round(rawDelay + jitter);

    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.shouldConnect && this.isLeader) {
        this.connectNetworkStream();
      }
    }, delay);
  }

  public reconnectImmediate(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = 0;
    this.shouldConnect = true;
    if (this.isLeader) {
      this.connectNetworkStream();
    } else {
      this.setStatus("connected");
    }
  }

  public disconnect(): void {
    this.shouldConnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.setStatus("disconnected");
  }

  public destroy(): void {
    this.disconnect();
    if (this.leaderHeartbeatTimer) {
      clearInterval(this.leaderHeartbeatTimer);
      this.leaderHeartbeatTimer = null;
    }
    if (this.leaderWatchdogTimer) {
      clearInterval(this.leaderWatchdogTimer);
      this.leaderWatchdogTimer = null;
    }
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }
    this.subscribers.clear();
    this.statusListeners.clear();
    globalEventRouter.reset();
  }
}

export const applicationSseClient = ApplicationSseClient.getInstance();
