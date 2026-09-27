import { useEffect, useState } from "react";
import { applicationSseClient, type SSEConnectionStatus } from "./sseClient";
import { globalEventRouter, type EventRouterMetrics } from "./eventRouter";
import { useAppSelector } from "@/store/hooks";

export interface RealtimeSyncState {
  status: SSEConnectionStatus;
  lastEventId: string | null;
  metrics: EventRouterMetrics;
}

/**
 * Top-level application hook for mounting the centralized SSE connection.
 * Connects once per authenticated session, coordinates cross-tab events,
 * and maintains continuous RTK Query cache synchronization.
 */
export function useRealtimeSync(): RealtimeSyncState {
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const [status, setStatus] = useState<SSEConnectionStatus>(applicationSseClient.getStatus());
  const [metrics, setMetrics] = useState<EventRouterMetrics>(globalEventRouter.getMetrics());

  // Register status listener and global session event handlers once — stable registration
  useEffect(() => {
    const unsubStatus = applicationSseClient.onStatusChange((newStatus) => {
      setStatus(newStatus);
      setMetrics(globalEventRouter.getMetrics());
    });

    const handleLogin = () => {
      applicationSseClient.reconnectImmediate();
    };

    const handleLogout = () => {
      applicationSseClient.disconnect();
      globalEventRouter.reset();
    };

    window.addEventListener("ccc:token-refreshed", handleLogin);
    window.addEventListener("ccc:session-invalidated", handleLogout);

    return () => {
      unsubStatus();
      window.removeEventListener("ccc:token-refreshed", handleLogin);
      window.removeEventListener("ccc:session-invalidated", handleLogout);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Connect SSE stream on mount: public stream serves contest, leaderboard, and announcement telemetry
  useEffect(() => {
    applicationSseClient.connect();
  }, []);

  // When auth drops, reset user-specific router cache without disconnecting public stream
  useEffect(() => {
    if (!isAuthenticated) {
      globalEventRouter.reset();
    }
  }, [isAuthenticated]);

  return {
    status,
    lastEventId: applicationSseClient.getLastEventId(),
    metrics,
  };
}
