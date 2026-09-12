/**
 * Chaos Computer Club India — Cyber Skeleton Loading Library
 * Ultra-high-fidelity loaders pixel-matched to CCC layouts.
 */

import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* 1. Component Primitives & Micro Skeletons                                  */
/* -------------------------------------------------------------------------- */

export function SkeletonText({ className, lines = 1 }: { className?: string; lines?: number }) {
  if (lines === 1) {
    return <Skeleton className={cn("h-3 w-3/4 rounded-[1px]", className)} />;
  }
  return (
    <div className="space-y-2 w-full">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn("h-3 rounded-[1px]", i === lines - 1 ? "w-4/5" : "w-full", className)}
        />
      ))}
    </div>
  );
}

export function MetricsGridSkeleton() {
  return (
    <section className="metrics-grid">
      {[
        { labelW: "w-20", valW: "w-24", subW: "w-28" },
        { labelW: "w-24", valW: "w-20", subW: "w-32" },
        { labelW: "w-24", valW: "w-16", subW: "w-28" },
        { labelW: "w-24", valW: "w-16", subW: "w-24" },
      ].map((item, idx) => (
        <div key={idx} className="metric">
          <Skeleton className={cn("h-2.5 mb-2.5", item.labelW)} />
          <Skeleton className={cn("h-7 mb-2", item.valW)} />
          <Skeleton className={cn("h-2.5", item.subW)} />
        </div>
      ))}
    </section>
  );
}

export function RatingChartSkeleton() {
  return (
    <div className="rating-chart flex flex-col justify-between p-4 border border-[#222] bg-[#0c0c0c]">
      <div className="flex justify-between items-center mb-3">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
      <div className="flex-1 flex items-end gap-2 pt-6 pb-2 border-b border-[#222]">
        {[30, 48, 42, 65, 58, 80, 72, 88, 75, 92, 85, 96].map((h, idx) => (
          <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
            <Skeleton className="w-full" style={{ height: `${h}%` }} />
            <Skeleton className="h-2 w-5 mt-1" />
          </div>
        ))}
      </div>
      <div className="flex justify-between items-center pt-2">
        <Skeleton className="h-2 w-16" />
        <Skeleton className="h-2 w-28" />
        <Skeleton className="h-2 w-16" />
      </div>
    </div>
  );
}

export function CampusPassSkeleton() {
  return (
    <article className="campus-pass">
      <div className="pass-cut pass-cut-left" />
      <div className="pass-cut pass-cut-right" />
      <header className="flex justify-between">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-36" />
      </header>
      <div className="pass-body">
        <div>
          <Skeleton className="h-2.5 w-24 mb-2" />
          <Skeleton className="h-6 w-44 mb-1" />
          <Skeleton className="h-3 w-36 mb-4" />
          <dl>
            <div>
              <dt>
                <Skeleton className="h-2.5 w-14" />
              </dt>
              <dd>
                <Skeleton className="h-3.5 w-36" />
              </dd>
            </div>
            <div>
              <dt>
                <Skeleton className="h-2.5 w-12" />
              </dt>
              <dd>
                <Skeleton className="h-3.5 w-24" />
              </dd>
            </div>
            <div>
              <dt>
                <Skeleton className="h-2.5 w-14" />
              </dt>
              <dd>
                <Skeleton className="h-3.5 w-28" />
              </dd>
            </div>
            <div>
              <dt>
                <Skeleton className="h-2.5 w-20" />
              </dt>
              <dd>
                <Skeleton className="h-3.5 w-36" />
              </dd>
            </div>
          </dl>
        </div>
        <div className="pass-qr">
          <Skeleton className="w-[116px] h-[116px] rounded-[1px]" />
          <Skeleton className="h-3 w-20 mt-2" />
        </div>
      </div>
      <footer className="flex justify-between">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-28" />
      </footer>
    </article>
  );
}

