import React, { Suspense, useEffect, useRef } from "react";
import { Routes, Route, Navigate, useParams, useLocation, useNavigate } from "react-router-dom";
import { getPublicPortalData, getMemberProfileData, getUniversityLeaderboardData, getStudentProfileData } from "@/organization/data/portal.functions";
import { contestApi } from "@/features/contest/api";
import { AuthGuard, GuestGuard } from "@/lib/guards/AuthGuard";
import { usePrefetchOnIntent } from "@/hooks/usePrefetchOnIntent";
import {
  DashboardSkeleton,
  ContestsHubSkeleton,
  ContestDetailSkeleton,
  ContestLobbySkeleton,
  AssessmentStudioSkeleton,
  ContestSummarySkeleton,
  ContestResultsSkeleton,
  ContestFinalResultsSkeleton,
  MyContestsSkeleton,
  LeaderboardSkeleton,
  ProblemArchiveSkeleton,
  ProblemDetailSkeleton,
  ProfileSkeleton,
  SettingsSkeleton,
  AuthSkeleton,
} from "@/organization/components/skeletons";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { PortalShell } from "@/organization/components/PortalShell";
import { AuthPage } from "./pages/AuthPage";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchCurrentUserThunk } from "@/store/slices/authSlice";
import {
  fetchContestDetailThunk,
  fetchContestsThunk,
  fetchCampusPassThunk,
  fetchMyParticipationsThunk,
  removeContestFromState,
  applyRealtimeEvent,
} from "@/store/slices/contestSlice";
import { syncSocialCounts, syncCadetSocialCounts } from "@/store/slices/socialSlice";
import { useRealtimeEvents } from "@/lib/realtime";
import { invalidateSwrCache } from "@/lib/cache/swrCache";

const CONTEST_MUTATION_EVENTS = [
  "contest_created",
  "contest_updated",
  "contest_deleted",
  "contest_status_changed",
  "contest_concluded",
  "contest_finished",
  "contest_timer_reset",
  "contest_registered",
  "contest_unregistered",
  "pass_checked_in",
  "assessment_finished",
  "submission_evaluated",
  "top30_qualified",
  "leaderboard_updated",
  "ratings_updated",
  "member_profile_updated",
];

const CONTEST_LIST_REFRESH_EVENTS = [
  "contest_created",
  "contest_updated",
  "contest_deleted",
  "contest_status_changed",
  "contest_concluded",
  "contest_finished",
];

const PARTICIPATION_REFRESH_EVENTS = [
  "contest_registered",
  "contest_unregistered",
  "contest_concluded",
  "contest_finished",
];

const CONTEST_DETAIL_REFRESH_EVENTS = [
  "contest_updated",
  "contest_status_changed",
  "contest_concluded",
  "contest_finished",
  "contest_timer_reset",
  "assessment_finished",
];

