import React, { Suspense } from "react";
import { Routes, Route, Navigate, useParams } from "react-router-dom";
import { PortalShell } from "@/organization/components/PortalShell";
import { AuthGuard, GuestGuard } from "@/lib/guards/AuthGuard";
import { TacticalRouteFallback } from "@/components/TacticalRouteFallback";
import { lazyWithRetry } from "@/lib/lazyWithRetry";

// Dynamic Route Code-Splitting Chunks with Automated Retry & Invalidation Recovery
const AuthPage = lazyWithRetry(() => import("./pages/AuthPage"), "AuthPage");
const DashboardPage = lazyWithRetry(() => import("./pages/DashboardPage"), "DashboardPage");
const ContestsHubPage = lazyWithRetry(() => import("./pages/ContestsHubPage"), "ContestsHubPage");
const ContestOverviewPage = lazyWithRetry(() => import("./pages/ContestOverviewPage"), "ContestOverviewPage");
const ContestLobbyPage = lazyWithRetry(() => import("./pages/ContestLobbyPage"), "ContestLobbyPage");
const ContestArenaPage = lazyWithRetry(() => import("./pages/ContestArenaPage"), "ContestArenaPage");
const ContestOfflinePage = lazyWithRetry(() => import("./pages/ContestOfflinePage"), "ContestOfflinePage");
const ContestQualifiedPage = lazyWithRetry(() => import("./pages/ContestQualifiedPage"), "ContestQualifiedPage");
const ContestResultsPage = lazyWithRetry(() => import("./pages/ContestResultsPage"), "ContestResultsPage");
const ContestFinalResultsPage = lazyWithRetry(() => import("./pages/ContestFinalResultsPage"), "ContestFinalResultsPage");
const AssessmentWorkspacePage = lazyWithRetry(() => import("./pages/AssessmentWorkspacePage"), "AssessmentWorkspacePage");
const MyContestsPage = lazyWithRetry(() => import("./pages/MyContestsPage"), "MyContestsPage");
const LeaderboardPage = lazyWithRetry(() => import("./pages/LeaderboardPage"), "LeaderboardPage");
const ProblemArchivePage = lazyWithRetry(() => import("./pages/ProblemArchivePage"), "ProblemArchivePage");
const ProblemDetailPage = lazyWithRetry(() => import("./pages/ProblemDetailPage"), "ProblemDetailPage");
const VerifyProofPage = lazyWithRetry(() => import("./pages/VerifyProofPage"), "VerifyProofPage");
const ProfilePage = lazyWithRetry(() => import("./pages/ProfilePage"), "ProfilePage");
const SettingsPage = lazyWithRetry(() => import("./pages/SettingsPage"), "SettingsPage");

function ProfileHandleRedirect() {
  const { handle } = useParams<{ handle: string }>();
  return <Navigate to={`/portal/profile/${handle ? encodeURIComponent(handle) : ""}`} replace />;
}

function ContestRedirect() {
  const { contestSlug } = useParams<{ contestSlug: string }>();
  return <Navigate to={`/portal/contests/${contestSlug ? encodeURIComponent(contestSlug) : ""}`} replace />;
}

export function AppRoutes() {
  return (
    <Suspense fallback={<TacticalRouteFallback />}>
      <Routes>
        {/* Root redirect */}
        <Route path="/" element={<Navigate to="/portal" replace />} />

        {/* Guest-only Authentication Route */}
        <Route element={<GuestGuard />}>
          <Route path="/auth" element={<AuthPage />} />
        </Route>

        {/* Strictly Protected Inner Platform Routes */}
        <Route element={<AuthGuard />}>
          {/* Assessment Workspace route redirected to contest flow */}
          <Route path="/assessments/:contestSlug" element={<ContestRedirect />} />

          {/* Portal Shell Routes */}
          <Route path="/portal" element={<PortalShell />}>
            {/* Dashboard index */}
            <Route index element={<DashboardPage />} />

            {/* Contests Hub & Details */}
            <Route path="contests" element={<ContestsHubPage />} />
            <Route path="contests/:contestSlug" element={<ContestOverviewPage />} />
            <Route path="contests/:contestSlug/lobby" element={<ContestLobbyPage />} />
            <Route path="contests/:contestSlug/arena" element={<ContestArenaPage />} />
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

        {/* Catch-all fallback */}
        <Route path="*" element={<Navigate to="/portal" replace />} />
      </Routes>
    </Suspense>
  );
}
