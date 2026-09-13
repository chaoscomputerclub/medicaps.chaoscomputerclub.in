const EMBLEM_MAP: Record<string, { icon: string; bg: string; border: string; text: string }> = {
  volt: { icon: "⚡", bg: "bg-lime-500/10", border: "border-lime-500/40", text: "text-lime-400" },
  binary: { icon: "👾", bg: "bg-cyan-500/10", border: "border-cyan-500/40", text: "text-cyan-400" },
  quantum: {
    icon: "⚛️",
    bg: "bg-purple-500/10",
    border: "border-purple-500/40",
    text: "text-purple-400",
  },
  matrix: {
    icon: "💻",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/40",
    text: "text-emerald-400",
  },
  grandmaster: {
    icon: "🏆",
    bg: "bg-amber-500/10",
    border: "border-amber-500/40",
    text: "text-amber-400",
  },
  cipher: { icon: "🛡️", bg: "bg-rose-500/10", border: "border-rose-500/40", text: "text-rose-400" },
};

import { cn } from "@/lib/utils";
import { openSocialDrawer } from "@/store/slices/socialSlice";
import { openEditProfileModal } from "@/store/slices/uiSlice";
import { useAppDispatch } from "@/store/hooks";
import { Users, Edit3, UserCheck, Github, Linkedin } from "lucide-react";
import { ProfileSkeleton } from "@/organization/components/skeletons";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Award, ExternalLink, LockKeyhole, ShieldCheck, Zap } from "lucide-react";
import { RatingDistributionCard } from "@/organization/components/RatingDistributionCard";
import { ProofBadge } from "@/organization/components/ProofBadge";
import { RatingChart } from "@/organization/components/RatingChart";
import { Metric, SectionHeader, TierBadge } from "@/organization/components/ui";
import { portalQueries } from "@/organization/data/queries";
const qs = [
  portalQueries.member(),
  portalQueries.ratingHistory(),
  portalQueries.recentBattles(),
  portalQueries.campusPass(),
  portalQueries.proofs(),
  portalQueries.achievements(),
  portalQueries.ratingDistribution(),
] as const;
import { redirect } from "@tanstack/react-router";
import { isAuthenticated } from "@/lib/auth";