function ContestRealtimeSynchronizer() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const currentContestSlug = useAppSelector((state) => state.contest.currentContest?.slug);
  const currentMember = useAppSelector((state) => state.auth.member);

  const debounceTimers = useRef<{
    contests?: ReturnType<typeof setTimeout>;
    participations?: ReturnType<typeof setTimeout>;
    detail?: ReturnType<typeof setTimeout>;
    user?: ReturnType<typeof setTimeout>;
  }>({});

  useEffect(() => {
    return () => {
      if (debounceTimers.current.contests) clearTimeout(debounceTimers.current.contests);
      if (debounceTimers.current.participations) clearTimeout(debounceTimers.current.participations);
      if (debounceTimers.current.detail) clearTimeout(debounceTimers.current.detail);
      if (debounceTimers.current.user) clearTimeout(debounceTimers.current.user);
    };
  }, []);

  useRealtimeEvents(
    null,
    (event) => {
      if (!CONTEST_MUTATION_EVENTS.includes(event.event)) return;

      const contestSlug = event.contest_slug ?? event.data?.contest_slug;

      // 1. Immediately apply real-time mutation to synchronous Redux state
      dispatch(applyRealtimeEvent({ event, currentMember }));

      // 2. Refresh global contests list if contest lifecycle changed (debounced 500ms)
      if (CONTEST_LIST_REFRESH_EVENTS.includes(event.event)) {
        if (debounceTimers.current.contests) clearTimeout(debounceTimers.current.contests);
        debounceTimers.current.contests = setTimeout(() => {
          void dispatch(fetchContestsThunk(true));
        }, 500);
      }

      // 3. Refresh user participation history if registration or conclusion changed (debounced 500ms)
      if (currentMember && PARTICIPATION_REFRESH_EVENTS.includes(event.event)) {
        if (debounceTimers.current.participations) clearTimeout(debounceTimers.current.participations);
        debounceTimers.current.participations = setTimeout(() => {
          void dispatch(fetchMyParticipationsThunk(true));
        }, 500);
      }

      // 4. Invalidate profile / leaderboard caches and refresh current user if relevant
      if (
        event.event === "contest_concluded" ||
        event.event === "contest_finished" ||
        event.event === "contest_status_changed" ||
        event.event === "assessment_finished" ||
        event.event === "leaderboard_updated" ||
        event.event === "ratings_updated" ||
        event.event === "member_profile_updated"
      ) {
        invalidateSwrCache("leaderboard:*");
        invalidateSwrCache("student:profile:*");
        invalidateSwrCache("member:profile:*");
        if (currentMember) {
          if (debounceTimers.current.user) clearTimeout(debounceTimers.current.user);
          debounceTimers.current.user = setTimeout(() => {
            void dispatch(fetchCurrentUserThunk());
          }, 600);
        }

        if (event.event === "member_profile_updated" && event.data) {
          const isTargetMe =
            (event.data.member_id && currentMember?.id === event.data.member_id) ||
            (event.data.handle && currentMember?.handle?.toLowerCase() === event.data.handle.toLowerCase());
          const isFollowerMe =
            (event.data.follower_id && currentMember?.id === event.data.follower_id) ||
            (event.data.follower_handle && currentMember?.handle?.toLowerCase() === event.data.follower_handle.toLowerCase());

          if (isTargetMe && typeof event.data.followers_count === "number") {
            dispatch(
              syncSocialCounts({
                followersCount: event.data.followers_count,
                followingCount: event.data.following_count,
              })
            );
          } else if (event.data.handle || event.data.member_id) {
            const targetKey = event.data.handle || event.data.member_id;
            dispatch(
              syncCadetSocialCounts({
                handleOrId: targetKey,
                followersCount: event.data.followers_count,
                followingCount: event.data.following_count,
              })
            );
          }

          if (isFollowerMe && typeof event.data.my_following_count === "number") {
            dispatch(
              syncSocialCounts({
                followingCount: event.data.my_following_count,
              })
            );
          }
        }
      }

      // 5. Handle route or detail sync if user is currently viewing the affected contest
      if (!contestSlug || contestSlug !== currentContestSlug) return;
      if (event.event === "contest_deleted") {
        dispatch(removeContestFromState(contestSlug));
        navigate("/contests", { replace: true });
        return;
      }

      if (CONTEST_DETAIL_REFRESH_EVENTS.includes(event.event)) {
        if (debounceTimers.current.detail) clearTimeout(debounceTimers.current.detail);
        debounceTimers.current.detail = setTimeout(() => {
          void dispatch(fetchContestDetailThunk({ slug: contestSlug, force: true }));
        }, 400);
      }

      // Targeted pass refresh: only fetch pass when relevant to the current user
      if (event.event === "pass_checked_in") {
        const isTargetMe =
          (event.data?.member_id && currentMember?.id === event.data.member_id) ||
          (event.data?.handle && currentMember?.handle?.toLowerCase() === event.data.handle.toLowerCase());
        if (isTargetMe) {
          void dispatch(fetchCampusPassThunk(contestSlug));
        }
      } else if (event.event === "top30_qualified") {
        const isMeQualified = Array.isArray(event.data?.qualifiers)
          ? event.data.qualifiers.some((q: any) => q.handle?.toLowerCase() === currentMember?.handle?.toLowerCase())
          : false;
        if (isMeQualified) {
          void dispatch(fetchCampusPassThunk(contestSlug));
        }
      } else if (event.event === "contest_status_changed") {
        void dispatch(fetchCampusPassThunk(contestSlug));
      }
    },
    CONTEST_MUTATION_EVENTS,
    true
  );

  return null;
}

