/**
 * Chaos Computer Club India — University Leaderboard
 * Premium brutalist aesthetic with mathematical column alignment,
 * calm baseline telemetry for flat ratings, balanced symmetrical gapping,
 * and deterministic initials avatars.
 * Columns: RANK | NAME | ATTENDED | TREND | SCORE
 */

import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useAppSelector } from "@/store/hooks";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { LeaderboardSkeleton } from "@/organization/components/skeletons";
import { portalQueries } from "@/organization/data/queries";
import type { LeaderboardEntry } from "@/organization/data/types";
import { cn } from "@/lib/utils";

const q = portalQueries.leaderboard();

export const Route = createFileRoute("/portal/leaderboard")({
  head: () => ({
    meta: [
      { title: "University Leaderboard — CCC Medi-Caps" },
      {
        name: "description",
        content:
          "University-wide CCC rating standings from verified offline contests across CSE, IT, AIDS, and Cyber Security.",
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

/** Deterministic hue from a string — stable unique avatar color per user */
function stringToHue(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

/** Precision inline SVG sparkline — balanced baseline for flat ratings, clean deltas */
function Sparkline({ values }: { values: number[] }) {
  const W = 72;
  const H = 18;
  const midY = H / 2;

  // If no rating history or flat/unchanged ratings: render subtle, quiet baseline
  const isFlat = !values || values.length < 2 || values.every((v) => v === values[0]);

  if (isFlat) {
    return (
      <div className="lb-trend-wrap">
        <svg className="spark" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          <line
            x1="0"
            y1={midY}
            x2={W}
            y2={midY}
            stroke="var(--line-strong)"
            strokeWidth="1.5"
            strokeDasharray="3 3"
          />
        </svg>
      </div>
    );
  }

  const pad = 2;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (W - pad * 2);
    const y = H - pad - ((v - min) / range) * (H - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const first = values[0] ?? 0;
  const last = values[values.length - 1] ?? first;
  const isUp = last > first;
  const strokeColor = isUp ? "var(--accent)" : "var(--danger)";

  const lastX = W - pad;
  const lastY = H - pad - ((last - min) / range) * (H - pad * 2);

  return (
    <div className="lb-trend-wrap">
      <svg className="spark" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
        <polyline points={pts.join(" ")} stroke={strokeColor} fill="none" strokeWidth="1.75" />
        <circle cx={lastX} cy={lastY} r="2" fill={strokeColor} />
      </svg>
    </div>
  );
}

function AvatarBubble({ item }: { item: LeaderboardEntry }) {
  const hasImg = Boolean(
    item.avatar_url &&
      (item.avatar_url.startsWith("http") ||
        item.avatar_url.startsWith("/media/") ||
        item.avatar_url.startsWith("/"))
  );

  const initials = item.full_name
    ? item.full_name
        .split(" ")
        .map((w) => w[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : item.handle?.slice(0, 2).toUpperCase() || "CC";

  const seed = item.full_name || item.handle || "cc";
  const hue = stringToHue(seed);
  const avatarStyle = {
    background: `hsl(${hue}, 45%, 15%)`,
    color: `hsl(${hue}, 80%, 75%)`,
    border: `1px solid hsl(${hue}, 45%, 28%)`,
  };

  if (hasImg) {
    return (
      <div className="lb-avatar" style={{ border: avatarStyle.border }}>
        <img
          src={item.avatar_url!}
          alt={item.full_name || item.handle}
          className="w-full h-full object-cover"
          onError={(e) => {
            const el = e.currentTarget as HTMLImageElement;
            el.style.display = "none";
            const p = el.parentElement!;
            Object.assign(p.style, {
              background: avatarStyle.background,
              color: avatarStyle.color,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "var(--font-mono)",
              fontWeight: "700",
              fontSize: "11px",
            });
            p.textContent = initials;
          }}
        />
      </div>
    );
  }

  return (
    <div className="lb-avatar" style={avatarStyle}>
      {initials}
    </div>
  );
}

/** Rank delta indicator with micro icons */
function RankDelta({ change }: { change: number }) {
  if (change > 0)
    return (
      <span className="lb-delta lb-delta--up">
        <TrendingUp size={11} /> {change}
      </span>
    );
  if (change < 0)
    return (
      <span className="lb-delta lb-delta--down">
        <TrendingDown size={11} /> {Math.abs(change)}
      </span>
    );
  return (
    <span className="lb-delta lb-delta--flat">
      <Minus size={11} />
    </span>
  );
}

function Leaderboard() {
  const { data } = useSuspenseQuery(q);
  const currentMemberId = useAppSelector((s) => s.auth.member?.id);

  return (
    <div className="page-wrap">
      {/* Header */}
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

      {/* Table: Strictly defined fixed columns with symmetrical rhythm */}
      <div className="table-scroll leaderboard-table">
        <table>
          <colgroup>
            <col style={{ width: "90px" }} />
            <col />
            <col style={{ width: "170px" }} />
            <col style={{ width: "135px" }} />
            <col style={{ width: "120px" }} />
          </colgroup>
          <thead>
            <tr>
              <th className="lb-th-rank">Rank</th>
              <th className="lb-th-name">Name</th>
              <th className="lb-th-attended">Attended</th>
              <th className="lb-th-trend">Trend</th>
              <th className="lb-th-score">Score</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  style={{
                    textAlign: "center",
                    padding: "48px 0",
                    color: "var(--muted)",
                    fontFamily: "var(--font-mono)",
                    fontSize: "12px",
                  }}
                >
                  No ranked members found in university standings.
                </td>
              </tr>
            ) : (
              data.map((x) => {
                const change =
                  (x.previous_rank ?? x.university_rank) - x.university_rank;
                const isYou = x.id === currentMemberId;
                const attended = x.attendance_count ?? 0;
                const total = x.attendance_total || 6;
                const pct = Math.min((attended / total) * 100, 100);
                const rating =
                  typeof x.rating === "number"
                    ? x.rating
                    : Number(x.rating) || 0;
                const sparkData: number[] = Array.isArray(x.ratings)
                  ? x.ratings.map(Number).filter(isFinite)
                  : [rating];

                return (
                  <tr
                    key={x.handle}
                    className={cn("lb-row", isYou && "lb-row--you")}
                  >
                    {/* 1. RANK */}
                    <td className="lb-td-rank">
                      <div className="rank-cell">
                        <strong>
                          {String(x.university_rank).padStart(2, "0")}
                        </strong>
                        <RankDelta change={change} />
                      </div>
                    </td>

                    {/* 2. NAME */}
                    <td className="lb-td-name">
                      <div className="lb-name-cell">
                        <AvatarBubble item={x} />
                        <div className="competitor">
                          <div className="lb-name-row">
                            <strong>{x.full_name || x.handle}</strong>
                            {isYou && (
                              <span className="proof-seal text-[8px] py-0.5 px-1.5 font-mono">
                                YOU
                              </span>
                            )}
                          </div>
                          <span>@{x.handle}</span>
                        </div>
                      </div>
                    </td>

                    {/* 3. ATTENDED */}
                    <td className="lb-td-attended">
                      <div className="lb-attendance">
                        <span className="attendance-meter">
                          <i style={{ width: `${pct}%` }} />
                        </span>
                        <small>
                          {attended}/{total}
                        </small>
                      </div>
                    </td>

                    {/* 4. TREND — Left-aligned directly beneath header */}
                    <td className="lb-td-trend">
                      <Sparkline values={sparkData} />
                    </td>

                    {/* 5. SCORE — Perfect Right Alignment */}
                    <td className="lb-td-score">
                      <span>{rating.toLocaleString()}</span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