export function ProofBadgeSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <article className="proof-badge">
      <div className="proof-header">
        <div className="w-full">
          <Skeleton className="h-3.5 w-28 mb-2" />
          <Skeleton className="h-5 w-48" />
        </div>
        <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
      </div>
      <dl className="proof-grid">
        <div>
          <dt>
            <Skeleton className="h-2 w-14" />
          </dt>
          <dd>
            <Skeleton className="h-3 w-28" />
          </dd>
        </div>
        <div>
          <dt>
            <Skeleton className="h-2 w-14" />
          </dt>
          <dd>
            <Skeleton className="h-3 w-24" />
          </dd>
        </div>
        {!compact && (
          <>
            <div>
              <dt>
                <Skeleton className="h-2 w-20" />
              </dt>
              <dd>
                <Skeleton className="h-3 w-32" />
              </dd>
            </div>
            <div>
              <dt>
                <Skeleton className="h-2 w-20" />
              </dt>
              <dd>
                <Skeleton className="h-3 w-32" />
              </dd>
            </div>
          </>
        )}
      </dl>
      <div className="hash-row">
        <Skeleton className="h-3 w-full" />
      </div>
      <footer>
        <Skeleton className="h-2.5 w-24" />
        <Skeleton className="h-2.5 w-16" />
      </footer>
    </article>
  );
}

export function ScoreboardMatrixSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className="table-scroll">
      <table className="scoreboard">
        <thead>
          <tr>
            <th>#</th>
            <th>Contestant</th>
            {!compact && <th>Dept.</th>}
            <th>A</th>
            <th>B</th>
            <th>C</th>
            <th>D</th>
            <th>Solved</th>
            <th>Penalty</th>
            <th>Δ</th>
          </tr>
        </thead>
        <tbody>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <tr key={i}>
              <td>
                <Skeleton className="h-4 w-5" />
              </td>
              <td>
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-2.5 w-36" />
                </div>
              </td>
              {!compact && (
                <td>
                  <Skeleton className="h-3 w-16" />
                </td>
              )}
              <td>
                <Skeleton className="h-5 w-8 mx-auto" />
              </td>
              <td>
                <Skeleton className="h-5 w-8 mx-auto" />
              </td>
              <td>
                <Skeleton className="h-5 w-8 mx-auto" />
              </td>
              <td>
                <Skeleton className="h-5 w-8 mx-auto" />
              </td>
              <td>
                <Skeleton className="h-4 w-6 mx-auto" />
              </td>
              <td>
                <Skeleton className="h-3 w-12 mx-auto" />
              </td>
              <td>
                <Skeleton className="h-3 w-8 mx-auto" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AnnouncementFeedSkeleton() {
  return (
    <div className="feed-list">
      {[1, 2, 3].map((i) => (
        <article key={i}>
          <Skeleton className="h-2.5 w-20 mb-2" />
          <Skeleton className="h-4 w-4/5 mb-2" />
          <Skeleton className="h-3 w-full mb-1" />
          <Skeleton className="h-3 w-3/4 mb-3" />
          <Skeleton className="h-2.5 w-28" />
        </article>
      ))}
    </div>
  );
}

export function BattleHistorySkeleton() {
  return (
    <div className="battle-history">
      {[1, 2, 3, 4].map((i) => (
        <article key={i}>
          <Skeleton className="h-3 w-20" />
          <div className="flex flex-col gap-1">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-2.5 w-32" />
          </div>
          <span>
            <Skeleton className="h-3 w-16" />
          </span>
          <span>
            <Skeleton className="h-3 w-16" />
          </span>
          <span>
            <Skeleton className="h-3 w-16" />
          </span>
          <Skeleton className="h-4 w-10 ml-auto" />
        </article>
      ))}
    </div>
  );
}

export function AchievementGridSkeleton() {
  return (
    <div className="achievement-grid">
      {[1, 2, 3, 4].map((i) => (
        <article key={i} className="locked">
          <Skeleton className="w-5 h-5 mb-2" />
          <Skeleton className="h-2.5 w-16 mb-2" />
          <Skeleton className="h-3.5 w-32 mb-1.5" />
          <Skeleton className="h-2.5 w-full mb-1" />
          <Skeleton className="h-2.5 w-4/5" />
        </article>
      ))}
    </div>
  );
}

