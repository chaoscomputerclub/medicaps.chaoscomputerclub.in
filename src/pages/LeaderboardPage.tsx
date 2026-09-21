import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAppSelector } from "@/store/hooks";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Minus, Trophy } from "lucide-react";
import { getUniversityLeaderboardData } from "@/organization/data/portal.functions";
import { LeaderboardRowSkeleton } from "@/organization/components/skeletons";
import { PageHeader } from "@/organization/components/ui";
import { useSwrData } from "@/lib/cache/swrCache";
import { useChunkedList } from "@/hooks/useChunkedList";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";

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
  const [pageSize, setPageSize] = useState<number>(25);
  const [pageIndex, setPageIndex] = useState<number>(0);

  const { data: rawData, loading } = useSwrData(
    "leaderboard:university",
    getUniversityLeaderboardData,
    { staleTime: 30000, persistSession: true }
  );
  const data = rawData || [];
  const currentMemberId = useAppSelector((s) => s.auth.member?.id);

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
      {/* Header */}
      <PageHeader
        kicker="02 // Standings"
        index="ELO MATRIX"
        badge={
          <span className="inline-flex items-center gap-1.5 rounded border border-lime-400/30 bg-lime-400/10 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-lime-400">
            <Trophy className="size-3 text-lime-400" /> Verified Elo Ratings
          </span>
        }
        title="University Leaderboard"
        description="Unified standings across Medi-Caps University computing departments."
        action={
          <div className="flex flex-col items-start md:items-end justify-center rounded-lg border border-white/8 bg-black p-4 min-w-[180px]">
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Rating Season</span>
            <strong className="font-mono text-base font-semibold text-white">2025–2026</strong>
            <small className="font-mono text-xs text-lime-400 tabular-nums">{totalCount} ranked cadets</small>
          </div>
        }
      />

      {/* Table Container */}
      <div className="overflow-hidden rounded-lg border border-white/8 bg-black">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-white/8 hover:bg-transparent">
                <TableHead className="py-3.5 pl-5 text-left font-mono text-[10px] uppercase text-zinc-500">Rank</TableHead>
                <TableHead className="py-3.5 text-left font-mono text-[10px] uppercase text-zinc-500">Cadet / Handle</TableHead>
                <TableHead className="py-3.5 text-left font-mono text-[10px] uppercase text-zinc-500">Trend</TableHead>
                <TableHead className="py-3.5 text-left font-mono text-[10px] uppercase text-zinc-500">Rating</TableHead>
                <TableHead className="py-3.5 text-left font-mono text-[10px] uppercase text-zinc-500">Peak</TableHead>
                <TableHead className="py-3.5 pr-5 text-left font-mono text-[10px] uppercase text-zinc-500">Attendance</TableHead>
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
                  const attendanceTotal = x.attendance_total || 6;
                  const attendancePct = Math.min(
                    (attendanceCount / attendanceTotal) * 100,
                    100
                  );

                  return (
                    <TableRow
                      key={x.handle || x.id}
                      className={`border-b border-white/6 transition-colors hover:bg-zinc-950 ${
                        isYou ? "bg-lime-400/5 hover:bg-lime-400/10" : ""
                      }`}
                    >
                      <TableCell className="pl-5">
                        <div className="flex items-center gap-2 font-mono">
                          <strong className="text-xs font-semibold tabular-nums text-white">
                            {String(x.university_rank).padStart(2, "0")}
                          </strong>
                          <span
                            className={`inline-flex items-center font-mono text-[11px] tabular-nums ${
                              change > 0 ? "text-lime-400" : change < 0 ? "text-red-400" : "text-zinc-600"
                            }`}
                          >
                            {change > 0 ? (
                              <ChevronUp className="size-3" />
                            ) : change < 0 ? (
                              <ChevronDown className="size-3" />
                            ) : (
                              <Minus className="size-3" />
                            )}
                            {Math.abs(change) || "—"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <Link
                            to={`/portal/profile/${x.handle}`}
                            className="font-mono text-xs font-semibold text-white hover:text-lime-400 transition-colors w-fit"
                          >
                            @{x.handle}
                          </Link>
                          <span className="text-[11px] text-zinc-500">{x.full_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Spark data={x.ratings ?? []} />
                      </TableCell>
                      <TableCell className="font-mono font-semibold text-xs tabular-nums text-lime-400">{x.rating}</TableCell>
                      <TableCell className="font-mono text-xs tabular-nums text-zinc-400">{x.peak_rating}</TableCell>
                      <TableCell className="pr-5">
                        <div className="flex items-center gap-2.5">
                          <div className="h-1.5 w-16 overflow-hidden rounded bg-zinc-900">
                            <div
                              className="h-full bg-lime-400 transition-all rounded"
                              style={{ width: `${attendancePct}%` }}
                            />
                          </div>
                          <span className="font-mono text-[11px] tabular-nums text-zinc-500">
                            {attendanceCount}/{attendanceTotal}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/8 bg-black px-5 py-3.5">
          <div className="flex items-center gap-2 text-xs font-mono text-zinc-500">
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
            <div className="flex items-center gap-1.5 font-mono text-xs text-zinc-500">
              <span>Rows:</span>
              <div className="flex items-center border border-white/8 rounded-md overflow-hidden">
                {[25, 50, 100].map((size) => (
                  <button
                    key={size}
                    onClick={() => handlePageSizeChange(size)}
                    className={`px-2 py-0.5 font-mono text-xs transition-colors ${
                      pageSize === size
                        ? "bg-lime-400 text-black font-semibold"
                        : "text-zinc-500 hover:text-white bg-black"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* Prev / Next */}
            <div className="flex items-center gap-1">
              <button
                onClick={handlePrevPage}
                disabled={pageIndex === 0}
                aria-label="Previous page"
                className="flex size-7 items-center justify-center rounded-md border border-white/8 bg-black text-zinc-400 transition-colors hover:border-white/20 hover:text-white disabled:pointer-events-none disabled:opacity-30"
              >
                <ChevronLeft className="size-3.5" />
              </button>

              <span className="px-2 font-mono text-xs tabular-nums text-zinc-400">
                {pageIndex + 1} / {totalPages}
              </span>

              <button
                onClick={handleNextPage}
                disabled={pageIndex >= totalPages - 1}
                aria-label="Next page"
                className="flex size-7 items-center justify-center rounded-md border border-white/8 bg-black text-zinc-400 transition-colors hover:border-white/20 hover:text-white disabled:pointer-events-none disabled:opacity-30"
              >
                <ChevronRight className="size-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
