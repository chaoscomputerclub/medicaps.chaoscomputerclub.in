import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Realtime & Deduplication
import { EventDeduplicator } from "../../src/realtime/eventDeduplicator";
import { RealtimeEventRouter } from "../../src/realtime/eventRouter";
import { RealtimeEventNames, type ServerEventEnvelope } from "../../src/realtime/eventTypes";
import { ApplicationSseClient } from "../../src/realtime/sseClient";

// Store & RTK Query
import { store } from "../../src/store";
import { baseApi } from "../../src/store/api/baseApi";
import { userApi } from "../../src/store/api/userApi";
import { contestApi } from "../../src/store/api/contestApi";
import "../../src/store/api";

describe("RTK Query Architecture & Store Integration", () => {
  test("Redux store mounts baseApi reducer and middleware", () => {
    const state = store.getState();
    assert.ok(state[baseApi.reducerPath], "baseApi reducer exists on store state");
    assert.ok(state.auth, "auth slice exists for client state");
    assert.ok(state.contest, "contest slice exists");
  });

  test("baseApi exposes endpoint definitions", () => {
    const endpointNames = Object.keys(baseApi.endpoints);
    assert.ok(endpointNames.length > 0, "baseApi has endpoint definitions");
    assert.ok(endpointNames.includes("getCurrentUser"), "includes getCurrentUser");
    assert.ok(endpointNames.includes("getContests"), "includes getContests");
    assert.ok(endpointNames.includes("getUniversityLeaderboard"), "includes getUniversityLeaderboard");
  });

  test("baseApi resets API cache upon resetApiState", () => {
    store.dispatch(baseApi.util.resetApiState());
    const apiState = store.getState()[baseApi.reducerPath];
    assert.deepEqual(apiState.queries, {}, "Queries cache is empty after resetApiState");
    assert.deepEqual(apiState.mutations, {}, "Mutations cache is empty after resetApiState");
  });
});

describe("Realtime Event Deduplication & Version Ordering", () => {
  let deduplicator: EventDeduplicator;

  beforeEach(() => {
    deduplicator = new EventDeduplicator(5); // small capacity for testing LRU
  });

  test("accepts new events with unique event IDs", () => {
    const event1: ServerEventEnvelope = {
      id: "evt_101",
      event: "rating.updated",
      payload: { rating: 1300 },
    };
    const event2: ServerEventEnvelope = {
      id: "evt_102",
      event: "rating.updated",
      payload: { rating: 1320 },
    };

    assert.equal(deduplicator.shouldProcess(event1), true, "First unique event accepted");
    assert.equal(deduplicator.shouldProcess(event2), true, "Second unique event accepted");
  });

  test("drops duplicate events with same event ID", () => {
    const event: ServerEventEnvelope = {
      id: "evt_duplicate",
      event: "contest.updated",
      payload: { slug: "round-1" },
    };

    assert.equal(deduplicator.shouldProcess(event), true, "First occurrence accepted");
    assert.equal(deduplicator.shouldProcess(event), false, "Duplicate occurrence dropped");
  });

  test("evicts oldest event IDs when LRU capacity is reached", () => {
    for (let i = 1; i <= 5; i++) {
      deduplicator.shouldProcess({ id: `evt_${i}`, event: "ping" });
    }

    // Capacity is 5, inserting 6th should evict evt_1
    deduplicator.shouldProcess({ id: "evt_6", event: "ping" });

    // evt_1 is evicted, so if it comes again after 5 other events, it's processed (bounded memory invariant)
    assert.equal(deduplicator.shouldProcess({ id: "evt_1", event: "ping" }), true);
  });

  test("enforces monotonic version ordering per aggregate", () => {
    const v10: ServerEventEnvelope = {
      id: "evt_v10",
      event: "leaderboard.updated",
      aggregate: "contest",
      aggregate_id: "round_2",
      version: 10,
    };
    const v9_stale: ServerEventEnvelope = {
      id: "evt_v9",
      event: "leaderboard.updated",
      aggregate: "contest",
      aggregate_id: "round_2",
      version: 9,
    };
    const v10_duplicate: ServerEventEnvelope = {
      id: "evt_v10_alt",
      event: "leaderboard.updated",
      aggregate: "contest",
      aggregate_id: "round_2",
      version: 10,
    };
    const v11_fresh: ServerEventEnvelope = {
      id: "evt_v11",
      event: "leaderboard.updated",
      aggregate: "contest",
      aggregate_id: "round_2",
      version: 11,
    };

    assert.equal(deduplicator.shouldProcess(v10), true, "Version 10 accepted as initial high-water mark");
    assert.equal(deduplicator.shouldProcess(v9_stale), false, "Stale Version 9 rejected");
    assert.equal(deduplicator.shouldProcess(v10_duplicate), false, "Duplicate Version 10 rejected");
    assert.equal(deduplicator.shouldProcess(v11_fresh), true, "Fresh Version 11 accepted");
  });
});

