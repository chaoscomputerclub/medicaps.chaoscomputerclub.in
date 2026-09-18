import { Link } from "react-router-dom";
import { useAppSelector } from "@/store/hooks";
import { ChevronDown, ChevronUp, Minus, Trophy } from "lucide-react";
import { getUniversityLeaderboardData } from "@/organization/data/portal.functions";
import { LeaderboardRowSkeleton } from "@/organization/components/skeletons";
import { PageHeader } from "@/organization/components/ui";
import { useSwrData } from "@/lib/cache/swrCache";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";

function Spark({ data }: { data: number[] }) {
  if (!data || data.length < 2) return <span className="inline-block h-2 w-12 rounded bg-zinc-800" aria-hidden="true" />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => `${i * 18},${24 - ((v - min) / range) * 20}`)
    .join(" ");
  return (
    <svg viewBox="0 0 90 28" className="h-7 w-[90px] stroke-lime-400 fill-none stroke-2" aria-hidden="true">
      <polyline points={pts} />
    </svg>
  );
}

export function LeaderboardPage() {
  const { data: rawData, loading } = useSwrData(
    "leaderboard:university",
    getUniversityLeaderboardData,
    { staleTime: 30000, persistSession: true }
  );
  const data = rawData || [];
  const currentMemberId = useAppSelector((s) => s.auth.member?.id);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <PageHeader
        kicker="02 // Standings"
        index="INDEX 2.0 · ELO MATRIX"
        badge={
          <span className="inline-flex items-center gap-1.5 rounded-none border border-lime-400/30 bg-lime-400/10 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-lime-400">
            <Trophy className="size-3 text-lime-400" /> Verified Elo Standings
          </span>
        }
        title="University Leaderboard"
        description="Unified rankings across CSE, IT, AIDS, and Cyber Security. Only verified contest performance impacts student Elo rating."
        action={
          <div className="flex flex-col items-start md:items-end justify-center rounded-none border border-white/10 bg-zinc-950/60 p-4 min-w-[200px] backdrop-blur-sm">
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-400">Rating Cycle</span>
            <strong className="font-mono text-lg font-black text-white">MONSOON '26</strong>
            <small className="font-mono text-xs text-lime-400 tabular-nums">{data.length} active members</small>
          </div>
        }
      />

      {/* Table Container */}
      <div className="overflow-hidden rounded-none border border-white/10 bg-zinc-900/60 shadow-xl backdrop-blur-md">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-white/10 bg-zinc-950/80 hover:bg-zinc-950/80">
                <TableHead className="py-4 pl-6 text-left font-mono text-xs font-bold uppercase tracking-wider text-zinc-400">Rank</TableHead>
                <TableHead className="py-4 text-left font-mono text-xs font-bold uppercase tracking-wider text-zinc-400">Cadet / Handle</TableHead>
                <TableHead className="py-4 text-left font-mono text-xs font-bold uppercase tracking-wider text-zinc-400">Trend</TableHead>
                <TableHead className="py-4 text-left font-mono text-xs font-bold uppercase tracking-wider text-zinc-400">Rating</TableHead>
                <TableHead className="py-4 text-left font-mono text-xs font-bold uppercase tracking-wider text-zinc-400">Peak</TableHead>
                <TableHead className="py-4 pr-6 text-left font-mono text-xs font-bold uppercase tracking-wider text-zinc-400">Attendance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <LeaderboardRowSkeleton count={8} />
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-16 text-center font-mono text-sm text-zinc-400"
                  >
                    No ranked members found in university standings.
                  </TableCell>
                </TableRow>
              ) : (
                data.map((x) => {
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
                      className={`border-b border-white/5 transition-colors ${
                        isYou
                          ? "bg-lime-400/10 border-l-2 border-l-lime-400 hover:bg-lime-400/15"
                          : "hover:bg-zinc-800/40"
                      }`}
                    >
                      <TableCell className="pl-6">
                        <div className="flex items-center gap-2 font-mono">
                          <strong className="text-sm font-black tabular-nums text-white">
                            {String(x.university_rank).padStart(2, "0")}
                          </strong>
                          <span
                            className={`inline-flex items-center font-mono text-xs tabular-nums ${
                              change > 0 ? "text-emerald-400" : change < 0 ? "text-rose-400" : "text-zinc-500"
                            }`}
                          >
                            {change > 0 ? (
                              <ChevronUp className="size-3.5" />
                            ) : change < 0 ? (
                              <ChevronDown className="size-3.5" />
                            ) : (
                              <Minus className="size-3.5" />
                            )}
                            {Math.abs(change) || "—"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <Link
                            to={`/portal/profile/${x.handle}`}
                            className="font-mono text-sm font-bold text-white hover:text-lime-400 hover:underline transition-colors w-fit"
                          >
                            @{x.handle}
                          </Link>
                          <span className="text-xs text-zinc-400">{x.full_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Spark data={x.ratings ?? []} />
                      </TableCell>
                      <TableCell className="font-mono font-black tabular-nums text-lime-400">{x.rating}</TableCell>
                      <TableCell className="font-mono tabular-nums text-zinc-300">{x.peak_rating}</TableCell>
                      <TableCell className="pr-6">
                        <div className="flex items-center gap-3">
                          <div className="h-2 w-20 overflow-hidden rounded-none bg-zinc-800">
                            <div
                              className="h-full rounded-none bg-lime-400 transition-all duration-300"
                              style={{ width: `${attendancePct}%` }}
                            />
                          </div>
                          <small className="font-mono text-xs font-semibold tabular-nums text-zinc-400">
                            {attendanceCount}/{attendanceTotal}
                          </small>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
