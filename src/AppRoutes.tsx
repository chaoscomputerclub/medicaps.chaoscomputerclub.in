import React, { Suspense, useEffect } from "react";
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
import type { Member } from "@/lib/auth";
import {
  fetchContestDetailThunk,
  fetchCampusPassThunk,
  removeContestFromState,
  applyRealtimeEvent,
} from "@/store/slices/contestSlice";
import { syncSocialCounts, syncCadetSocialCounts } from "@/store/slices/socialSlice";
import { invalidateSwrCache } from "@/lib/cache/swrCache";
import { useRealtimeSync } from "@/realtime";
import type { ServerEventEnvelope } from "@/realtime/eventTypes";
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

function ContestRealtimeSynchronizer() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const currentContestSlugRef = React.useRef<string | undefined>(undefined);
  const currentMemberRef = React.useRef<Member | null>(null);

  const currentContestSlug = useAppSelector((state) => state.contest.currentContest?.slug);
  const currentMember = useAppSelector((state) => state.auth.member);

  // Keep refs in sync so the stable event handler always sees the latest values
  currentContestSlugRef.current = currentContestSlug;
  currentMemberRef.current = currentMember as any;

  useEffect(() => {
    /**
     * Listen to ccc:realtime_event — the window bridge already broadcast by globalEventRouter.route().
     * This guarantees ZERO additional EventSource connections; RTK Query cache invalidation
     * from the router handles data refetching. This synchronizer handles only legacy Redux
     * slice mutations, SWR cache invalidation, social count sync, and navigation side-effects
     * that RTK Query cannot express as tag invalidations.
     */
    const handleCccEvent = (e: Event) => {
      const event = (e as CustomEvent).detail as ServerEventEnvelope;
      if (!event?.event) return;

      const eventName = event.event;
      if (!CONTEST_MUTATION_EVENTS.includes(eventName)) return;

      const contestSlug = event.contest_slug ?? (event.data as any)?.contest_slug ?? (event.payload as any)?.contest_slug;
      const member = currentMemberRef.current;

      // 1. Apply real-time mutation to synchronous Redux contestSlice state
      dispatch(applyRealtimeEvent({ event: event as any, currentMember: member }));

      if (member) {
        // 2. Sync SWR cache patterns that RTK Query doesn't cover
        if (
          eventName === "contest_concluded" ||
          eventName === "contest_finished" ||
          eventName === "contest_status_changed" ||
          eventName === "assessment_finished" ||
          eventName === "leaderboard_updated" ||
          eventName === "ratings_updated" ||
          eventName === "member_profile_updated"
        ) {
          invalidateSwrCache("leaderboard:*");
          invalidateSwrCache("student:profile:*");
          invalidateSwrCache("member:profile:*");

          // 3. Social count sync for profile events (RTK Query can't dispatch Redux socialSlice)
          if (eventName === "member_profile_updated" && event.data) {
            const d = event.data as any;
            const isTargetMe =
              (d.member_id && member.id === d.member_id) ||
              (d.handle && member.handle?.toLowerCase() === d.handle.toLowerCase());
            const isFollowerMe =
              (d.follower_id && member.id === d.follower_id) ||
              (d.follower_handle && member.handle?.toLowerCase() === d.follower_handle.toLowerCase());

            if (isTargetMe && typeof d.followers_count === "number") {
              dispatch(syncSocialCounts({ followersCount: d.followers_count, followingCount: d.following_count }));
            } else if (d.handle || d.member_id) {
              dispatch(syncCadetSocialCounts({ handleOrId: d.handle || d.member_id, followersCount: d.followers_count, followingCount: d.following_count }));
            }
            if (isFollowerMe && typeof d.my_following_count === "number") {
              dispatch(syncSocialCounts({ followingCount: d.my_following_count }));
            }
          }
        }
      }

      // 4. Navigation side-effects for currently-viewed contest
      const activeSlug = currentContestSlugRef.current;
      if (!contestSlug || contestSlug !== activeSlug) return;
      if (eventName === "contest_deleted") {
        dispatch(removeContestFromState(contestSlug));
        navigate("/contests", { replace: true });
        return;
      }
      void dispatch(fetchContestDetailThunk({ slug: contestSlug, force: true }));
      if (
        eventName === "pass_checked_in" ||
        eventName === "top30_qualified" ||
        eventName === "contest_status_changed"
      ) {
        void dispatch(fetchCampusPassThunk(contestSlug));
      }
    };

    window.addEventListener("ccc:realtime_event", handleCccEvent);
    return () => window.removeEventListener("ccc:realtime_event", handleCccEvent);
  }, [dispatch, navigate]); // dispatch and navigate are stable refs

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
export const LandingHomePage = lazyWithRetry(() => import("./pages/LandingHomePage"), "LandingHomePage");
export const PrivacyPage = lazyWithRetry(() => import("./pages/PrivacyPage"), "PrivacyPage");
export const DataDeletionPage = lazyWithRetry(() => import("./pages/DataDeletionPage"), "DataDeletionPage");
export const AboutPage = lazyWithRetry(() => import("./pages/AboutPage"), "AboutPage");
export const ContactPage = lazyWithRetry(() => import("./pages/ContactPage"), "ContactPage");