export function ContestRowSkeleton() {
  return (
    <article className="contest-row">
      <div className="contest-date">
        <Skeleton className="h-6 w-8 mx-auto mb-1" />
        <Skeleton className="h-3 w-8 mx-auto" />
      </div>
      <div className="contest-summary">
        <div className="flex items-center gap-2 mb-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton className="h-5 w-3/5 mb-2" />
        <Skeleton className="h-3.5 w-4/5 mb-3" />
        <div className="event-facts">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
      <div className="contest-action">
        <Skeleton className="h-5 w-6 mb-1" />
        <Skeleton className="h-2.5 w-12 mb-2" />
        <Skeleton className="h-7 w-7 rounded-none" />
      </div>
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/* 2. Full Page-Level Skeletons (TanStack Router pendingComponents)           */
/* -------------------------------------------------------------------------- */

export function DashboardSkeleton() {
  return (
    <div className="page-wrap animate-in fade-in duration-300">
      <header className="page-header">
        <div>
          <Skeleton className="h-3 w-36 mb-2" />
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-3.5 w-80" />
        </div>
        <div className="member-rating">
          <Skeleton className="h-2.5 w-24 mb-1" />
          <Skeleton className="h-9 w-28 mb-1" />
          <Skeleton className="h-3 w-20" />
        </div>
      </header>

      <div className="live-command">
        <div className="live-copy">
          <div className="flex items-center gap-2 mb-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-6 w-3/4 mb-2" />
          <Skeleton className="h-3.5 w-5/6 mb-4" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-36" />
            <Skeleton className="h-8 w-28" />
          </div>
        </div>
        <div className="live-stats">
          <div>
            <Skeleton className="h-2.5 w-16 mb-2" />
            <Skeleton className="h-6 w-24" />
          </div>
          <div>
            <Skeleton className="h-2.5 w-16 mb-2" />
            <Skeleton className="h-6 w-20" />
          </div>
          <div>
            <Skeleton className="h-2.5 w-16 mb-2" />
            <Skeleton className="h-6 w-24" />
          </div>
          <div>
            <Skeleton className="h-2.5 w-16 mb-2" />
            <Skeleton className="h-6 w-16" />
          </div>
        </div>
      </div>

      <MetricsGridSkeleton />

      <section className="content-grid">
        <div className="panel wide">
          <div className="section-heading mb-4">
            <div>
              <Skeleton className="h-2.5 w-24 mb-1" />
              <Skeleton className="h-5 w-40" />
            </div>
          </div>
          <RatingChartSkeleton />
        </div>
        <div className="panel">
          <div className="section-heading mb-4">
            <div>
              <Skeleton className="h-2.5 w-24 mb-1" />
              <Skeleton className="h-5 w-36" />
            </div>
          </div>
          <AnnouncementFeedSkeleton />
        </div>
      </section>

      <section className="next-operation">
        <div className="flex items-center gap-3">
          <Skeleton className="w-8 h-8 rounded-none" />
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-36" />
          </div>
        </div>
        <Skeleton className="h-7 w-28" />
      </section>
    </div>
  );
}

export function ContestsSkeleton() {
  return (
    <div className="page-wrap animate-in fade-in duration-300">
      <header className="page-header">
        <div>
          <Skeleton className="h-3 w-40 mb-2" />
          <Skeleton className="h-8 w-52 mb-2" />
          <Skeleton className="h-3.5 w-96" />
        </div>
      </header>
      <div className="segmented">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-8 w-20" />
        ))}
      </div>
      <section className="contest-directory">
        <div className="section-heading mb-4">
          <div>
            <Skeleton className="h-2.5 w-24 mb-1" />
            <Skeleton className="h-5 w-40" />
          </div>
        </div>
        {[1, 2, 3].map((i) => (
          <ContestRowSkeleton key={i} />
        ))}
      </section>
    </div>
  );
}

