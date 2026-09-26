import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAppSelector } from "@/store/hooks";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Minus, Trophy, UserPlus } from "lucide-react";
import { getUniversityLeaderboardData } from "@/organization/data/portal.functions";
import { LeaderboardSkeleton, LeaderboardRowSkeleton } from "@/organization/components/skeletons";
import { useSwrData } from "@/lib/cache/swrCache";
import { useRealtimeEvents } from "@/lib/realtime";
import { useChunkedList } from "@/hooks/useChunkedList";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { CadetProfileHoverCard } from "@/components/ui/CadetProfileHoverCard";
import { resolveAvatarUrl } from "@/lib/utils";
import { useAppDispatch } from "@/store/hooks";
import { prefetchProfileRoute } from "@/AppRoutes";

function Spark({ data }: { data: number[] }) {
  if (!data || data.length < 2) return <span className="inline-block h-1.5 w-12 rounded bg-zinc-900" aria-hidden="true" />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => `${i * 18},${22 - ((v - min) / range) * 18}`)
    .join(" ");
  return (
    <svg viewBox="0 0 90 26" className="h-6 w-[80px] stroke-lime-400 fill-none stroke-[1.5]" aria-hidden="true">
      <polyline points={pts} />
    </svg>
  );
}

export function LeaderboardPage() {
  const dispatch = useAppDispatch();
  const [pageSize, setPageSize] = useState<number>(25);
  const [pageIndex, setPageIndex] = useState<number>(0);

  const { data: rawData, loading, revalidate } = useSwrData(
    "leaderboard:university",
    getUniversityLeaderboardData,
    { staleTime: 5000, persistSession: false }
  );

  useRealtimeEvents(
    null,
    (event) => {
      if (
        event.event === "contest_concluded" ||
        event.event === "contest_status_changed" ||
        event.event === "contest_finished" ||
        event.event === "top30_qualified" ||
        event.event === "assessment_finished"
      ) {
        revalidate();
      }
    }
  );

  useEffect(() => {
    const handleRefresh = () => {
      revalidate();
    };
    window.addEventListener("contest:concluded", handleRefresh);
    window.addEventListener("contest:cache_invalidated", handleRefresh);
    return () => {
      window.removeEventListener("contest:concluded", handleRefresh);
      window.removeEventListener("contest:cache_invalidated", handleRefresh);
    };
  }, [revalidate]);
  const data = rawData || [];
  const currentMemberId = useAppSelector((s) => s.auth.member?.id);
  const followingIds = useAppSelector((s) => s.social.followingIds);

  const totalCount = data.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const pagedSlice = useMemo(() => {
    const start = pageIndex * pageSize;
    return data.slice(start, start + pageSize);
  }, [data, pageIndex, pageSize]);

  const { visibleItems, isChunking } = useChunkedList(pagedSlice, {
    initialChunkSize: 25,
    chunkSize: 25,
    delayMs: 16,
  });

  if (loading && (!rawData || rawData.length === 0)) {
    return <LeaderboardSkeleton />;
  }

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setPageIndex(0);
  };

  const handlePrevPage = () => {
    setPageIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNextPage = () => {
    setPageIndex((prev) => Math.min(totalPages - 1, prev + 1));
  };

  const startRecord = totalCount > 0 ? pageIndex * pageSize + 1 : 0;
  const endRecord = Math.min((pageIndex + 1) * pageSize, totalCount);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Clean minimal header — no ELO MATRIX / Verified Elo badges */}
      <header className="rounded-lg border border-white/8 bg-black p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-lime-400">
            (02 // Standings)
          </p>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white font-sans">
            University Leaderboard
          </h1>
          <p className="text-xs sm:text-sm leading-relaxed text-zinc-400 font-sans">
            Unified standings across Medi-Caps University computing departments.
          </p>
        </div>
        <div className="flex flex-col items-start md:items-end justify-center rounded-lg border border-white/8 bg-zinc-950 px-5 py-3.5 min-w-[160px] shrink-0">
          <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Rating Season</span>
          <strong className="font-mono text-lg font-bold text-white mt-0.5">2025–2026</strong>
          <small className="font-mono text-xs text-lime-400 tabular-nums mt-0.5">{totalCount} ranked cadets</small>
        </div>
      </header>

      {/* Table Container */}
      <div className="overflow-hidden rounded-lg border border-white/8 bg-zinc-950">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-white/8 hover:bg-transparent">
                <TableHead className="py-3.5 pl-5 text-left font-mono text-[10px] uppercase text-zinc-500 font-semibold w-16">Rank</TableHead>
                <TableHead className="py-3.5 text-left font-mono text-[10px] uppercase text-zinc-500 font-semibold">Cadet</TableHead>
                <TableHead className="py-3.5 text-left font-mono text-[10px] uppercase text-zinc-500 font-semibold hidden md:table-cell">Trend</TableHead>
                <TableHead className="py-3.5 text-left font-mono text-[10px] uppercase text-zinc-500 font-semibold">Rating</TableHead>
                <TableHead className="py-3.5 text-left font-mono text-[10px] uppercase text-zinc-500 font-semibold hidden sm:table-cell">Peak</TableHead>
                <TableHead className="py-3.5 pr-5 text-left font-mono text-[10px] uppercase text-zinc-500 font-semibold hidden sm:table-cell">Attended</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <LeaderboardRowSkeleton count={Math.min(pageSize, 8)} />
              ) : visibleItems.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-16 text-center font-mono text-xs text-zinc-600"
                  >
                    No ranked members found in university standings.
                  </TableCell>
                </TableRow>
              ) : (
                visibleItems.map((x) => {
                  const change =
                    (x.previous_rank ?? x.university_rank) - x.university_rank;
                  const isYou = x.id === currentMemberId;
                  const attendanceCount = x.attendance_count ?? 0;
                  const attendanceTotal =
                    x.attendance_total && x.attendance_total > 0
                      ? x.attendance_total
                      : Math.max(1, attendanceCount);
                  const isFollowing = followingIds.includes(x.id) || followingIds.includes(x.handle);
                  const initials = x.full_name
                    ? x.full_name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()
                    : (x.handle ?? "??").slice(0, 2).toUpperCase();

                  return (
                    <TableRow
                      key={x.handle || x.id}
                      className={`border-b border-white/5 transition-colors hover:bg-white/[0.03] ${
                        isYou ? "bg-lime-400/[0.04] hover:bg-lime-400/[0.07]" : ""
                      }`}
                    >
                      {/* Rank + Change */}
                      <TableCell className="pl-5 py-3">
                        <div className="flex items-center gap-1.5 font-mono">
                          <strong className="text-xs font-bold tabular-nums text-white w-5 text-right">
                            {x.university_rank}
                          </strong>
                          <span
                            className={`inline-flex items-center text-[10px] tabular-nums ${
                              change > 0 ? "text-lime-400" : change < 0 ? "text-red-400" : "text-zinc-700"
                            }`}
                          >
                            {change > 0 ? (
                              <ChevronUp className="size-2.5" />
                            ) : change < 0 ? (
                              <ChevronDown className="size-2.5" />
                            ) : (
                              <Minus className="size-2.5" />
                            )}
                          </span>
                        </div>
                      </TableCell>

                      {/* Avatar + Handle HoverCard */}
                      <TableCell className="py-3">
                        <CadetProfileHoverCard
                          handle={x.handle}
                          profile={x}
                          align="start"
                          side="top"
                          sideOffset={10}
                        >
                          <Link
                            to={`/profile/${x.handle}`}
                            className="flex items-center gap-3 cursor-pointer group/row min-w-0"
                          >
                            {/* Avatar always visible */}
                            <Avatar className="size-9 shrink-0 rounded-full border border-white/10 group-hover/row:border-lime-400/40 transition-colors overflow-hidden">
                              <AvatarImage
                                src={resolveAvatarUrl(x.avatar_url ?? null)}
                                alt={x.full_name || x.handle}
                                className="object-cover"
                              />
                              <AvatarFallback className="bg-zinc-900 text-lime-400 font-mono text-[10px] font-bold rounded-full">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="font-mono text-xs font-semibold text-white group-hover/row:text-lime-400 transition-colors truncate">
                                @{x.handle}
                              </p>
                              {x.full_name && (
                                <p className="text-[11px] text-zinc-500 truncate mt-0.5 font-sans">
                                  {x.full_name}
                                </p>
                              )}
                            </div>
                          </Link>
                        </CadetProfileHoverCard>
                      </TableCell>

                      {/* Trend sparkline */}
                      <TableCell className="py-3 hidden md:table-cell">
                        <Spark data={x.ratings ?? []} />
                      </TableCell>

                      {/* Rating */}
                      <TableCell className="py-3 font-mono font-bold text-sm tabular-nums text-lime-400">
                        {x.rating}
                      </TableCell>

                      {/* Peak */}
                      <TableCell className="py-3 font-mono text-xs tabular-nums text-zinc-400 hidden sm:table-cell">
                        {x.peak_rating}
                      </TableCell>

                      {/* Attendance */}
                      <TableCell className="py-3 pr-5 hidden sm:table-cell">
                        <span className="font-mono text-xs tabular-nums text-zinc-400">
                          {attendanceCount}/{attendanceTotal}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/8 bg-black/40 px-5 py-3.5">
          <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
            <span>
              Showing <strong className="tabular-nums text-white font-medium">{startRecord}–{endRecord}</strong> of{" "}
              <strong className="tabular-nums text-white font-medium">{totalCount}</strong> cadets
            </span>
            {isChunking && (
              <span className="inline-flex items-center gap-1 text-[10px] text-lime-400">
                <span className="size-1 animate-pulse rounded-full bg-lime-400" />
                loading…
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Page Size */}
            <div className="flex items-center gap-1.5 font-sans text-sm text-zinc-400">
              <span>Rows:</span>
              <div className="flex items-center border border-white/8 rounded-md overflow-hidden">
                {[25, 50, 100].map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => handlePageSizeChange(size)}
                    className={`px-2.5 py-1 font-sans text-sm font-semibold transition-colors cursor-pointer ${
                      pageSize === size
                        ? "bg-lime-400 text-black"
                        : "text-zinc-400 hover:text-white bg-black"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* Prev / Next */}
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon-sm"
                onClick={handlePrevPage}
                disabled={pageIndex === 0}
                aria-label="Previous page"
              >
                <ChevronLeft className="size-3.5" />
              </Button>

              <span className="px-2 font-mono text-xs tabular-nums text-zinc-400">
                {pageIndex + 1} / {totalPages}
              </span>

              <Button
                variant="outline"
                size="icon-sm"
                onClick={handleNextPage}
                disabled={pageIndex >= totalPages - 1}
                aria-label="Next page"
              >
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