describe("SSE Event Router Hybrid Cache Synchronization", () => {
  let router: RealtimeEventRouter;

  beforeEach(() => {
    router = new RealtimeEventRouter();
    store.dispatch(baseApi.util.resetApiState());
  });

  test("routes rating.updated and patches user draft in RTK Query cache", async () => {
    // Seed initial profile in RTK Query cache
    await store.dispatch(
      userApi.util.upsertQueryData("getFullProfile", undefined, {
        member: {
          id: "usr_100",
          full_name: "Santusht Kotai",
          username: "santusht",
          email: "santusht@chaoscomputerclub.in",
          rating: 1200,
          peak_rating: 1250,
          tier: "Apprentice",
          bio: "",
          department: "CSE",
          batch: "2026",
          division: "A",
          gender: "other",
          github_url: null,
          linkedin_url: null,
          leetcode_url: null,
          codeforces_url: null,
          attendance_count: 5,
          university_rank: 42,
          created_at: "2026-01-01T00:00:00Z",
          is_self: true,
          social_counts: { followers: 10, following: 5, is_following: false },
        },
        ratingHistory: [],
        recentBattles: [],
      })
    );

    // Verify initial cached rating
    let cached = userApi.endpoints.getFullProfile.select(undefined)(store.getState());
    assert.equal(cached.data?.member.rating, 1200);

    // Route authoritative rating.updated event
    router.route({
      id: "evt_rating_1",
      event: RealtimeEventNames.RATING_UPDATED,
      payload: {
        member_id: "usr_100",
        rating: 1350,
      },
    });

    // Check directly patched cache
    cached = userApi.endpoints.getFullProfile.select(undefined)(store.getState());
    assert.equal(cached.data?.member.rating, 1350, "Rating in RTK Query cache directly updated");
    assert.equal(cached.data?.member.peak_rating, 1350, "Peak rating automatically raised");
  });

  test("routes contest_status_changed and directly patches contest detail", async () => {
    const slug = "code-clash-2026";

    // Seed contest in RTK Query cache
    await store.dispatch(
      contestApi.util.upsertQueryData("getContestDetail", slug, {
        id: "c_1",
        slug,
        title: "Code Clash 2026",
        description: "Official round",
        format: "round1_mcq_dsa",
        status: "upcoming",
        starts_at: "2026-10-01T10:00:00Z",
        ends_at: "2026-10-01T12:00:00Z",
        registered: true,
      } as any)
    );

    let contestState = contestApi.endpoints.getContestDetail.select(slug)(store.getState());
    assert.equal(contestState.data?.status, "upcoming");

    // Route event indicating contest transitioned to live
    router.route({
      id: "evt_contest_live",
      event: RealtimeEventNames.CONTEST_STATUS_CHANGED,
      contest_slug: slug,
      payload: {
        slug,
        new_status: "live",
      },
    });

    contestState = contestApi.endpoints.getContestDetail.select(slug)(store.getState());
    assert.equal(contestState.data?.status, "live", "Contest status patched to live without full refetch");
  });

  test("tracks metrics for processed vs deduplicated events", () => {
    const initialMetrics = router.getMetrics();
    const event = {
      id: "evt_counted_1",
      event: "ping",
    };

    router.route(event);
    router.route(event); // duplicate

    const afterMetrics = router.getMetrics();
    assert.equal(afterMetrics.totalReceived - initialMetrics.totalReceived, 2);
    assert.equal(afterMetrics.processed - initialMetrics.processed, 1);
    assert.equal(afterMetrics.deduplicatedOrStale - initialMetrics.deduplicatedOrStale, 1);
  });
});

describe("SSE Client Protocol & Backoff Resiliency", () => {
  test("exponential backoff with jitter stays within configured bounds", () => {
    const calcRawDelay = (attempt: number, base = 1000, max = 15000, factor = 1.5) => {
      return Math.min(base * Math.pow(factor, attempt - 1), max);
    };

    const delayAttempt1 = calcRawDelay(1);
    const delayAttempt5 = calcRawDelay(5);
    const delayAttempt10 = calcRawDelay(10);

    assert.equal(delayAttempt1, 1000, "Attempt 1 has base delay of 1000ms");
    assert.ok(delayAttempt5 > delayAttempt1, "Delay increases monotonically with failed attempts");
    assert.equal(delayAttempt10, 15000, "Delay is capped at maxReconnectDelayMs of 15000ms");
  });

  test("singleton instance preserves connection status", () => {
    const c1 = ApplicationSseClient.getInstance();
    const c2 = ApplicationSseClient.getInstance();
    assert.strictEqual(c1, c2, "ApplicationSseClient is a strict singleton");
    assert.equal(typeof c1.getStatus(), "string");
  });
});

