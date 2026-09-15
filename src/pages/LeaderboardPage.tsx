import { Link } from "react-router-dom";
import { useAppSelector } from "@/store/hooks";
import { ChevronDown, ChevronUp, Minus } from "lucide-react";
import { getUniversityLeaderboardData } from "@/organization/data/portal.functions";
import { LeaderboardRowSkeleton } from "@/organization/components/skeletons";
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
  if (!data || data.length < 2) return <span className="spark-empty" aria-hidden="true" />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => `${i * 18},${24 - ((v - min) / range) * 20}`)
    .join(" ");
  return (
    <svg viewBox="0 0 90 28" className="w-[90px] h-[28px] stroke-[var(--accent)] fill-none stroke-2" aria-hidden="true">
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
    <div className="page-wrap space-y-6">
      <header className="page-header">
        <div>
          <p className="kicker">Verified Elo index</p>
          <h1>University leaderboard.</h1>
          <p>
            One standing across CSE, IT, AIDS, and Cyber Security. Browser activity never affects rank.
          </p>
        </div>
        <div className="ranking-meta">
          <span>RATING CYCLE</span>
          <strong>MONSOON '26</strong>
          <small>{data.length} active members</small>
        </div>
      </header>

      <div className="overflow-x-auto border border-[#292929] bg-[#0d0d0d]">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-[#292929] hover:bg-transparent bg-neutral-900/50">
              <TableHead className="text-left font-mono text-xs uppercase font-bold text-neutral-400">Rank</TableHead>
              <TableHead className="text-left font-mono text-xs uppercase font-bold text-neutral-400">Member</TableHead>
              <TableHead className="text-left font-mono text-xs uppercase font-bold text-neutral-400">Trend</TableHead>
              <TableHead className="text-left font-mono text-xs uppercase font-bold text-neutral-400">Rating</TableHead>
              <TableHead className="text-left font-mono text-xs uppercase font-bold text-neutral-400">Peak</TableHead>
              <TableHead className="text-left font-mono text-xs uppercase font-bold text-neutral-400">Attended</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <LeaderboardRowSkeleton count={8} />
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center py-12 text-neutral-500 font-mono text-sm"
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
                    className={
                      isYou
                        ? "bg-[var(--accent)]/10 hover:bg-[var(--accent)]/15 border-l-2 border-l-[var(--accent)] border-b border-[#292929]"
                        : "border-b border-[#292929] hover:bg-neutral-900/40"
                    }
                  >
                    <TableCell>
                      <div className="flex items-center gap-2 font-mono">
                        <strong className="text-white text-sm">
                          {String(x.university_rank).padStart(2, "0")}
                        </strong>
                        <span
                          className={`inline-flex items-center text-xs ${
                            change > 0 ? "text-emerald-400" : change < 0 ? "text-rose-400" : "text-neutral-500"
                          }`}
                        >
                          {change > 0 ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : change < 0 ? (
                            <ChevronDown className="w-3.5 h-3.5" />
                          ) : (
                            <Minus className="w-3.5 h-3.5" />
                          )}
                          {Math.abs(change) || "—"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <Link
                          to={`/portal/profile/${x.handle}`}
                          className="font-mono text-sm text-white hover:text-[var(--accent)] hover:underline transition-colors w-fit"
                        >
                          @{x.handle}
                        </Link>
                        <span className="text-xs text-neutral-400">{x.full_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Spark data={x.ratings ?? []} />
                    </TableCell>
                    <TableCell className="font-mono font-bold text-[var(--accent)]">{x.rating}</TableCell>
                    <TableCell className="font-mono text-neutral-300">{x.peak_rating}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-neutral-800 rounded-none overflow-hidden">
                          <div className="h-full bg-[var(--accent)]" style={{ width: `${attendancePct}%` }} />
                        </div>
                        <small className="font-mono text-xs text-neutral-400">
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
  );
}
