import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useAppSelector } from "@/store/hooks";
import { ChevronDown, ChevronUp, Minus } from "lucide-react";
import { LeaderboardSkeleton } from "@/organization/components/skeletons";
import { portalQueries } from "@/organization/data/queries";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";

const q = portalQueries.leaderboard();

export const Route = createFileRoute("/portal/leaderboard")({
  head: () => ({
    meta: [
      { title: "University Leaderboard — CCC Medi-Caps" },
      {
        name: "description",
        content:
          "University-wide CCC rating standings from verified offline contests.",
      },
      { property: "og:title", content: "CCC Medi-Caps University Leaderboard" },
      {
        property: "og:description",
        content:
          "Verified offline contest ratings across CSE, IT, AIDS and Cyber Security.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(q),
  pendingComponent: LeaderboardSkeleton,
  component: Leaderboard,
});

function Spark({ data }: { data: number[] }) {
  if (!data || data.length < 2) return <span className="spark-empty" aria-hidden="true" />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => `${i * 18},${24 - ((v - min) / range) * 20}`)
    .join(" ");
  return (
    <svg viewBox="0 0 90 28" className="spark" aria-hidden="true">
      <polyline points={pts} />
    </svg>
  );
}

function Leaderboard() {
  const { data } = useSuspenseQuery(q);
  const currentMemberId = useAppSelector((s) => s.auth.member?.id);
  const rows = data;

  return (
    <div className="page-wrap">
      <header className="page-header">
        <div>
          <p className="kicker">Verified Elo index</p>
          <h1>University leaderboard.</h1>
          <p>
            One standing across CSE, IT, AIDS, and Cyber Security. Browser
            activity never affects rank.
          </p>
        </div>
        <div className="ranking-meta">
          <span>RATING CYCLE</span>
          <strong>MONSOON '26</strong>
          <small>{data.length} active members</small>
        </div>
      </header>

      <div className="table-scroll leaderboard-table border border-[var(--line)] bg-[var(--surface-2)]">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-[var(--line)] hover:bg-transparent">
              <TableHead className="text-left font-mono text-xs uppercase font-bold text-[var(--muted)]">Rank</TableHead>
              <TableHead className="text-left font-mono text-xs uppercase font-bold text-[var(--muted)]">Member</TableHead>
              <TableHead className="text-left font-mono text-xs uppercase font-bold text-[var(--muted)]">Trend</TableHead>
              <TableHead className="text-left font-mono text-xs uppercase font-bold text-[var(--muted)]">Rating</TableHead>
              <TableHead className="text-left font-mono text-xs uppercase font-bold text-[var(--muted)]">Peak</TableHead>
              <TableHead className="text-left font-mono text-xs uppercase font-bold text-[var(--muted)]">Attended</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center py-12 text-[#777] font-mono text-sm"
                >
                  No ranked members found in university standings.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((x) => {
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
                  <TableRow key={x.handle} className={isYou ? "is-you bg-[var(--accent)]/10 hover:bg-[var(--accent)]/15 border-l-2 border-l-[var(--accent)]" : "border-b border-[var(--line)] hover:bg-[var(--surface-3)]"}>
                    <TableCell>
                      <div className="rank-cell">
                        <strong>
                          {String(x.university_rank).padStart(2, "0")}
                        </strong>
                        <span
                          className={
                            change > 0 ? "up" : change < 0 ? "down" : "flat"
                          }
                        >
                          {change > 0 ? (
                            <ChevronUp />
                          ) : change < 0 ? (
                            <ChevronDown />
                          ) : (
                            <Minus />
                          )}
                          {Math.abs(change) || "—"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="competitor">
                        <strong>{x.handle}</strong>
                        <span>{x.full_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Spark data={x.ratings ?? []} />
                    </TableCell>
                    <TableCell className="score-value font-mono font-bold">{x.rating}</TableCell>
                    <TableCell className="mono-value font-mono">{x.peak_rating}</TableCell>
                    <TableCell>
                      <span className="attendance-meter">
                        <i style={{ width: `${attendancePct}%` }} />
                      </span>
                      <small>
                        {attendanceCount}/{attendanceTotal}
                      </small>
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
