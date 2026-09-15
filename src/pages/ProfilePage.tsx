import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Users,
  Edit3,
  UserCheck,
  Github,
  Linkedin,
  Award,
  ExternalLink,
  LockKeyhole,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { openSocialDrawer } from "@/store/slices/socialSlice";
import { openEditProfileModal } from "@/store/slices/uiSlice";
import { useAppDispatch } from "@/store/hooks";
import { RatingDistributionCard } from "@/organization/components/RatingDistributionCard";
import { ProofBadge } from "@/organization/components/ProofBadge";
import { RatingChart } from "@/organization/components/RatingChart";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Metric, SectionHeader, TierBadge } from "@/organization/components/ui";
import {
  getMemberProfileData,
  getRatingDistribution,
} from "@/organization/data/portal.functions";
import { isAuthenticated } from "@/lib/auth";

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

export function ProfilePage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<any>(null);
  const [distribution, setDistribution] = useState<any>(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate("/auth", { replace: true });
      return;
    }

    let active = true;
    Promise.all([getMemberProfileData(), getRatingDistribution()])
      .then(([pData, dist]) => {
        if (active) {
          setProfileData(pData);
          setDistribution(dist);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load profile:", err);
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [navigate]);

  if (loading) {
    return (
      <div className="page-wrap p-6 max-w-7xl mx-auto py-24 text-center font-mono text-neutral-500 text-xs animate-pulse">
        LOADING MEMBER PROFILE...
      </div>
    );
  }

  const m = profileData?.member;
  if (!m) {
    return (
      <div className="page-wrap p-6 max-w-7xl mx-auto py-16 space-y-4">
        <h1 className="text-2xl font-mono font-bold text-white uppercase">Profile unavailable</h1>
        <p className="text-neutral-400 text-sm">Please log in to view your competition profile.</p>
        <Button onClick={() => navigate("/auth")} className="bg-[var(--accent)] text-black font-mono uppercase text-xs">
          Sign In
        </Button>
      </div>
    );
  }

  const history = profileData?.ratingHistory || [];
  const battles = profileData?.recentBattles || [];
  const proofs = profileData?.proofs || [];
  const achievements = profileData?.achievements || [];

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
    <div className="page-wrap space-y-8">
      {/* Profile Header */}
      <header className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 border-b border-[#292929] pb-8">
        <div className="flex items-start gap-5">
          <Avatar className="w-16 h-16 rounded-none border border-[#292929] bg-neutral-900 shrink-0">
            {m.avatar_url &&
            (m.avatar_url.startsWith("http") ||
              m.avatar_url.startsWith("/media/") ||
              m.avatar_url.startsWith("/")) ? (
              <AvatarImage src={m.avatar_url} alt={m.full_name || m.handle} className="object-cover" />
            ) : null}
            <AvatarFallback
              className={cn(
                "rounded-none font-mono text-xl font-bold flex items-center justify-center w-full h-full",
                activeEmblem
                  ? cn(activeEmblem.bg, activeEmblem.border, activeEmblem.text)
                  : "bg-[var(--accent)] text-black"
              )}
            >
              {activeEmblem ? activeEmblem.icon : initials}
            </AvatarFallback>
          </Avatar>

          <div className="space-y-1.5">
            <p className="kicker">Competitive identity</p>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl sm:text-4xl font-display font-bold text-white uppercase tracking-tight">{m.full_name}</h1>
              <Button
                type="button"
                id="profile-edit-btn"
                onClick={() => dispatch(openEditProfileModal())}
                className="h-auto inline-flex items-center gap-1.5 px-3 py-1 font-mono text-xs uppercase font-bold text-[var(--accent)] bg-[var(--accent)]/10 border border-[var(--accent)]/40 hover:bg-[var(--accent)] hover:text-black rounded-none cursor-pointer"
              >
                <Edit3 size={12} />
                <span>Edit Profile</span>
              </Button>
            </div>
            <p className="text-xs text-neutral-400 font-mono">
              @{m.handle} · {m.department} · {m.batch}
            </p>

            {m.bio && (
              <div className="mt-2.5 p-3 bg-neutral-900/50 border border-[#292929] rounded-none max-w-xl">
                <p className="text-xs text-neutral-300 italic leading-relaxed">"{m.bio}"</p>
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap pt-2">
              <TierBadge>{m.tier}</TierBadge>
              {m.is_core_member && (
                <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase font-bold text-[var(--accent)] border border-[var(--accent)]/40 px-2 py-0.5 bg-[var(--accent)]/10">
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
                    })
                  )
                }
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono uppercase bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-[#292929] hover:border-[var(--accent)]/50 rounded-none cursor-pointer"
              >
                <Users size={12} className="text-[var(--accent)]" />
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
                    })
                  )
                }
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono uppercase bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-[#292929] hover:border-[var(--accent)]/50 rounded-none cursor-pointer"
              >
                <UserCheck size={12} className="text-[var(--accent)]" />
                <strong className="text-white font-mono">{m.following_count ?? 0}</strong> Following
              </button>
              {m.github_username && (
                <a
                  href={`https://github.com/${m.github_username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-mono text-neutral-300 hover:text-white bg-neutral-900 border border-[#292929] hover:border-neutral-500 rounded-none"
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
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-mono text-[#0a66c2] hover:brightness-125 bg-neutral-900 border border-[#292929] hover:border-[#0a66c2]/60 rounded-none"
                >
                  <Linkedin size={12} />
                  <span>LinkedIn</span>
                </a>
              )}
            </div>
          </div>
        </div>

        <dl className="flex sm:flex-col gap-4 font-mono text-xs border-t lg:border-t-0 lg:border-l border-[#292929] pt-4 lg:pt-0 lg:pl-6">
          <div>
            <dt className="text-neutral-500 uppercase text-[10px]">PRN</dt>
            <dd className="text-neutral-200 font-bold">{m.prn}</dd>
          </div>
          <div>
            <dt className="text-neutral-500 uppercase text-[10px]">Institutional mail</dt>
            <dd className="text-neutral-200 font-bold">{m.email}</dd>
          </div>
        </dl>
      </header>

      {/* Metrics Grid */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Metric label="Rating" value={m.rating} detail={`Peak ${m.peak_rating}`} />
        <Metric
          label="University rank"
          value={(m.attendance_count ?? 0) > 0 ? `#${m.university_rank}` : "#—"}
          detail={(m.attendance_count ?? 0) > 0 ? `of ${m.active_members}` : "No contests yet"}
        />
        <Metric label="Podiums" value={m.podiums} detail="Verified finishes" />
        <Metric
          label="Attendance"
          value={`${m.attendance_count}/${m.attendance_total}`}
          detail="Offline contests"
        />
      </section>

      {/* Charts & Distribution */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 border border-[#292929] bg-[#0d0d0d] p-6 space-y-4">
          <SectionHeader kicker="Rating archive" title="Competitive trajectory" />
          <RatingChart data={history} />
        </div>
        <div>
          <RatingDistributionCard member={m} distribution={distribution} />
        </div>
      </section>

      {/* Offline Battle History */}
      <section className="border border-[#292929] bg-[#0d0d0d] p-6 space-y-4">
        <SectionHeader kicker="Permanent record" title="Offline battle history" />
        <div className="divide-y divide-[#292929]">
          {battles.length === 0 ? (
            <div className="text-center py-8 text-neutral-500 font-mono text-xs">
              No offline battles recorded yet. Attend an offline contest to establish a permanent record.
            </div>
          ) : (
            battles.map((b: any) => (
              <article key={b.certificate_id} className="py-3 flex items-center justify-between flex-wrap gap-4">
                <time className="font-mono text-xs text-neutral-400">
                  {new Date(b.date).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </time>
                <div>
                  <h3 className="text-sm font-bold text-white">{b.contest}</h3>
                  <code className="font-mono text-[10px] text-neutral-500">{b.certificate_id}</code>
                </div>
                <div className="flex items-center gap-4 font-mono text-xs">
                  <span>RANK <strong className="text-white font-bold">#{b.rank}</strong></span>
                  <span>SOLVED <strong className="text-white font-bold">{b.solved}</strong></span>
                  <span>PENALTY <strong className="text-white font-bold">{b.penalty}</strong></span>
                  <em className={b.delta >= 0 ? "text-emerald-400 not-italic font-bold" : "text-rose-400 not-italic font-bold"}>
                    {b.delta > 0 ? "+" : ""}{b.delta}
                  </em>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      {/* Achievement Ledger & Proof */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 border border-[#292929] bg-[#0d0d0d] p-6 space-y-4">
          <SectionHeader kicker="Milestones" title="Achievement ledger" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {achievements.length === 0 ? (
              <div className="text-center py-8 text-neutral-500 font-mono text-xs col-span-2">
                No achievements unlocked yet.
              </div>
            ) : (
              achievements.map((a: any) => (
                <article
                  key={a.code}
                  className={`p-4 border ${
                    a.earned ? "border-[var(--accent)]/40 bg-[var(--accent)]/5" : "border-[#292929] bg-neutral-900/30 opacity-60"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {a.earned ? <Award className="w-4 h-4 text-[var(--accent)]" /> : <LockKeyhole className="w-4 h-4 text-neutral-500" />}
                    <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-400">{a.code}</span>
                  </div>
                  <h3 className="font-mono text-sm font-bold text-white uppercase">{a.name}</h3>
                  <p className="text-xs text-neutral-400 mt-1">{a.description}</p>
                </article>
              ))
            )}
          </div>
        </div>

        <div className="border border-[#292929] bg-[#0d0d0d] p-6 space-y-4">
          <SectionHeader kicker="Cryptographic result" title="Latest proof" />
          {proofs[0] ? (
            <>
              <ProofBadge proof={proofs[0]} />
              <Link
                to={`/portal/verify?proof=${encodeURIComponent(proofs[0].certificate_id ?? "")}`}
                className="inline-flex items-center gap-1.5 font-mono text-xs text-[var(--accent)] hover:underline mt-4"
              >
                Open verification console <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </>
          ) : (
            <div className="py-8 text-center text-neutral-500 font-mono text-xs">
              No proofs generated yet. Complete an offline contest to seal results.
            </div>
          )}
        </div>
      </section>

      {/* Trust Footer */}
      <footer className="flex items-center gap-3 p-4 border border-[#292929] bg-neutral-900/30 text-neutral-400 font-mono text-xs">
        <Zap className="w-4 h-4 text-[var(--accent)] shrink-0" />
        <p>
          Your profile only reflects attended, proctored sessions. Practice streaks and browser activity are intentionally excluded.
        </p>
      </footer>
    </div>
  );
}