export { PortalShell };

export const DashboardPage = lazyWithRetry(() => import("./pages/DashboardPage"), "DashboardPage");
export const ContestsHubPage = lazyWithRetry(() => import("./pages/ContestsHubPage"), "ContestsHubPage");
export const ContestOverviewPage = lazyWithRetry(() => import("./pages/ContestOverviewPage"), "ContestOverviewPage");
export const ContestLobbyPage = lazyWithRetry(() => import("./pages/ContestLobbyPage"), "ContestLobbyPage");
export const ContestArenaPage = lazyWithRetry(() => import("./pages/ContestArenaPage"), "ContestArenaPage");
export const ContestSummaryPage = lazyWithRetry(() => import("./pages/ContestSummaryPage"), "ContestSummaryPage");
export const ContestOfflinePage = lazyWithRetry(() => import("./pages/ContestOfflinePage"), "ContestOfflinePage");
export const ContestQualifiedPage = lazyWithRetry(() => import("./pages/ContestQualifiedPage"), "ContestQualifiedPage");
export const ContestResultsPage = lazyWithRetry(() => import("./pages/ContestResultsPage"), "ContestResultsPage");
export const ContestFinalResultsPage = lazyWithRetry(() => import("./pages/ContestFinalResultsPage"), "ContestFinalResultsPage");
export const AssessmentWorkspacePage = lazyWithRetry(() => import("./pages/AssessmentWorkspacePage"), "AssessmentWorkspacePage");
export const MyContestsPage = lazyWithRetry(() => import("./pages/MyContestsPage"), "MyContestsPage");
export const LeaderboardPage = lazyWithRetry(() => import("./pages/LeaderboardPage"), "LeaderboardPage");
export const ProblemArchivePage = lazyWithRetry(() => import("./pages/ProblemArchivePage"), "ProblemArchivePage");
export const ProblemDetailPage = lazyWithRetry(() => import("./pages/ProblemDetailPage"), "ProblemDetailPage");
export const ProfilePage = lazyWithRetry(() => import("./pages/ProfilePage"), "ProfilePage");
export const SettingsPage = lazyWithRetry(() => import("./pages/SettingsPage"), "SettingsPage");
export const TermsPage = lazyWithRetry(() => import("./pages/TermsPage"), "TermsPage");

export const routePreloaders: Record<string, () => Promise<any>> = {
  "/": () => DashboardPage.preload(),
  "/contests": () => ContestsHubPage.preload(),
  "/my-contests": () => MyContestsPage.preload(),
  "/leaderboard": () => LeaderboardPage.preload(),
  "/problems": () => ProblemArchivePage.preload(),
  "/profile": () => ProfilePage.preload(),
  "/settings": () => SettingsPage.preload(),
};

/**
 * SWR data prefetchers per route — fires before navigation so pages render
 * instantly from cache instead of showing a skeleton on first visit.
 */
const routeDataPrefetchers: Record<string, () => void> = {
  "/contests": () => {
    getPublicPortalData().catch(() => {});
  },
  "/": () => {
    getMemberProfileData().catch(() => {});
    getPublicPortalData().catch(() => {});
  },
  "/leaderboard": () => {
    getUniversityLeaderboardData().catch(() => {});
  },
  "/my-contests": () => {
    contestApi.list().catch(() => {});
    getMemberProfileData().catch(() => {});
  },
  "/profile": () => {
    getMemberProfileData().catch(() => {});
  },
};

/**
 * Prefetch a route's JS chunk AND SWR data simultaneously.
 * Call on mouseenter / touchstart / focus — before the actual click.
 * Uses in-flight deduplication so concurrent calls are free.
 */