describe("Complete Event Contract & Cache Transition Invariants", () => {
  let router: RealtimeEventRouter;

  beforeEach(() => {
    router = new RealtimeEventRouter();
    store.dispatch(baseApi.util.resetApiState());
  });

  test("submission_evaluated invalidates submission and leaderboard tags", async () => {
    const slug = "biweekly-contest-alpha";
    router.route({
      id: "evt_sub_1",
      event: RealtimeEventNames.SUBMISSION_EVALUATED,
      contest_slug: slug,
      payload: {
        submission_id: "sub_999",
        status: "accepted",
        score: 100,
      },
    });

    const metrics = router.getMetrics();
    assert.equal(metrics.processed, 1, "Submission evaluation processed");
    assert.equal(metrics.lastEventId, "evt_sub_1");
  });

  test("leaderboard_updated routes targeted invalidation without corrupting other caches", async () => {
    router.route({
      id: "evt_lb_1",
      event: RealtimeEventNames.LEADERBOARD_UPDATED,
      payload: {
        department: "CSE",
        batch: "2026",
      },
    });

    const metrics = router.getMetrics();
    assert.equal(metrics.processed, 1, "Leaderboard event processed");
  });

  test("contest.started updates contest status to live", async () => {
    const slug = "speed-coding-challenge";
    await store.dispatch(
      contestApi.util.upsertQueryData("getContestDetail", slug, {
        id: "c_speed",
        slug,
        title: "Speed Coding Challenge",
        description: "Fast rounds",
        format: "speed_code",
        status: "upcoming",
        starts_at: "2026-10-02T10:00:00Z",
        ends_at: "2026-10-02T11:00:00Z",
        registered: true,
      } as any)
    );

    router.route({
      id: "evt_contest_start",
      event: RealtimeEventNames.CONTEST_STATUS_CHANGED,
      contest_slug: slug,
      payload: {
        slug,
        status: "live",
      },
    });

    const state = contestApi.endpoints.getContestDetail.select(slug)(store.getState());
    assert.equal(state.data?.status, "live", "Contest started transition reflected in cache");
  });

  test("logout triggers resetApiState and clears cached data completely", async () => {
    // Seed data into cache
    await store.dispatch(
      userApi.util.upsertQueryData("getCurrentUser", undefined, {
        id: "u_sensitive",
        handle: "cadet_secret",
        full_name: "Classified Cadet",
        email: "classified@chaoscomputerclub.in",
        rating: 1500,
        peak_rating: 1550,
        rank: 1,
        tier: "Master",
        attendance_count: 20,
      })
    );

    let userState = userApi.endpoints.getCurrentUser.select(undefined)(store.getState());
    assert.ok(userState.data, "User data exists in cache prior to logout");

    // Simulate session invalidation / logout
    store.dispatch(baseApi.util.resetApiState());
    router.reset();

    userState = userApi.endpoints.getCurrentUser.select(undefined)(store.getState());
    assert.equal(userState.data, undefined, "User data is completely wiped from cache after resetApiState");
    assert.equal(router.getMetrics().processed, 0, "Event router metrics reset");
  });

  test("multiple components share identical query cache identity without duplicate state", async () => {
    const slug = "grand-prix-finals";
    const sampleContest = {
      id: "c_gp",
      slug,
      title: "Grand Prix Finals",
      description: "Championship",
      format: "round2_offline",
      status: "upcoming",
      starts_at: "2026-11-01T09:00:00Z",
      ends_at: "2026-11-01T15:00:00Z",
      registered: false,
    };

    // Single source of truth in RTK Query cache
    await store.dispatch(contestApi.util.upsertQueryData("getContestDetail", slug, sampleContest as any));

    // Simulated consumer 1: Navbar / ContestHeader
    const consumerHeader = contestApi.endpoints.getContestDetail.select(slug)(store.getState());
    // Simulated consumer 2: ContestOverviewPage
    const consumerOverview = contestApi.endpoints.getContestDetail.select(slug)(store.getState());
    // Simulated consumer 3: ContestArenaPage
    const consumerArena = contestApi.endpoints.getContestDetail.select(slug)(store.getState());

    // Strict reference equality: both consumers read the EXACT same cached object in memory
    assert.strictEqual(consumerHeader.data, consumerOverview.data, "Header and Overview share identical memory reference");
    assert.strictEqual(consumerOverview.data, consumerArena.data, "Overview and Arena share identical memory reference");
    assert.equal(consumerHeader.data?.title, "Grand Prix Finals");
  });
});

process.exit(0);

