import React, { Suspense } from "react";
import { Routes, Route, Navigate, useParams, useLocation } from "react-router-dom";
import { PortalShell } from "@/organization/components/PortalShell";
import { AuthGuard, GuestGuard } from "@/lib/guards/AuthGuard";
import { AppShellSkeleton } from "@/components/TacticalRouteFallback";
import { lazyWithRetry } from "@/lib/lazyWithRetry";

export const AuthPage = lazyWithRetry(() => import("./pages/AuthPage"), "AuthPage");
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
export const VerifyProofPage = lazyWithRetry(() => import("./pages/VerifyProofPage"), "VerifyProofPage");
export const ProfilePage = lazyWithRetry(() => import("./pages/ProfilePage"), "ProfilePage");
export const SettingsPage = lazyWithRetry(() => import("./pages/SettingsPage"), "SettingsPage");

export const routePreloaders: Record<string, () => Promise<any>> = {
  "/": () => DashboardPage.preload(),
  "/contests": () => ContestsHubPage.preload(),
  "/my-contests": () => MyContestsPage.preload(),
  "/leaderboard": () => LeaderboardPage.preload(),
  "/problems": () => ProblemArchivePage.preload(),
  "/verify": () => VerifyProofPage.preload(),
  "/profile": () => ProfilePage.preload(),
  "/settings": () => SettingsPage.preload(),
};

export function prefetchRoute(path: string): void {
  const clean = path.replace(/\/+$/, "") || "/";
  const loader = routePreloaders[clean];
  if (loader) {
    loader().catch(() => {});
  }
}

function ProfileHandleRedirect() {
  const { handle } = useParams<{ handle: string }>();
  return <Navigate to={`/profile/${handle ? encodeURIComponent(handle) : ""}`} replace />;
}

function ContestRedirect() {
  const { contestSlug } = useParams<{ contestSlug: string }>();
  return <Navigate to={`/contests/${contestSlug ? encodeURIComponent(contestSlug) : ""}`} replace />;
}

function PortalLegacyRedirect() {
  const location = useLocation();
  const target = location.pathname.replace(/^\/portal/, "") || "/";
  return <Navigate to={`${target}${location.search}${location.hash}`} replace />;
}

export function AppRoutes() {
  return (
    <Suspense fallback={<AppShellSkeleton />}>
      <Routes>
        {/* Guest-only Authentication Route */}
        <Route element={<GuestGuard />}>
          <Route path="/auth" element={<AuthPage />} />
        </Route>

        {/* Backward-Compatible Redirects for /portal */}
        <Route path="/portal" element={<Navigate to="/" replace />} />
        <Route path="/portal/*" element={<PortalLegacyRedirect />} />

        {/* Strictly Protected Inner Platform Routes Mounted on Root (/) */}
        <Route element={<AuthGuard />}>
          {/* Assessment Workspace route redirected to contest flow */}
          <Route path="/assessments/:contestSlug" element={<ContestRedirect />} />

          {/* Root Shell Routes */}
          <Route path="/" element={<PortalShell />}>
            {/* Dashboard index */}
            <Route index element={<DashboardPage />} />

            {/* Contests Hub & Details */}
            <Route path="contests" element={<ContestsHubPage />} />
            <Route path="contests/:contestSlug" element={<ContestOverviewPage />} />
            <Route path="contests/:contestSlug/lobby" element={<ContestLobbyPage />} />
            <Route path="contests/:contestSlug/problems/:problemSlug" element={<ContestArenaPage />} />
            <Route path="contests/:contestSlug/problems" element={<ContestArenaPage />} />
            <Route path="contests/:contestSlug/arena" element={<ContestArenaPage />} />
            <Route path="contests/:contestSlug/summary" element={<ContestSummaryPage />} />
            <Route path="contests/:contestSlug/submit" element={<ContestSummaryPage />} />
            <Route path="contests/:contestSlug/assessment" element={<ContestRedirect />} />
            <Route path="contests/:contestSlug/offline" element={<ContestRedirect />} />
            <Route path="contests/:contestSlug/qualified" element={<ContestRedirect />} />
            <Route path="contests/:contestSlug/results" element={<ContestResultsPage />} />
            <Route path="contests/:contestSlug/final-results" element={<ContestFinalResultsPage />} />

            {/* My Contests Ledger */}
            <Route path="my-contests" element={<MyContestsPage />} />

            {/* University Leaderboard */}
            <Route path="leaderboard" element={<LeaderboardPage />} />

            {/* Problem Archive & Editorials */}
            <Route path="problems" element={<ProblemArchivePage />} />
            <Route path="problems/:problemSlug" element={<ProblemDetailPage />} />

            {/* Cryptographic Result Verification */}
            <Route path="verify" element={<VerifyProofPage />} />

            {/* Member & Student Profiles */}
            <Route path="profile" element={<ProfilePage />} />
            <Route path="profile/:handle" element={<ProfilePage />} />
            <Route path="u/:handle" element={<ProfilePage />} />

            {/* Account & Security Settings */}
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>

        {/* Direct Shortlink for Profiles: /u/:handle */}
        <Route path="/u/:handle" element={<ProfileHandleRedirect />} />

        {/* Catch-all fallback to root */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
