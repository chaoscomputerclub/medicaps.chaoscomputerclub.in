import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Users,
  Edit3,
  UserCheck,
  UserPlus,
  Share2,
  Check,
  Github,
  Linkedin,
  Award,
  ExternalLink,
  LockKeyhole,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { openSocialDrawer, fetchMyFollowingIdsThunk } from "@/store/slices/socialSlice";
import { openEditProfileModal } from "@/store/slices/uiSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { RatingDistributionCard } from "@/organization/components/RatingDistributionCard";
import { ProofBadge } from "@/organization/components/ProofBadge";
import { RatingChart } from "@/organization/components/RatingChart";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Metric, SectionHeader, TierBadge } from "@/organization/components/ui";
import {
  getMemberProfileData,
  getStudentProfileData,
  getRatingDistribution,
} from "@/organization/data/portal.functions";
import { ProfileSkeleton } from "@/organization/components/skeletons";
import { getApiBase, getToken, isAuthenticated } from "@/lib/auth";
import { useSwrData, invalidateSwrCache } from "@/lib/cache/swrCache";

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
  const { handle } = useParams<{ handle?: string }>();
  const currentMember = useAppSelector((s) => s.auth.member);
  const followingIds = useAppSelector((s) => s.social.followingIds);

  const [copied, setCopied] = useState(false);
  const [isFollowingOptimistic, setIsFollowingOptimistic] = useState<boolean | null>(null);
  const [followersCountDelta, setFollowersCountDelta] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);

  // Determine if viewing own profile or another student's profile
  const isViewingSelf =
    !handle ||
    handle.toLowerCase() === "me" ||
    (currentMember?.handle && handle.toLowerCase() === currentMember.handle.toLowerCase());

  const { data: ownProfileData, loading: ownLoading } = useSwrData(
    "member:profile:full",
    () => getMemberProfileData(),
    { ttl: 5 * 60 * 1000, enabled: isViewingSelf }
  );

  const { data: studentProfileData, loading: studentLoading } = useSwrData(
    `student:profile:${handle?.toLowerCase() || ""}`,
    () => (handle ? getStudentProfileData(handle) : Promise.resolve(null)),
    { ttl: 3 * 60 * 1000, enabled: !isViewingSelf && Boolean(handle) }
  );

  const { data: distribution, loading: distLoading } = useSwrData(
    "leaderboard:rating:distribution",
    () => getRatingDistribution(),
    { ttl: 5 * 60 * 1000 }
  );

  useEffect(() => {
    dispatch(fetchMyFollowingIdsThunk());
  }, [dispatch]);

  useEffect(() => {
    setIsFollowingOptimistic(null);
    setFollowersCountDelta(0);
  }, [handle]);

  useEffect(() => {
    if (isViewingSelf && !isAuthenticated()) {
      navigate("/auth", { replace: true });
    }
  }, [isViewingSelf, navigate]);

  const profileData = isViewingSelf ? ownProfileData : studentProfileData;
  const profileLoading = isViewingSelf ? ownLoading : studentLoading;

  if ((profileLoading || distLoading) && !profileData) {
    return <ProfileSkeleton />;
  }

  const m = profileData?.member;
  if (!m) {
    return (
      <div className="page-wrap p-6 max-w-7xl mx-auto py-16 space-y-4">
        <h1 className="text-2xl font-mono font-bold text-white uppercase">
          {handle ? `Cadet '@${handle}' not found` : "Profile unavailable"}
        </h1>
        <p className="text-neutral-400 text-sm">
          {handle
            ? "No student record exists with this handle in the Medi-Caps competitive programming index."
            : "Please log in to view your competition profile."}
        </p>
        <div className="flex gap-3 pt-2">
          <Button
            onClick={() => navigate("/portal/leaderboard")}
            className="bg-[var(--accent)] text-black font-mono uppercase text-xs rounded-none"
          >
            View Leaderboard
          </Button>
          {!isAuthenticated() && (
            <Button
              onClick={() => navigate("/auth")}
              variant="outline"
              className="border-neutral-700 text-white font-mono uppercase text-xs rounded-none"
            >
              Sign In
            </Button>
          )}
        </div>
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

  const isFollowing =
    isFollowingOptimistic !== null
      ? isFollowingOptimistic
      : Boolean(m.is_following);
  const displayedFollowers = Math.max(0, (m.followers_count || 0) + followersCountDelta);
  const displayedFollowing = isViewingSelf
    ? (followingIds.length > 0 ? followingIds.length : (m.following_count ?? 0))
    : (m.following_count ?? 0);

  // Copy Profile Link Handler
  const handleCopyLink = () => {
    const url = `${window.location.origin}/portal/profile/${m.handle}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Follow / Unfollow Handler
  const handleFollowToggle = async () => {
    if (!isAuthenticated()) {
      navigate("/auth");
      return;
    }
    if (m.is_self || isViewingSelf || followLoading) return;

    setFollowLoading(true);
    const newFollowingState = !isFollowing;
    setIsFollowingOptimistic(newFollowingState);
    setFollowersCountDelta((prev) => prev + (newFollowingState ? 1 : -1));

    try {
      const backendUrl = getApiBase();
      const token = getToken();
      const method = newFollowingState ? "POST" : "DELETE";
      const res = await fetch(`${backendUrl}/social/follow/${encodeURIComponent(m.handle)}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        setIsFollowingOptimistic(!newFollowingState);
        setFollowersCountDelta((prev) => prev + (newFollowingState ? -1 : 1));
      } else {
        invalidateSwrCache(`student:profile:${m.handle.toLowerCase()}`);
      }
    } catch {
      setIsFollowingOptimistic(!newFollowingState);
      setFollowersCountDelta((prev) => prev + (newFollowingState ? -1 : 1));
    } finally {
      setFollowLoading(false);
    }
  };

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
              <h1 className="text-3xl sm:text-4xl font-display font-bold text-white uppercase tracking-tight">
                {m.full_name || m.handle}
              </h1>

              {/* If viewing own profile: Edit button */}
              {(isViewingSelf || m.is_self) ? (
                <Button
                  type="button"
                  id="profile-edit-btn"
                  onClick={() => dispatch(openEditProfileModal())}
                  className="h-auto inline-flex items-center gap-1.5 px-3 py-1 font-mono text-xs uppercase font-bold text-[var(--accent)] bg-[var(--accent)]/10 border border-[var(--accent)]/40 hover:bg-[var(--accent)] hover:text-black rounded-none cursor-pointer"
                >
                  <Edit3 size={12} />
                  <span>Edit Profile</span>
                </Button>
              ) : (
                /* If viewing another student: Follow & Share buttons */
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    onClick={handleFollowToggle}
                    disabled={followLoading}
                    className={cn(
                      "h-auto inline-flex items-center gap-1.5 px-3 py-1 font-mono text-xs uppercase font-bold rounded-none cursor-pointer transition-all",
                      isFollowing
                        ? "bg-neutral-800 text-neutral-200 border border-neutral-700 hover:bg-rose-950 hover:text-rose-400 hover:border-rose-800"
                        : "bg-[var(--accent)] text-black hover:bg-[var(--accent)]/90"
                    )}
                  >
                    {isFollowing ? (
                      <>
                        <UserCheck size={12} />
                        <span>Following</span>
                      </>
                    ) : (
                      <>
                        <UserPlus size={12} />
                        <span>Follow</span>
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    onClick={handleCopyLink}
                    variant="outline"
                    className="h-auto inline-flex items-center gap-1.5 px-2.5 py-1 font-mono text-xs uppercase text-neutral-300 border border-[#292929] hover:border-neutral-500 bg-neutral-900 rounded-none cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check size={12} className="text-emerald-400" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Share2 size={12} />
                        <span>Share</span>
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap text-xs font-mono text-neutral-400 pt-0.5">
              <TierBadge>{m.tier || "1★ Explorer"}</TierBadge>
              <span>•</span>
              <span className="text-neutral-300 font-bold">{m.department}</span>
              <span>•</span>
              <span className="text-neutral-300">{m.batch}</span>
              <span>•</span>
              <span className="text-[var(--accent)] font-bold">@{m.handle}</span>
              {m.is_core_member && (
                <>
                  <span>•</span>
                  <span className="bg-amber-400/10 border border-amber-400/40 text-amber-400 px-1.5 py-0.2 text-[10px] font-bold">
                    CORE
                  </span>
                </>
              )}
            </div>

            {m.bio && (
              <p className="text-xs text-neutral-300 font-sans max-w-xl pt-1">
                {m.bio}
              </p>
            )}

            {/* Followers / Following and CP Links */}
            <div className="flex items-center gap-2 flex-wrap pt-2">
              <button
                type="button"
                onClick={() =>
                  dispatch(
                    openSocialDrawer({
                      targetHandle: m.handle,
                      targetName: m.full_name || m.handle,
                      type: "followers",
                    })
                  )
                }
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono uppercase bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-[#292929] hover:border-[var(--accent)]/50 rounded-none cursor-pointer"
              >
                <Users size={12} className="text-[var(--accent)]" />
                <strong className="text-white font-mono">{displayedFollowers}</strong> Followers
              </button>
              <button
                type="button"
                onClick={() =>
                  dispatch(
                    openSocialDrawer({
                      targetHandle: m.handle,
                      targetName: m.full_name || m.handle,
                      type: "following",
                    })
                  )
                }
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono uppercase bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-[#292929] hover:border-[var(--accent)]/50 rounded-none cursor-pointer"
              >
                <UserCheck size={12} className="text-[var(--accent)]" />
                <strong className="text-white font-mono">{displayedFollowing}</strong> Following
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
            <dd className="text-neutral-200 font-bold">{m.email || "—"}</dd>
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
                  key={a.code || a.id || a.name || a.title}
                  className={`p-4 border ${
                    a.earned !== false ? "border-[var(--accent)]/40 bg-[var(--accent)]/5" : "border-[#292929] bg-neutral-900/30 opacity-60"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {a.earned !== false ? <Award className="w-4 h-4 text-[var(--accent)]" /> : <LockKeyhole className="w-4 h-4 text-neutral-500" />}
                    <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-400">{a.code || a.id || "ACH"}</span>
                  </div>
                  <h3 className="font-mono text-sm font-bold text-white uppercase">{a.name || a.title}</h3>
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