export const routePreloaders: Record<string, () => Promise<any>> = {
  "/": () => LandingHomePage.preload(),
  "/privacy": () => PrivacyPage.preload(),
  "/terms": () => TermsPage.preload(),
  "/data-deletion": () => DataDeletionPage.preload(),
  "/about": () => AboutPage.preload(),
  "/contact": () => ContactPage.preload(),
  "/dashboard": () => DashboardPage.preload(),
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
  "/dashboard": () => {
    getMemberProfileData().catch(() => {});
    getPublicPortalData().catch(() => {});
  },
  "/contests": () => {
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
  const target = location.pathname.replace(/^\/portal/, "") || "/dashboard";
  return <Navigate to={`${target}${location.search}${location.hash}`} replace />;
}

export function AppRoutes() {
  // Mount the global delegated prefetch listener once — covers every <a> in the app
  usePrefetchOnIntent();
  // Centralized Application-Level Realtime SSE Connection & RTK Query Cache Sync
  useRealtimeSync();

  return (
    <>
      <ContestRealtimeSynchronizer />
      <Routes>
      {/* ── Public Informational & Legal Routes (Accessible without Authentication) ── */}
      <Route
        path="/"
        element={
          <Suspense fallback={<div className="min-h-screen bg-black" />}>
            <LandingHomePage />
          </Suspense>
        }
      />
      <Route
        path="/privacy"
        element={
          <Suspense fallback={<div className="min-h-screen bg-black" />}>
            <PrivacyPage />
          </Suspense>
        }
      />
      <Route
        path="/terms"
        element={
          <Suspense fallback={<div className="min-h-screen bg-black" />}>
            <TermsPage />
          </Suspense>
        }
      />
      <Route
        path="/data-deletion"
        element={
          <Suspense fallback={<div className="min-h-screen bg-black" />}>
            <DataDeletionPage />
          </Suspense>
        }
      />
      <Route
        path="/about"
        element={
          <Suspense fallback={<div className="min-h-screen bg-black" />}>
            <AboutPage />
          </Suspense>
        }
      />
      <Route
        path="/contact"
        element={
          <Suspense fallback={<div className="min-h-screen bg-black" />}>
            <ContactPage />
          </Suspense>
        }
      />

      {/* Guest-only Authentication Route — redirects to /dashboard if already logged in */}
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

      {/* Backward-Compatible Redirects for /portal */}
      <Route path="/portal" element={<Navigate to="/dashboard" replace />} />
      <Route path="/portal/*" element={<PortalLegacyRedirect />} />

      {/* Direct Shortlink for Profiles: /u/:handle */}
      <Route path="/u/:handle" element={<ProfileHandleRedirect />} />

      {/* ── Strictly Protected Inner Platform Routes (Require Active Authentication) ── */}
      <Route element={<AuthGuard />}>
        {/* Assessment Workspace route redirected to contest flow */}
        <Route path="/assessments/:contestSlug" element={<ContestRedirect />} />

        {/* Portal Shell Route — Layout shell wrapping all authenticated member workspace views */}
        <Route element={<PortalShell />}>
          {/* Member Dashboard */}
          <Route
            path="/dashboard"
            element={
              <Suspense fallback={<DashboardSkeleton />}>
                <DashboardPage />
              </Suspense>
            }
          />

          {/* Contests Hub & Details */}
          <Route
            path="/contests"
            element={
              <Suspense fallback={<ContestsHubSkeleton />}>
                <ContestsHubPage />
              </Suspense>
            }
          />
          <Route
            path="/contests/:contestSlug"
            element={
              <Suspense fallback={<ContestDetailSkeleton />}>
                <ContestOverviewPage />
              </Suspense>
            }
          />
          <Route
            path="/contests/:contestSlug/lobby"
            element={
              <Suspense fallback={<ContestLobbySkeleton />}>
                <ContestLobbyPage />
              </Suspense>
            }
          />
          <Route
            path="/contests/:contestSlug/problems/:problemSlug"
            element={
              <Suspense fallback={<AssessmentStudioSkeleton />}>
                <ContestArenaPage />
              </Suspense>
            }
          />
          <Route
            path="/contests/:contestSlug/problems"
            element={
              <Suspense fallback={<AssessmentStudioSkeleton />}>
                <ContestArenaPage />
              </Suspense>
            }
          />
          <Route
            path="/contests/:contestSlug/arena"
            element={
              <Suspense fallback={<AssessmentStudioSkeleton />}>
                <ContestArenaPage />
              </Suspense>
            }
          />
          <Route
            path="/contests/:contestSlug/summary"
            element={
              <Suspense fallback={<ContestSummarySkeleton />}>
                <ContestSummaryPage />
              </Suspense>
            }
          />
          <Route
            path="/contests/:contestSlug/submit"
            element={
              <Suspense fallback={<ContestSummarySkeleton />}>
                <ContestSummaryPage />
              </Suspense>
            }
          />
          <Route path="/contests/:contestSlug/assessment" element={<ContestRedirect />} />
          <Route path="/contests/:contestSlug/offline" element={<ContestResultsRedirect />} />
          <Route path="/contests/:contestSlug/qualified" element={<ContestResultsRedirect />} />
          <Route path="/contests/:contestSlug/final-results" element={<ContestResultsRedirect />} />
          <Route
            path="/contests/:contestSlug/results"
            element={
              <Suspense fallback={<ContestResultsSkeleton />}>
                <ContestResultsPage />
              </Suspense>
            }
          />

          {/* My Contests Ledger */}
          <Route
            path="/my-contests"
            element={
              <Suspense fallback={<MyContestsSkeleton />}>
                <MyContestsPage />
              </Suspense>
            }
          />

          {/* University Leaderboard */}
          <Route
            path="/leaderboard"
            element={
              <Suspense fallback={<LeaderboardSkeleton />}>
                <LeaderboardPage />
              </Suspense>
            }
          />

          {/* Problem Archive & Editorials */}
          <Route
            path="/problems"
            element={
              <Suspense fallback={<ProblemArchiveSkeleton />}>
                <ProblemArchivePage />
              </Suspense>
            }
          />
          <Route
            path="/problems/:problemSlug"
            element={
              <Suspense fallback={<ProblemDetailSkeleton />}>
                <ProblemDetailPage />
              </Suspense>
            }
          />

          {/* Deprecated Proof Verification route redirects to Dashboard */}
          <Route path="/verify" element={<Navigate to="/dashboard" replace />} />

          {/* Member & Student Profiles */}
          <Route
            path="/profile"
            element={
              <Suspense fallback={<ProfileSkeleton />}>
                <ProfilePage />
              </Suspense>
            }
          />
          <Route
            path="/profile/:handle"
            element={
              <Suspense fallback={<ProfileSkeleton />}>
                <ProfilePage />
              </Suspense>
            }
          />

          {/* Account & Security Settings */}
          <Route
            path="/settings"
            element={
              <Suspense fallback={<SettingsSkeleton />}>
                <SettingsPage />
              </Suspense>
            }
          />
        </Route>
      </Route>

      {/* Catch-all fallback to public homepage */}
      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