export function prefetchRoute(path: string): void {
  const clean = path.replace(/\/+$/, "") || "/";

  // 1. Preload the lazy JS chunk
  const loader = routePreloaders[clean];
  if (loader) loader().catch(() => {});

  // 2. Prime the SWR data cache for the target page
  const dataPrefetcher = routeDataPrefetchers[clean];
  if (dataPrefetcher) dataPrefetcher();
}

/**
 * Prefetch data for a dynamic contest page (overview, lobby, results).
 * Fire on hover/touch of any contest card or link before the user clicks.
 */
export function prefetchContestRoute(slug: string, variant: "overview" | "lobby" | "results" = "overview"): void {
  if (!slug) return;

  // Preload the right JS chunk
  if (variant === "lobby") {
    ContestLobbyPage.preload().catch(() => {});
  } else if (variant === "results") {
    ContestResultsPage.preload().catch(() => {});
  } else {
    ContestOverviewPage.preload().catch(() => {});
  }

  // Prime all data the contest page needs
  contestApi.detail(slug).catch(() => {});
  contestApi.registrationStatus(slug).catch(() => {});
  if (variant === "results") {
    contestApi.finalStandings(slug).catch(() => {});
  }
}

/**
 * Prefetch a student profile by handle — fires before the user lands on /profile/:handle.
 */
export function prefetchProfileRoute(handle: string): void {
  if (!handle) return;
  ProfilePage.preload().catch(() => {});
  getStudentProfileData(handle).catch(() => {});
}

function ProfileHandleRedirect() {
  const { handle } = useParams<{ handle: string }>();
  return <Navigate to={`/profile/${handle ? encodeURIComponent(handle) : ""}`} replace />;
}

function ContestRedirect() {
  const { contestSlug } = useParams<{ contestSlug: string }>();
  return <Navigate to={`/contests/${contestSlug ? encodeURIComponent(contestSlug) : ""}`} replace />;
}

function ContestResultsRedirect() {
  const { contestSlug } = useParams<{ contestSlug: string }>();
  return <Navigate to={`/contests/${contestSlug ? encodeURIComponent(contestSlug) : ""}/results`} replace />;
}

function PortalLegacyRedirect() {
  const location = useLocation();
  const target = location.pathname.replace(/^\/portal/, "") || "/";
  return <Navigate to={`${target}${location.search}${location.hash}`} replace />;
}

