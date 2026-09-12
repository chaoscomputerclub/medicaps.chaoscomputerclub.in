/**
 * Chaos Computer Club India — Phase 1 Screening Leaderboard & Top 30 Qualifiers
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Award, CheckCircle, QrCode, ShieldCheck, Trophy, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchAssessmentLeaderboard, getApiBase, getToken } from "@/lib/auth";

export const Route = createFileRoute("/portal/assessments/$contestSlug/leaderboard")({
  head: () => ({
    meta: [
      { title: "Phase 1 Screening Standings — CCC Medi-Caps" },
      {
        name: "description",
        content: "Verified standings and Top 30 lab qualifiers for CCC Medi-Caps offline contests.",
      },
    ],
  }),
  component: AssessmentLeaderboardView,
});

function AssessmentLeaderboardView() {
  const { contestSlug } = Route.useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [qualifying, setQualifying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchAssessmentLeaderboard(contestSlug)
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [contestSlug]);

  async function handleQualifyTop30() {
    setQualifying(true);
    setMessage(null);
    try {
      const apiBase = getApiBase();
      const token = getToken();
      const res = await fetch(`${apiBase}/assessment/${contestSlug}/qualify-top30`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const json = await res.json();
      if (json.success) {
        setMessage(`Successfully qualified ${json.qualified_count} candidates and issued digital campus QR passes!`);
        const updated = await fetchAssessmentLeaderboard(contestSlug);
        setData(updated);
      }
    } catch {
      setMessage("Failed to qualify candidates.");
    } finally {
      setQualifying(false);
    }
  }

  return (
    <div className="page-wrap">
      <header className="page-header">
        <div>
          <Link
            to="/portal/contests"
            className="inline-flex items-center gap-1 font-mono text-xs text-subtle-foreground hover:text-accent mb-2 transition-colors"
          >
            <ArrowLeft size={13} /> Back to Contests
          </Link>
          <p className="kicker">Phase 1 Screening Standings</p>
          <h1>{data?.assessment_title ?? "Assessment Leaderboard"}</h1>
          <p>
            The top 30 rankers on this leaderboard qualify for the physical, proctored offline battle in CS Lab 401–404.
          </p>
        </div>

        <div className="flex flex-col items-end gap-3">
          <div className="ranking-meta">
            <span>QUALIFICATION CUTOFF</span>
            <strong>TOP 30 ONLY</strong>
            <small>{data?.total_participants ?? 0} participants</small>
          </div>

          <Button
            size="sm"
            onClick={handleQualifyTop30}
            disabled={qualifying || !data?.leaderboard?.length}
            className="gap-2 font-mono text-xs bg-accent text-accent-foreground hover:bg-accent/90"
          >
            <QrCode size={14} />
            {qualifying ? "Issuing Passes…" : "Issue Top 30 QR Passes"}
          </Button>
        </div>
      </header>

      {message && (
        <div className="p-3 rounded bg-emerald-950/40 border border-emerald-800/50 text-emerald-300 text-xs font-mono flex items-center gap-2">
          <CheckCircle size={14} />
          <span>{message}</span>
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-xs font-mono text-[#777]">Loading screening standings…</div>
      ) : (
        <div className="table-scroll leaderboard-table">
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Candidate</th>
                <th>Department</th>
                <th>Score</th>
                <th>Penalty</th>
                <th>Status</th>
                <th>Offline Lab Access</th>
              </tr>
            </thead>
            <tbody>
              {data?.leaderboard?.map((row: any) => {
                const isTop30 = row.rank <= 30;
                return (
                  <tr
                    key={row.handle}
                    className={isTop30 ? "is-you" : ""}
                    style={row.rank === 30 ? { borderBottom: "2px dashed var(--accent)" } : undefined}
                  >
                    <td>
                      <div className="rank-cell">
                        <strong>{String(row.rank).padStart(2, "0")}</strong>
                      </div>
                    </td>
                    <td>
                      <div className="competitor">
                        <strong>@{row.handle}</strong>
                        <span>{row.full_name}</span>
                      </div>
                    </td>
                    <td>
                      <span className="mono-tag">{row.department} · {row.batch}</span>
                    </td>
                    <td className="score-value">
                      <strong>{row.total_score}</strong> pts
                    </td>
                    <td className="mono-value">{row.penalty_minutes}m</td>
                    <td>
                      <span className="mono-tag uppercase">{row.status}</span>
                    </td>
                    <td>
                      {row.is_top_30_qualified || isTop30 ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400 font-mono text-xs font-semibold">
                          <CheckCircle size={13} /> QUALIFIED (PASS ISSUED)
                        </span>
                      ) : (
                        <span className="text-[#666] font-mono text-xs">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {data?.leaderboard?.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-xs font-mono text-[#666]">
                    No submissions recorded yet for this round.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
