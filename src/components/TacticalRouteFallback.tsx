/**
 * CCC Medi-Caps Portal — High-End SaaS Application Shell Skeleton
 * Replaces tactical matrix loaders with a sovereign, pitch-black Strix AI-grade skeleton shell.
 */

import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function AppShellSkeleton() {
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

      {/* Main Content Viewport Skeleton */}
      <main className="flex-1 md:ml-64 min-h-screen bg-black p-4 md:p-8 space-y-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header Row */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/8 pb-6">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-3.5 w-96 max-w-full" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-28 rounded-md" />
              <Skeleton className="h-9 w-28 rounded-md" />
            </div>
          </div>

          {/* Metrics Bento Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="p-4 rounded-lg border border-white/8 bg-black space-y-2">
                <Skeleton className="h-2.5 w-20" />
                <Skeleton className="h-7 w-28" />
                <Skeleton className="h-2.5 w-16" />
              </div>
            ))}
          </div>

          {/* Content Cards Grid */}
          <div className="grid gap-6 md:grid-cols-2">
            {[1, 2].map((i) => (
              <div key={i} className="p-6 rounded-xl border border-white/8 bg-black space-y-4">
                <div className="flex justify-between items-center">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-4/5" />
                <div className="pt-2 flex gap-3">
                  <Skeleton className="h-9 flex-1 rounded-md" />
                  <Skeleton className="h-9 w-24 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

// Backward-compatible alias for existing imports
export const TacticalRouteFallback = AppShellSkeleton;