export function ContestDetailSkeleton() {
  return (
    <div className="page-wrap animate-in fade-in duration-300">
      <Skeleton className="h-4 w-28 mb-4" />
      <header className="contest-hero">
        <div>
          <Skeleton className="h-3 w-20 mb-2" />
          <Skeleton className="h-3 w-32 mb-2" />
          <Skeleton className="h-8 w-72 mb-2" />
          <Skeleton className="h-4 w-4/5" />
        </div>
        <dl>
          <div>
            <dt>
              <Skeleton className="h-2.5 w-24" />
            </dt>
            <dd>
              <Skeleton className="h-4 w-36" />
            </dd>
          </div>
          <div>
            <dt>
              <Skeleton className="h-2.5 w-20" />
            </dt>
            <dd>
              <Skeleton className="h-4 w-32" />
            </dd>
          </div>
          <div>
            <dt>
              <Skeleton className="h-2.5 w-20" />
            </dt>
            <dd>
              <Skeleton className="h-4 w-28" />
            </dd>
          </div>
          <div>
            <dt>
              <Skeleton className="h-2.5 w-20" />
            </dt>
            <dd>
              <Skeleton className="h-4 w-36" />
            </dd>
          </div>
        </dl>
      </header>
      <div className="registration-band">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-3 w-96" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-8 w-28" />
        </div>
      </div>
      <section className="panel">
        <div className="section-heading mb-4">
          <div>
            <Skeleton className="h-2.5 w-24 mb-1" />
            <Skeleton className="h-5 w-48" />
          </div>
        </div>
        <div className="problem-list">
          {[1, 2, 3, 4].map((i) => (
            <article key={i}>
              <Skeleton className="h-5 w-6" />
              <div className="flex flex-col gap-1.5 flex-1">
                <Skeleton className="h-4 w-44" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="h-5 w-12" />
              <Skeleton className="h-3 w-16" />
            </article>
          ))}
        </div>
      </section>
      <section className="contest-lower">
        <div className="panel">
          <div className="section-heading mb-4">
            <div>
              <Skeleton className="h-2.5 w-24 mb-1" />
              <Skeleton className="h-5 w-36" />
            </div>
          </div>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex gap-3 items-center">
                <Skeleton className="h-4 w-6" />
                <Skeleton className="h-3.5 w-5/6" />
              </div>
            ))}
          </div>
        </div>
        <div className="panel">
          <div className="section-heading mb-4">
            <div>
              <Skeleton className="h-2.5 w-24 mb-1" />
              <Skeleton className="h-5 w-36" />
            </div>
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-5 w-48" />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export function LeaderboardSkeleton() {
  return (
    <div className="page-wrap animate-in fade-in duration-300">
      <header className="page-header">
        <div>
          <Skeleton className="h-3 w-36 mb-2" />
          <Skeleton className="h-8 w-60 mb-2" />
          <Skeleton className="h-3.5 w-96" />
        </div>
        <div className="ranking-meta">
          <Skeleton className="h-2.5 w-24 mb-1" />
          <Skeleton className="h-6 w-32 mb-1" />
          <Skeleton className="h-3 w-24" />
        </div>
      </header>
      <div className="table-scroll leaderboard-table">
        <table>
          <thead>
            <tr>
              <th style={{ width: "110px" }}>Rank</th>
              <th>Name</th>
              <th style={{ width: "200px" }}>Attended</th>
              <th style={{ width: "120px", textAlign: "right" }}>Score</th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
              <tr key={i}>
                <td>
                  <Skeleton className="h-5 w-12" />
                </td>
                <td>
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-8 h-8 rounded-[1px] flex-shrink-0" />
                    <div className="flex flex-col gap-1.5">
                      <Skeleton className="h-3.5 w-28" />
                      <Skeleton className="h-2.5 w-16" />
                    </div>
                  </div>
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-2 w-14" />
                    <Skeleton className="h-3 w-8" />
                  </div>
                </td>
                <td className="text-right">
                  <Skeleton className="h-5 w-12 ml-auto" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="page-wrap animate-in fade-in duration-300">
      <header className="profile-header">
        <Skeleton className="profile-mark" />
        <div>
          <Skeleton className="h-3 w-36 mb-2" />
          <Skeleton className="h-8 w-60 mb-2" />
          <Skeleton className="h-3.5 w-48 mb-2" />
          <Skeleton className="h-4 w-28" />
        </div>
        <dl>
          <div>
            <dt>
              <Skeleton className="h-2.5 w-16" />
            </dt>
            <dd>
              <Skeleton className="h-4 w-32" />
            </dd>
          </div>
          <div>
            <dt>
              <Skeleton className="h-2.5 w-24" />
            </dt>
            <dd>
              <Skeleton className="h-4 w-44" />
            </dd>
          </div>
        </dl>
      </header>
      <MetricsGridSkeleton />
      <section className="content-grid">
        <div className="panel wide">
          <div className="section-heading mb-4">
            <div>
              <Skeleton className="h-2.5 w-24 mb-1" />
              <Skeleton className="h-5 w-44" />
            </div>
          </div>
          <RatingChartSkeleton />
        </div>
        <div>
          <CampusPassSkeleton />
        </div>
      </section>
      <section className="panel">
        <div className="section-heading mb-4">
          <div>
            <Skeleton className="h-2.5 w-24 mb-1" />
            <Skeleton className="h-5 w-44" />
          </div>
        </div>
        <BattleHistorySkeleton />
      </section>
      <section className="content-grid">
        <div className="panel">
          <div className="section-heading mb-4">
            <div>
              <Skeleton className="h-2.5 w-24 mb-1" />
              <Skeleton className="h-5 w-36" />
            </div>
          </div>
          <AchievementGridSkeleton />
        </div>
        <div>
          <div className="section-heading mb-4">
            <div>
              <Skeleton className="h-2.5 w-24 mb-1" />
              <Skeleton className="h-5 w-36" />
            </div>
          </div>
          <ProofBadgeSkeleton />
        </div>
      </section>
    </div>
  );
}