export function AppRoutes() {
  // Mount the global delegated prefetch listener once — covers every <a> in the app
  usePrefetchOnIntent();

  return (
    <>
      <ContestRealtimeSynchronizer />
      <Routes>
      {/* Guest-only Authentication Route — immediate, zero secondary network waterfall */}
      <Route element={<GuestGuard />}>
        <Route
          path="/auth"
          element={
            <Suspense fallback={<AuthSkeleton />}>
              <AuthPage />
            </Suspense>
          }
        />
      </Route>

      {/* Standalone Legal & Governance Pages (No navbar, no shell) */}
      <Route
        path="/terms"
        element={
          <Suspense fallback={<div className="min-h-screen bg-black" />}>
            <TermsPage />
          </Suspense>
        }
      />

      {/* Backward-Compatible Redirects for /portal */}
      <Route path="/portal" element={<Navigate to="/" replace />} />
      <Route path="/portal/*" element={<PortalLegacyRedirect />} />

      {/* Strictly Protected Inner Platform Routes Mounted on Root (/) */}
      <Route element={<AuthGuard />}>
        {/* Assessment Workspace route redirected to contest flow */}
        <Route path="/assessments/:contestSlug" element={<ContestRedirect />} />

        {/* Root Shell Route — Statically mounted shell with independent route suspenses */}
        <Route path="/" element={<PortalShell />}>
          {/* Dashboard index */}
          <Route
            index
            element={
              <Suspense fallback={<DashboardSkeleton />}>
                <DashboardPage />
              </Suspense>
            }
          />

          {/* Contests Hub & Details */}
          <Route
            path="contests"
            element={
              <Suspense fallback={<ContestsHubSkeleton />}>
                <ContestsHubPage />
              </Suspense>
            }
          />
          <Route
            path="contests/:contestSlug"
            element={
              <Suspense fallback={<ContestDetailSkeleton />}>
                <ContestOverviewPage />
              </Suspense>
            }
          />
          <Route
            path="contests/:contestSlug/lobby"
            element={
              <Suspense fallback={<ContestLobbySkeleton />}>
                <ContestLobbyPage />
              </Suspense>
            }
          />
          <Route
            path="contests/:contestSlug/problems/:problemSlug/review"
            element={
              <Suspense fallback={<AssessmentStudioSkeleton />}>
                <ContestArenaPage mode="review" />
              </Suspense>
            }
          />
          <Route
            path="contests/:contestSlug/problems/review"
            element={
              <Suspense fallback={<AssessmentStudioSkeleton />}>
                <ContestArenaPage mode="review" />
              </Suspense>
            }
          />
          <Route
            path="contests/:contestSlug/problems/:problemSlug"
            element={
              <Suspense fallback={<AssessmentStudioSkeleton />}>
                <ContestArenaPage />
              </Suspense>
            }
          />
          <Route
            path="contests/:contestSlug/problems"
            element={
              <Suspense fallback={<AssessmentStudioSkeleton />}>
                <ContestArenaPage />
              </Suspense>
            }
          />
          <Route
            path="contests/:contestSlug/arena"
            element={
              <Suspense fallback={<AssessmentStudioSkeleton />}>
                <ContestArenaPage />
              </Suspense>
            }
          />
          <Route
            path="contests/:contestSlug/summary"
            element={
              <Suspense fallback={<ContestSummarySkeleton />}>
                <ContestSummaryPage />
              </Suspense>
            }
          />
          <Route
            path="contests/:contestSlug/submit"
            element={
              <Suspense fallback={<ContestSummarySkeleton />}>
                <ContestSummaryPage />
              </Suspense>
            }
          />
          <Route path="contests/:contestSlug/assessment" element={<ContestRedirect />} />
          <Route path="contests/:contestSlug/offline" element={<ContestResultsRedirect />} />
          <Route path="contests/:contestSlug/qualified" element={<ContestResultsRedirect />} />
          <Route path="contests/:contestSlug/final-results" element={<ContestResultsRedirect />} />
          <Route
            path="contests/:contestSlug/results"
            element={
              <Suspense fallback={<ContestResultsSkeleton />}>
                <ContestResultsPage />
              </Suspense>
            }
          />

          {/* My Contests Ledger */}
          <Route
            path="my-contests"
            element={
              <Suspense fallback={<MyContestsSkeleton />}>
                <MyContestsPage />
              </Suspense>
            }
          />

          {/* University Leaderboard */}
          <Route
            path="leaderboard"
            element={
              <Suspense fallback={<LeaderboardSkeleton />}>
                <LeaderboardPage />
              </Suspense>
            }
          />

          {/* Problem Archive & Editorials */}
          <Route
            path="problems"
            element={
              <Suspense fallback={<ProblemArchiveSkeleton />}>
                <ProblemArchivePage />
              </Suspense>
            }
          />
          <Route
            path="problems/:problemSlug"
            element={
              <Suspense fallback={<ProblemDetailSkeleton />}>
                <ProblemDetailPage />
              </Suspense>
            }
          />

          {/* Deprecated Proof Verification route redirects to Dashboard */}
          <Route path="verify" element={<Navigate to="/" replace />} />

          {/* Member & Student Profiles */}
          <Route
            path="profile"
            element={
              <Suspense fallback={<ProfileSkeleton />}>
                <ProfilePage />
              </Suspense>
            }
          />
          <Route
            path="profile/:handle"
            element={
              <Suspense fallback={<ProfileSkeleton />}>
                <ProfilePage />
              </Suspense>
            }
          />
          <Route path="u/:handle" element={<ProfileHandleRedirect />} />

          {/* Account & Security Settings */}
          <Route
            path="settings"
            element={
              <Suspense fallback={<SettingsSkeleton />}>
                <SettingsPage />
              </Suspense>
            }
          />
        </Route>
      </Route>

      {/* Direct Shortlink for Profiles: /u/:handle */}
      <Route path="/u/:handle" element={<ProfileHandleRedirect />} />

      {/* Catch-all fallback to root */}
      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
