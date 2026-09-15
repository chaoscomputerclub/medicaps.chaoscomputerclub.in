import { Routes, Route, Navigate } from "react-router-dom";
import { PortalShell } from "@/organization/components/PortalShell";
import { AuthGuard, GuestGuard } from "@/lib/guards/AuthGuard";

// Page imports
import { AuthPage } from "@/pages/AuthPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { ContestsHubPage } from "@/pages/ContestsHubPage";
import { ContestOverviewPage } from "@/pages/ContestOverviewPage";
import { ContestLobbyPage } from "@/pages/ContestLobbyPage";
import { ContestArenaPage } from "@/pages/ContestArenaPage";
import { ContestOfflinePage } from "@/pages/ContestOfflinePage";
import { ContestQualifiedPage } from "@/pages/ContestQualifiedPage";
import { ContestResultsPage } from "@/pages/ContestResultsPage";
import { ContestFinalResultsPage } from "@/pages/ContestFinalResultsPage";
import { AssessmentWorkspacePage } from "@/pages/AssessmentWorkspacePage";
import { MyContestsPage } from "@/pages/MyContestsPage";
import { LeaderboardPage } from "@/pages/LeaderboardPage";
import { ProblemArchivePage } from "@/pages/ProblemArchivePage";
import { ProblemDetailPage } from "@/pages/ProblemDetailPage";
import { VerifyProofPage } from "@/pages/VerifyProofPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { SettingsPage } from "@/pages/SettingsPage";

export function AppRoutes() {
  return (
    <Routes>
      {/* Root redirect */}
      <Route path="/" element={<Navigate to="/portal" replace />} />

      {/* Guest-only Authentication Route */}
      <Route element={<GuestGuard />}>
        <Route path="/auth" element={<AuthPage />} />
      </Route>

      {/* Strictly Protected Inner Platform Routes */}
      <Route element={<AuthGuard />}>
        {/* Standalone Assessment Workspace (FullScreen distraction-free testing) */}
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
          <Route path="contests/:contestSlug/assessment" element={<AssessmentWorkspacePage />} />
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
      <Route path="/u/:handle" element={<Navigate to="/portal/profile/:handle" replace />} />

      {/* Catch-all fallback */}
      <Route path="*" element={<Navigate to="/portal" replace />} />
    </Routes>
  );
}