export function VerifySkeleton() {
  return (
    <div className="page-wrap verify-wrap animate-in fade-in duration-300">
      <header className="page-header">
        <div>
          <Skeleton className="h-3 w-36 mb-2" />
          <Skeleton className="h-8 w-56 mb-2" />
          <Skeleton className="h-3.5 w-96" />
        </div>
        <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
      </header>
      <div className="verify-form">
        <Skeleton className="h-3 w-48 mb-2" />
        <div className="flex gap-2">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-24" />
        </div>
        <Skeleton className="h-2.5 w-64 mt-2" />
      </div>
      <div className="mt-8">
        <ProofBadgeSkeleton />
      </div>
    </div>
  );
}

export function ProblemsSkeleton() {
  return (
    <div className="page-wrap animate-in fade-in duration-300">
      <header className="page-header">
        <div>
          <Skeleton className="h-3 w-44 mb-2" />
          <Skeleton className="h-8 w-56 mb-2" />
          <Skeleton className="h-3.5 w-96" />
        </div>
        <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
      </header>
      <section className="panel">
        <div className="section-heading mb-4">
          <div>
            <Skeleton className="h-2.5 w-24 mb-1" />
            <Skeleton className="h-5 w-48" />
          </div>
        </div>
        <div className="archive-list">
          {[1, 2, 3, 4, 5].map((i) => (
            <article key={i}>
              <Skeleton className="h-5 w-6" />
              <div className="flex flex-col gap-1.5 flex-1">
                <Skeleton className="h-2.5 w-28" />
                <Skeleton className="h-4 w-52" />
                <Skeleton className="h-3 w-36" />
              </div>
              <Skeleton className="h-5 w-12" />
              <Skeleton className="h-7 w-7 rounded-none" />
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

export function ProblemDetailSkeleton() {
  return (
    <div className="page-wrap narrow animate-in fade-in duration-300">
      <Skeleton className="h-4 w-32 mb-4" />
      <header className="problem-header">
        <Skeleton className="w-8 h-8 flex-shrink-0" />
        <div className="flex-1">
          <Skeleton className="h-3 w-40 mb-2" />
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-3.5 w-52" />
        </div>
      </header>
      <div className="readonly-notice">
        <Skeleton className="w-5 h-5 flex-shrink-0" />
        <div className="flex flex-col gap-1 flex-1">
          <Skeleton className="h-3.5 w-48" />
          <Skeleton className="h-3 w-4/5" />
        </div>
      </div>
      <article className="editorial-body">
        <Skeleton className="h-3 w-32 mb-2" />
        <Skeleton className="h-6 w-56 mb-4" />
        <Skeleton className="h-3.5 w-full mb-2" />
        <Skeleton className="h-3.5 w-11/12 mb-2" />
        <Skeleton className="h-3.5 w-4/5 mb-6" />
        <Skeleton className="h-4 w-40 mb-3" />
        <Skeleton className="h-3.5 w-full mb-4" />
        <Skeleton className="h-20 w-full mb-6" />
        <Skeleton className="h-4 w-36 mb-2" />
        <Skeleton className="h-3.5 w-3/4" />
      </article>
    </div>
  );
}

export function AssessmentStudioSkeleton() {
  return (
    <div className="flex flex-col h-screen bg-[#070707] text-[#e0e0e0] font-sans animate-in fade-in duration-300">
      {/* Top Proctored Header */}
      <header className="flex items-center justify-between border-b border-[#222] bg-[#0c0c0c] px-4 py-2.5">
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-7 w-20" />
        </div>
      </header>
      {/* Problem Picker Bar */}
      <div className="flex items-center border-b border-[#222] bg-[#0f0f0f] px-3 py-1.5 gap-2">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-7 w-28" />
        ))}
      </div>
      {/* Split Arena: Left Problem + Right Code Editor */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 overflow-hidden">
        <div className="border-r border-[#222] p-6 space-y-4 overflow-y-auto">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="h-7 w-64" />
          <div className="space-y-2 pt-2">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-11/12" />
            <Skeleton className="h-3.5 w-4/5" />
          </div>
          <div className="pt-4 space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-16 w-full" />
          </div>
        </div>
        <div className="flex flex-col bg-[#0b0b0b]">
          <div className="flex items-center justify-between border-b border-[#222] px-4 py-2 bg-[#111]">
            <Skeleton className="h-6 w-32" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-6 w-16" />
            </div>
          </div>
          <div className="flex-1 p-4 space-y-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="h-3 w-6" />
                <Skeleton className="h-3" style={{ width: `${((i * 37) % 60) + 30}%` }} />
              </div>
            ))}
          </div>
          <div className="border-t border-[#222] p-3 flex justify-between items-center bg-[#0d0d0d]">
            <Skeleton className="h-7 w-24" />
            <div className="flex gap-2">
              <Skeleton className="h-7 w-20" />
              <Skeleton className="h-7 w-24" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AssessmentLeaderboardSkeleton() {
  return (
    <div className="page-wrap animate-in fade-in duration-300">
      <header className="page-header">
        <div>
          <Skeleton className="h-3 w-28 mb-2" />
          <Skeleton className="h-3 w-40 mb-2" />
          <Skeleton className="h-8 w-72 mb-2" />
          <Skeleton className="h-3.5 w-96" />
        </div>
        <div className="ranking-meta">
          <Skeleton className="h-2.5 w-24 mb-1" />
          <Skeleton className="h-6 w-32 mb-1" />
          <Skeleton className="h-3 w-24" />
        </div>
      </header>
      <div className="panel mb-6 flex justify-between items-center">
        <div className="flex gap-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="h-8 w-44" />
      </div>
      <div className="table-scroll leaderboard-table">
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Status</th>
              <th>Handle</th>
              <th>Full Name</th>
              <th>Dept</th>
              <th>Score</th>
              <th>Solved</th>
              <th>Penalty</th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <tr key={i}>
                <td>
                  <Skeleton className="h-4 w-6" />
                </td>
                <td>
                  <Skeleton className="h-4 w-16" />
                </td>
                <td>
                  <Skeleton className="h-3.5 w-28" />
                </td>
                <td>
                  <Skeleton className="h-3.5 w-36" />
                </td>
                <td>
                  <Skeleton className="h-3 w-16" />
                </td>
                <td>
                  <Skeleton className="h-4 w-10" />
                </td>
                <td>
                  <Skeleton className="h-4 w-8" />
                </td>
                <td>
                  <Skeleton className="h-3 w-14" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AuthSkeleton() {
  return (
    <div className="auth-shell animate-in fade-in duration-300">
      <div className="auth-brand">
        <div className="auth-brand-inner w-full">
          <Skeleton className="auth-brand-logo" />
          <Skeleton className="h-3 w-28 mb-2" />
          <Skeleton className="h-10 w-64 mb-4" />
          <Skeleton className="h-12 w-full mb-6" />
          <div className="space-y-3">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-52" />
            <Skeleton className="h-4 w-44" />
          </div>
        </div>
      </div>
      <div className="auth-form-panel">
        <div className="auth-card">
          <Skeleton className="h-2.5 w-24 mb-2" />
          <Skeleton className="h-7 w-48 mb-2" />
          <Skeleton className="h-3.5 w-64 mb-6" />
          <div className="space-y-4">
            <div>
              <Skeleton className="h-2.5 w-20 mb-2" />
              <Skeleton className="h-10 w-full" />
            </div>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-3 w-48 mx-auto" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
