import { store } from "@/store";
import { baseApi } from "@/store/api/baseApi";
import { contestApi } from "@/store/api/contestApi";
import { userApi } from "@/store/api/userApi";
import { globalEventDeduplicator } from "./eventDeduplicator";
import { RealtimeEventNames, type ServerEventEnvelope } from "./eventTypes";

export interface EventRouterMetrics {
  totalReceived: number;
  processed: number;
  deduplicatedOrStale: number;
  lastEventId: string | null;
  lastEventTimestamp: string | null;
}

export class RealtimeEventRouter {
  private metrics: EventRouterMetrics = {
    totalReceived: 0,
    processed: 0,
    deduplicatedOrStale: 0,
    lastEventId: null,
    lastEventTimestamp: null,
  };

  public getMetrics(): EventRouterMetrics {
    return { ...this.metrics };
  }

  public route(event: ServerEventEnvelope): void {
    this.metrics.totalReceived++;

    // 1. Guard via deduplication & version ordering
    if (!globalEventDeduplicator.shouldProcess(event)) {
      this.metrics.deduplicatedOrStale++;
      return;
    }

    this.metrics.processed++;
    if (event.id) this.metrics.lastEventId = event.id;
    this.metrics.lastEventTimestamp = event.timestamp ?? new Date().toISOString();

    const rawEventName = (event.event || event.type || "").toLowerCase().trim();
    const eventName = rawEventName.replace(/\./g, "_");
    const payload = event.payload || event.data || {};
    const contestSlug = event.contest_slug || payload.contest_slug || payload.slug;

    // 2. Hybrid Cache Strategy Dispatch
    switch (eventName) {
      // ── RATING & PROFILE UPDATES ──────────────────────────────────────────
      case "rating_updated":
      case "ratings_updated": {
        const rating = typeof payload.rating === "number" ? payload.rating : undefined;
        const memberId = payload.member_id || payload.user_id;

        // Direct cache patch if this rating update belongs to current user
        if (typeof rating === "number") {
          store.dispatch(
            userApi.util.updateQueryData("getFullProfile", undefined, (draft) => {
              if (draft?.member) {
                if (!memberId || draft.member.id === memberId) {
                  draft.member.rating = rating;
                  if (rating > draft.member.peak_rating) {
                    draft.member.peak_rating = rating;
                  }
                }
              }
            })
          );
          store.dispatch(
            userApi.util.updateQueryData("getCurrentUser", undefined, (draft) => {
              if (draft && (!memberId || draft.id === memberId)) {
                draft.rating = rating;
                if (rating > draft.peak_rating) {
                  draft.peak_rating = rating;
                }
              }
            })
          );
        }

        // Targeted invalidation for leaderboards and distribution
        store.dispatch(
          baseApi.util.invalidateTags([
            { type: "Rating", id: "DISTRIBUTION" },
            { type: "Leaderboard", id: "UNIVERSITY" },
          ])
        );
        break;
      }

      case "member_profile_updated":
      case "profile_updated": {
        const handle = payload.handle || payload.username;
        store.dispatch(
          baseApi.util.invalidateTags([
            { type: "Profile", id: "ME" },
            { type: "User", id: "ME" },
            ...(handle ? [{ type: "Profile" as const, id: String(handle).toLowerCase() }] : []),
          ])
        );
        break;
      }

      // ── CONTEST LIFECYCLE ──────────────────────────────────────────────────
      case "contest_status_changed": {
        const nextStatus = payload.status || payload.new_status || payload.contest_status;
        if (contestSlug && nextStatus) {
          // Direct cache update for the active contest summary
          store.dispatch(
            contestApi.util.updateQueryData("getContestDetail", contestSlug, (draft) => {
              if (draft) draft.status = nextStatus;
            })
          );
          // Direct cache update for the contest list query
          store.dispatch(
            contestApi.util.updateQueryData("getContests", undefined, (draft) => {
              const contest = draft?.find((c) => c.slug === contestSlug);
              if (contest) contest.status = nextStatus;
            })
          );
          // Targeted invalidation for contest list hub
          store.dispatch(
            baseApi.util.invalidateTags([{ type: "Contest", id: "LIST" }])
          );
        } else {
          // Unknown or complex payload: targeted invalidation triggers refetch
          store.dispatch(
            baseApi.util.invalidateTags([
              { type: "Contest", id: "LIST" },
              ...(contestSlug ? [{ type: "Contest" as const, id: contestSlug }] : []),
            ])
          );
        }
        break;
      }

      case "contest_created":
      case "contest_updated":
      case "contest_deleted":
      case "contest_timer_reset": {
        store.dispatch(
          baseApi.util.invalidateTags([
            { type: "Contest", id: "LIST" },
            ...(contestSlug ? [{ type: "Contest" as const, id: contestSlug }] : []),
          ])
        );
        break;
      }

      case "contest_concluded":
      case "contest_finished": {
        store.dispatch(
          baseApi.util.invalidateTags([
            { type: "Contest", id: "LIST" },
            { type: "Leaderboard" },
            { type: "Profile", id: "ME" },
            { type: "Rating" },
            ...(contestSlug ? [{ type: "Contest" as const, id: contestSlug }] : []),
          ])
        );
        break;
      }

      case "contest_registered":
      case "contest_unregistered":
      case "pass_checked_in": {
        store.dispatch(
          baseApi.util.invalidateTags([
            { type: "Contest", id: "LIST" },
            { type: "CampusPass", id: "ME" },
            ...(contestSlug
              ? [
                  { type: "Contest" as const, id: contestSlug },
                  { type: "Contest" as const, id: `REG_${contestSlug}` },
                  { type: "CampusPass" as const, id: contestSlug },
                ]
              : []),
          ])
        );
        break;
      }

      // ── LEADERBOARD & SUBMISSIONS ──────────────────────────────────────────
      case "leaderboard_updated":
      case "scoreboard_updated": {
        store.dispatch(
          baseApi.util.invalidateTags([
            { type: "Leaderboard", id: "UNIVERSITY" },
            ...(contestSlug ? [{ type: "Leaderboard" as const, id: `SCOREBOARD_${contestSlug}` }] : []),
          ])
        );
        break;
      }

      case "submission_evaluated":
      case "submission_judged":
      case "submission_created": {
        store.dispatch(
          baseApi.util.invalidateTags([
            { type: "Leaderboard" },
            ...(contestSlug
              ? [
                  { type: "ContestProblem" as const, id: contestSlug },
                  { type: "Submission" as const, id: contestSlug },
                  { type: "Leaderboard" as const, id: `SCOREBOARD_${contestSlug}` },
                ]
              : []),
          ])
        );
        break;
      }

      // ── ASSESSMENTS & QUALIFICATIONS ───────────────────────────────────────
      case "top30_qualified":
      case "assessment_finished": {
        store.dispatch(
          baseApi.util.invalidateTags([
            { type: "Contest" },
            { type: "Leaderboard" },
            { type: "CampusPass" },
            ...(contestSlug ? [{ type: "Assessment" as const, id: contestSlug }] : []),
          ])
        );
        break;
      }

      // ── FEEDS & NOTIFICATIONS ──────────────────────────────────────────────
      case "announcement_created": {
        store.dispatch(baseApi.util.invalidateTags([{ type: "Announcement", id: "LIST" }]));
        break;
      }

      case "activity_created": {
        store.dispatch(baseApi.util.invalidateTags([{ type: "Activity", id: "LIST" }]));
        break;
      }

      case "resync_required":
      case "cache_sync": {
        store.dispatch(
          baseApi.util.invalidateTags([
            "Contest",
            "Leaderboard",
            "Profile",
            "User",
            "Announcement",
            "CampusPass",
          ])
        );
        break;
      }

      default: {
        // Unknown or custom event: invalidate targeted tags if slug exists
        if (contestSlug) {
          store.dispatch(
            baseApi.util.invalidateTags([
              { type: "Contest", id: contestSlug },
              { type: "Leaderboard", id: `SCOREBOARD_${contestSlug}` },
            ])
          );
        }
        break;
      }
    }

    // 3. Backward compatibility bridge: broadcast window event for unmigrated components
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("ccc:realtime_event", {
          detail: event,
        })
      );
    }
  }

  public reset(): void {
    globalEventDeduplicator.reset();
    this.metrics = {
      totalReceived: 0,
      processed: 0,
      deduplicatedOrStale: 0,
      lastEventId: null,
      lastEventTimestamp: null,
    };
  }
}

export const globalEventRouter = new RealtimeEventRouter();
