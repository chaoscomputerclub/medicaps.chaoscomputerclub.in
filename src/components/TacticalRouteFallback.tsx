/**
 * CCC Medi-Caps Portal — Dynamic Route-Aware Application Shell Skeleton
 * Resolves the exact page skeleton matching the active route, eliminating generic dashboard mocks.
 */

import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DashboardSkeleton,
  ContestsHubSkeleton,
  ContestDetailSkeleton,
  ContestLobbySkeleton,
  AssessmentStudioSkeleton,
  ContestSummarySkeleton,
  ContestResultsSkeleton,
  ContestFinalResultsSkeleton,
  LeaderboardSkeleton,
  MyContestsSkeleton,
  ProblemArchiveSkeleton,
  ProblemDetailSkeleton,
  ProfileSkeleton,
  SettingsSkeleton,
  AuthSkeleton,
} from "@/organization/components/skeletons";

export function AppShellSkeleton() {
  const path = typeof window !== "undefined" ? window.location.pathname.replace(/\/+$/, "") || "/" : "/";

  if (path === "/auth") {
    return <AuthSkeleton />;
  }

  const isFullscreen =
    path.includes("/assessment") ||
    path.includes("/arena") ||
    path.includes("/lobby") ||
    path.includes("/summary") ||
    path.includes("/submit") ||
    (path.includes("/contests/") && (
      path.includes("/problems") ||
      path.includes("/summary") ||
      path.includes("/submit")
    ));

  const renderContentSkeleton = () => {
    if (path === "/contests") return <ContestsHubSkeleton />;
    if (path.includes("/summary") || path.includes("/submit")) return <ContestSummarySkeleton />;
    if (path.includes("/lobby")) return <ContestLobbySkeleton />;
    if (path.includes("/arena") || path.includes("/problems/")) return <AssessmentStudioSkeleton />;
    if (path.includes("/final-results")) return <ContestFinalResultsSkeleton />;
    if (path.includes("/results")) return <ContestResultsSkeleton />;
    if (path.startsWith("/contests/")) return <ContestDetailSkeleton />;
    if (path.startsWith("/my-contests")) return <MyContestsSkeleton />;
    if (path.startsWith("/leaderboard")) return <LeaderboardSkeleton />;
    if (path === "/problems") return <ProblemArchiveSkeleton />;
    if (path.startsWith("/problems/")) return <ProblemDetailSkeleton />;
    if (path.startsWith("/settings")) return <SettingsSkeleton />;
    if (path.startsWith("/profile") || path.startsWith("/u/")) return <ProfileSkeleton />;
    return <DashboardSkeleton />;
  };

  if (isFullscreen) {
    return <main className="min-h-screen bg-black text-white">{renderContentSkeleton()}</main>;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading application shell"
      className="min-h-screen bg-black text-white flex flex-col md:flex-row antialiased select-none"
    >
      {/* Mobile Topbar Skeleton */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-white/8 bg-black sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <Skeleton className="w-7 h-7 rounded-md shrink-0" />
          <div className="flex flex-col gap-1">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-2 w-16" />
          </div>
        </div>
        <Skeleton className="w-6 h-6 rounded-md" />
      </div>

      {/* Desktop Sidebar Skeleton */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-64 bg-black border-r border-white/8 px-4 py-4 flex-col z-50">
        {/* Brand Header */}
        <div className="flex items-center gap-3 pb-4 mb-2 border-b border-white/8">
          <Skeleton className="w-8 h-8 rounded-md shrink-0" />
          <div className="flex flex-col gap-1.5 flex-1">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-2 w-20" />
          </div>
        </div>

        {/* Nav Links (7 Items) */}
        <div className="flex flex-col gap-1 my-1 flex-1">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="flex items-center gap-2.5 px-2.5 py-2">
              <Skeleton className="w-4 h-4 rounded" />
              <Skeleton className="h-3 flex-1" />
            </div>
          ))}
        </div>

        {/* User Identity Footer */}
        <div className="pt-3 border-t border-white/8 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Skeleton className="w-7 h-7 rounded-full shrink-0" />
            <div className="space-y-1 flex-1">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-2 w-14" />
            </div>
          </div>
          <Skeleton className="w-6 h-6 rounded shrink-0" />
        </div>
      </aside>

      {/* Main Content Viewport Skeleton with Route-Specific Content */}
      <main className="flex-1 md:ml-64 min-h-screen bg-black p-4 md:p-8">
        {renderContentSkeleton()}
      </main>
    </div>
  );
}

// Backward-compatible alias for existing imports
export const TacticalRouteFallback = AppShellSkeleton;
