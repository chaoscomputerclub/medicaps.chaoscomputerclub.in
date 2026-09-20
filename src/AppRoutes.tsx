import React, { Suspense } from "react";
import { Routes, Route, Navigate, useParams } from "react-router-dom";
import { PortalShell } from "@/organization/components/PortalShell";
import { AuthGuard, GuestGuard } from "@/lib/guards/AuthGuard";
import { TacticalRouteFallback } from "@/components/TacticalRouteFallback";

// Helper for type-safe named exports with React.lazy
const lazyNamed = <T extends Record<string, any>, K extends keyof T>(
  importer: () => Promise<T>,
  name: K
) => React.lazy(() => importer().then((mod) => ({ default: mod[name] })));

// Dynamic Route Code-Splitting Chunks (Eliminates monolithic initial payload)
const AuthPage = lazyNamed(() => import("@/pages/AuthPage"), "AuthPage");
const DashboardPage = lazyNamed(() => import("@/pages/DashboardPage"), "DashboardPage");
const ContestsHubPage = lazyNamed(() => import("@/pages/ContestsHubPage"), "ContestsHubPage");
const ContestOverviewPage = lazyNamed(() => import("@/pages/ContestOverviewPage"), "ContestOverviewPage");
const ContestLobbyPage = lazyNamed(() => import("@/pages/ContestLobbyPage"), "ContestLobbyPage");
const ContestArenaPage = lazyNamed(() => import("@/pages/ContestArenaPage"), "ContestArenaPage");
const ContestOfflinePage = lazyNamed(() => import("@/pages/ContestOfflinePage"), "ContestOfflinePage");
const ContestQualifiedPage = lazyNamed(() => import("@/pages/ContestQualifiedPage"), "ContestQualifiedPage");
const ContestResultsPage = lazyNamed(() => import("@/pages/ContestResultsPage"), "ContestResultsPage");
const ContestFinalResultsPage = lazyNamed(() => import("@/pages/ContestFinalResultsPage"), "ContestFinalResultsPage");
const AssessmentWorkspacePage = lazyNamed(() => import("@/pages/AssessmentWorkspacePage"), "AssessmentWorkspacePage");
const MyContestsPage = lazyNamed(() => import("@/pages/MyContestsPage"), "MyContestsPage");
const LeaderboardPage = lazyNamed(() => import("@/pages/LeaderboardPage"), "LeaderboardPage");
const ProblemArchivePage = lazyNamed(() => import("@/pages/ProblemArchivePage"), "ProblemArchivePage");
const ProblemDetailPage = lazyNamed(() => import("@/pages/ProblemDetailPage"), "ProblemDetailPage");
const VerifyProofPage = lazyNamed(() => import("@/pages/VerifyProofPage"), "VerifyProofPage");
const ProfilePage = lazyNamed(() => import("@/pages/ProfilePage"), "ProfilePage");
const SettingsPage = lazyNamed(() => import("@/pages/SettingsPage"), "SettingsPage");

function ProfileHandleRedirect() {
  const { handle } = useParams<{ handle: string }>();
  return <Navigate to={`/portal/profile/${handle ? encodeURIComponent(handle) : ""}`} replace />;
}

function ContestAssessmentRedirect() {
  const { contestSlug } = useParams<{ contestSlug: string }>();
  return <Navigate to={`/assessments/${contestSlug ? encodeURIComponent(contestSlug) : ""}`} replace />;
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
          {/* Standalone Assessment Workspace (FullScreen distraction-free testing in dedicated window) */}
          <Route path="/assessments/:contestSlug" element={<AssessmentWorkspacePage />} />

          {/* Portal Shell Routes */}
          <Route path="/portal" element={<PortalShell />}>
            {/* Dashboard index */}
            <Route index element={<DashboardPage />} />

            {/* Contests Hub & Details */}
            <Route path="contests" element={<ContestsHubPage />} />
            <Route path="contests/:contestSlug" element={<ContestOverviewPage />} />
            <Route path="contests/:contestSlug/lobby" element={<ContestLobbyPage />} />
            <Route path="contests/:contestSlug/arena" element={<ContestArenaPage />} />
            <Route path="contests/:contestSlug/assessment" element={<ContestAssessmentRedirect />} />
            <Route path="contests/:contestSlug/offline" element={<ContestOfflinePage />} />
            <Route path="contests/:contestSlug/qualified" element={<ContestQualifiedPage />} />
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