export const Route = createFileRoute("/portal/profile")({
  beforeLoad: () => {
    if (typeof window !== "undefined" && !isAuthenticated()) {
      throw redirect({ to: "/auth" });
    }
  },
  head: () => ({
    meta: [
      { title: "Competitive Profile — CCC Medi-Caps" },
      {
        name: "description",
        content:
          "Personal rating, offline contest history, campus pass and verified result proofs.",
      },
      { property: "og:title", content: "Competitive Profile — CCC Medi-Caps" },
      {
        property: "og:description",
        content: "A member's verified offline competitive programming record.",
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => {
    if (typeof window !== "undefined" && !isAuthenticated()) {
      throw redirect({ to: "/auth" });
    }
    return Promise.all([
      context.queryClient.ensureQueryData(qs[0]),
      context.queryClient.ensureQueryData(qs[1]),
      context.queryClient.ensureQueryData(qs[2]),
      context.queryClient.ensureQueryData(qs[3]),
      context.queryClient.ensureQueryData(qs[4]),
      context.queryClient.ensureQueryData(qs[5]),
      context.queryClient.ensureQueryData(qs[6]),
    ]);
  },
  pendingComponent: ProfileSkeleton,
  component: Profile,
});
function Profile() {
  const dispatch = useAppDispatch();
  if (typeof window !== "undefined" && !isAuthenticated()) {
    window.location.href = "/auth";
    return null;
  }
  const { data: m } = useSuspenseQuery(qs[0]);
  const { data: history } = useSuspenseQuery(qs[1]);
  const { data: battles } = useSuspenseQuery(qs[2]);
  const { data: pass } = useSuspenseQuery(qs[3]);
  const { data: proofs } = useSuspenseQuery(qs[4]);
  const { data: achievements } = useSuspenseQuery(qs[5]);
  const { data: distribution } = useSuspenseQuery(qs[6]);
  const activeEmblem = m.avatar_url ? EMBLEM_MAP[m.avatar_url] : null;
  const initials = m.full_name
    ? m.full_name
        .split(" ")
        .map((w: string) => w[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : m.handle
      ? m.handle.slice(0, 2).toUpperCase()
      : "CC";
  return (
    <div className="page-wrap">
      <header className="profile-header">
        {m.avatar_url &&
        (m.avatar_url.startsWith("http") ||
          m.avatar_url.startsWith("/media/") ||
          m.avatar_url.startsWith("/")) ? (
          <div className="profile-mark overflow-hidden bg-zinc-900 border border-[var(--line)]">
            <img
              src={m.avatar_url}
              alt={m.full_name || m.handle}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLElement).style.display = "none";
                e.currentTarget.parentElement!.innerText = initials;
              }}
            />
          </div>
        ) : activeEmblem ? (
          <div
            className={cn(
              "profile-mark flex items-center justify-center font-mono text-2xl border",
              activeEmblem.bg,
              activeEmblem.border,
              activeEmblem.text,
            )}
          >
            <span>{activeEmblem.icon}</span>
          </div>
        ) : (
          <div className="profile-mark">{initials}</div>
        )}
        <div className="min-w-0 flex-1">
          <p className="kicker">Competitive identity</p>
          <div className="flex items-center gap-3 flex-wrap">
            <h1>{m.full_name}</h1>
            <button
              type="button"
              id="profile-edit-btn"
              onClick={() => dispatch(openEditProfileModal())}
              className="inline-flex items-center gap-1.5 px-3 py-1 font-mono text-xs uppercase font-bold text-[var(--accent)] bg-[var(--accent)]/10 border border-[var(--accent)]/40 hover:bg-[var(--accent)] hover:text-[var(--accent-ink)] rounded-[1px] transition-all cursor-pointer shadow-[0_0_10px_rgba(200,255,54,0.1)]"
            >
              <Edit3 size={12} />
              <span>Edit Profile</span>
            </button>
          </div>
          <p className="profile-sub text-xs text-[var(--muted)] font-mono mt-0.5">
            @{m.handle} · {m.department} · {m.batch}
          </p>

          {m.bio && (
            <div className="profile-bio-box mt-2.5 mb-2 p-2.5 bg-[var(--surface-2)] border border-[var(--line)] rounded-[1px] max-w-xl">
              <p className="text-xs text-zinc-300 italic leading-relaxed">"{m.bio}"</p>
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap mt-2.5">
            <TierBadge>{m.tier}</TierBadge>
            {m.is_core_member && (
              <span className="proof-seal">
                <ShieldCheck size={12} /> CORE MEMBER
              </span>
            )}
            <button
              type="button"
              id="profile-followers-btn"
              onClick={() =>
                dispatch(
                  openSocialDrawer({
                    targetHandle: m.handle,
                    targetName: m.full_name,
                    type: "followers",
                  }),
                )
              }
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono uppercase bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--muted)] hover:text-white border border-[var(--line)] hover:border-[var(--accent)]/50 rounded-[1px] transition-all cursor-pointer group"
            >
              <Users
                size={12}
                className="text-[var(--accent)] group-hover:scale-110 transition-transform"
              />
              <strong className="text-white font-mono">{m.followers_count ?? 0}</strong> Followers
            </button>
            <button
              type="button"
              id="profile-following-btn"
              onClick={() =>
                dispatch(
                  openSocialDrawer({
                    targetHandle: m.handle,
                    targetName: m.full_name,
                    type: "following",
                  }),
                )
              }
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono uppercase bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--muted)] hover:text-white border border-[var(--line)] hover:border-[var(--accent)]/50 rounded-[1px] transition-all cursor-pointer group"
            >
              <UserCheck
                size={12}
                className="text-[var(--accent)] group-hover:scale-110 transition-transform"
              />
              <strong className="text-white font-mono">{m.following_count ?? 0}</strong> Following
            </button>
            {m.github_username && (
              <a
                href={`https://github.com/${m.github_username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-mono text-zinc-300 hover:text-white bg-[var(--surface-2)] border border-[var(--line)] hover:border-zinc-500 rounded-[1px] transition-colors"
              >
                <Github size={12} />
                <span>{m.github_username}</span>
              </a>
            )}
            {m.linkedin_url && (
              <a
                href={
                  m.linkedin_url.startsWith("http")
                    ? m.linkedin_url
                    : `https://linkedin.com/in/${m.linkedin_url}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-mono text-[#0a66c2] hover:brightness-125 bg-[var(--surface-2)] border border-[var(--line)] hover:border-[#0a66c2]/60 rounded-[1px] transition-colors"
              >
                <Linkedin size={12} />
                <span>LinkedIn</span>
              </a>
            )}
          </div>
        </div>
        <dl>
          <div>
            <dt>PRN</dt>
            <dd>{m.prn}</dd>
          </div>
          <div>
            <dt>Institutional mail</dt>
            <dd>{m.email}</dd>
          </div>
        </dl>
      </header>
      <section className="metrics-grid">
        <Metric label="Rating" value={m.rating} detail={`Peak ${m.peak_rating}`} />
        <Metric
          label="University rank"
          value={`#${m.university_rank}`}
          detail={`of ${m.active_members}`}
        />
        <Metric label="Podiums" value={m.podiums} detail="Verified finishes" />
        <Metric
          label="Attendance"
          value={`${m.attendance_count}/${m.attendance_total}`}
          detail="Offline contests"
        />
      </section>
      <section className="content-grid">
        <div className="panel wide">
          <SectionHeader kicker="Rating archive" title="Competitive trajectory" />
          <RatingChart data={history} />
        </div>
        <div>
          <RatingDistributionCard member={m} distribution={distribution} />
        </div>
      </section>
      <section className="panel">
        <SectionHeader kicker="Permanent record" title="Offline battle history" />
        <div className="battle-history">
          {battles.length === 0 ? (
            <div className="text-center py-8 text-[#777] font-mono text-xs">
              No offline battles recorded yet. Attend an offline contest to establish a permanent
              record.
            </div>
          ) : (
            battles.map((b) => (
              <article key={b.certificate_id}>
                <time>
                  {new Date(b.date).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </time>
                <div>
                  <h3>{b.contest}</h3>
                  <code>{b.certificate_id}</code>
                </div>
                <span>
                  RANK <strong>#{b.rank}</strong>
                </span>
                <span>
                  SOLVED <strong>{b.solved}</strong>
                </span>
                <span>
                  PENALTY <strong>{b.penalty}</strong>
                </span>
                <em className={b.delta >= 0 ? "positive" : "negative"}>
                  {b.delta > 0 ? "+" : ""}
                  {b.delta}
                </em>
              </article>
            ))
          )}
        </div>
      </section>
      <section className="content-grid">
        <div className="panel">
          <SectionHeader kicker="Milestones" title="Achievement ledger" />
          <div className="achievement-grid">
            {achievements.length === 0 ? (
              <div className="text-center py-8 text-[#777] font-mono text-xs col-span-2">
                No achievements unlocked yet.
              </div>
            ) : (
              achievements.map((a) => (
                <article key={a.code} className={a.earned ? "earned" : "locked"}>
                  {a.earned ? <Award /> : <LockKeyhole />}
                  <span>{a.code}</span>
                  <h3>{a.name}</h3>
                  <p>{a.description}</p>
                </article>
              ))
            )}
          </div>
        </div>
        <div>
          <SectionHeader kicker="Cryptographic result" title="Latest proof" />
          {proofs[0] && <ProofBadge proof={proofs[0]} />}
          <Link
            className="text-link proof-link"
            to="/portal/verify"
            search={{ proof: proofs[0]?.certificate_id ?? "" }}
          >
            Open verification console <ExternalLink />
          </Link>
        </div>
      </section>
      <footer className="trust-footer">
        <Zap />
        <p>
          Your profile only reflects attended, proctored sessions. Practice streaks and browser
          activity are intentionally excluded.
        </p>
      </footer>
    </div>
  );
}
