import React, { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Users,
  Edit3,
  UserCheck,
  UserPlus,
  Github,
  Linkedin,
  Award,
  ExternalLink,
  LockKeyhole,
  ShieldCheck,
  Zap,
  Share2,
  Check,
  Flame,
  Trophy,
  Calendar,
  Building,
  GraduationCap,
  ArrowUpRight,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { openSocialDrawer } from "@/store/slices/socialSlice";
import { openEditProfileModal } from "@/store/slices/uiSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { RatingDistributionCard } from "@/organization/components/RatingDistributionCard";
import { ProofBadge } from "@/organization/components/ProofBadge";
import { RatingChart } from "@/organization/components/RatingChart";
import { ActivityHeatmap } from "@/organization/components/ActivityHeatmap";
import { ProblemSolvingMatrix } from "@/organization/components/ProblemSolvingMatrix";
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

  const [copied, setCopied] = useState(false);
  const [isFollowingOptimistic, setIsFollowingOptimistic] = useState<boolean | null>(null);
  const [followersCountDelta, setFollowersCountDelta] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);

  // Determine if viewing own profile or another student's profile
  const isViewingSelf =
    !handle ||
    handle.toLowerCase() === "me" ||
    (currentMember?.handle && handle.toLowerCase() === currentMember.handle.toLowerCase());

  // SWR Data Fetching: Own profile vs Student public profile
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

  const profileData = isViewingSelf ? ownProfileData : studentProfileData;
  const isLoading = isViewingSelf ? ownLoading : studentLoading;

  useEffect(() => {
    setIsFollowingOptimistic(null);
    setFollowersCountDelta(0);
  }, [handle]);

  if (isLoading && !profileData) {
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
            : "Please sign in to view your competition profile."}
        </p>
        <div className="flex gap-3 pt-2">
          <Button
            onClick={() => navigate("/portal/leaderboard")}
            className="bg-[var(--accent)] text-black font-mono uppercase text-xs"
          >
            View Leaderboard
          </Button>
          {!isAuthenticated() && (
            <Button
              onClick={() => navigate("/auth")}
              variant="outline"
              className="border-neutral-700 text-white font-mono uppercase text-xs"
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
  const problemStats = (profileData as any)?.problemStats || {
    total_solved: 0,
    easy_solved: 0,
    medium_solved: 0,
    hard_solved: 0,
    total_submissions: 0,
    acceptance_rate: 0,
    topics: [],
  };
  const submissionCalendar = (profileData as any)?.submissionCalendar || {};

  const isFollowing =
    isFollowingOptimistic !== null
      ? isFollowingOptimistic
      : Boolean(m.is_following);
  const displayedFollowers = Math.max(0, (m.followers_count || 0) + followersCountDelta);

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
        // Revert on failure
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

  const getTierColor = (tierStr?: string) => {
    if (tierStr?.includes("Grandmaster") || (m.rating && m.rating >= 2200)) return "text-amber-400 border-amber-500/40 bg-amber-500/10";
    if (tierStr?.includes("Master") || (m.rating && m.rating >= 1900)) return "text-purple-400 border-purple-500/40 bg-purple-500/10";
    if (tierStr?.includes("Specialist") || (m.rating && m.rating >= 1600)) return "text-cyan-400 border-cyan-500/40 bg-cyan-500/10";
    if (tierStr?.includes("Candidate") || (m.rating && m.rating >= 1400)) return "text-emerald-400 border-emerald-500/40 bg-emerald-500/10";
    return "text-neutral-300 border-neutral-700 bg-neutral-800/40";
  };

  return (
    <div className="page-wrap space-y-8 pb-16">
      {/* ── 1. LEETCODE-STYLE HERO PROFILE CARD ──────────────────────────── */}
      <div className="border border-[#292929] bg-[#0d0d0d] p-6 lg:p-8 relative overflow-hidden">
        {/* Decorative Background Grid Glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-[var(--accent)]/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          {/* Avatar & Core Metadata */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div className="relative group">
              <Avatar className="w-20 h-20 sm:w-24 sm:h-24 rounded-none border-2 border-[#292929] group-hover:border-[var(--accent)] transition-all">
                <AvatarImage src={m.avatar_url || undefined} alt={m.full_name || m.handle} />
                <AvatarFallback className="rounded-none bg-neutral-900 text-2xl font-mono font-bold text-white uppercase">
                  {(m.full_name || m.handle || "C").slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              {m.is_core_member && (
                <span
                  title="Verified CCC Core Organizer"
                  className="absolute -bottom-1 -right-1 bg-amber-400 text-black text-[10px] font-mono font-bold px-1.5 py-0.5 shadow"
                >
                  CORE
                </span>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-mono font-bold text-white tracking-tight">
                  {m.full_name || m.handle}
                </h1>
                <span className="font-mono text-sm text-[var(--accent)]">@{m.handle}</span>
                <span
                  className={cn(
                    "font-mono text-[11px] uppercase font-bold px-2.5 py-0.5 border",
                    getTierColor(m.tier)
                  )}
                >
                  {m.tier || "1★ Explorer"}
                </span>
              </div>

              {/* Department, Batch & PRN */}
              <div className="flex flex-wrap items-center gap-3 font-mono text-xs text-neutral-400">
                <span className="flex items-center gap-1 text-neutral-300">
                  <Building className="w-3.5 h-3.5 text-neutral-500" />
                  {m.department || "Computer Science"}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 text-neutral-300">
                  <GraduationCap className="w-3.5 h-3.5 text-neutral-500" />
                  Batch {m.batch || "2024-28"}
                </span>
                <span>•</span>
                <span className="px-1.5 py-0.5 bg-neutral-900 border border-neutral-800 text-[11px]">
                  {m.prn || "PRN-VERIFIED"}
                </span>
              </div>

              {/* Bio */}
              {m.bio && (
                <p className="text-sm text-neutral-300 font-sans max-w-xl pt-1">
                  {m.bio}
                </p>
              )}

              {/* Social / External CP Links */}
              <div className="flex flex-wrap items-center gap-4 pt-1 font-mono text-xs text-neutral-400">
                {m.github_username && (
                  <a
                    href={`https://github.com/${m.github_username}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 hover:text-white transition-colors"
                  >
                    <Github className="w-3.5 h-3.5" />
                    github.com/{m.github_username}
                  </a>
                )}
                {m.linkedin_url && (
                  <a
                    href={m.linkedin_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 hover:text-cyan-400 transition-colors"
                  >
                    <Linkedin className="w-3.5 h-3.5" />
                    LinkedIn
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Action Area: Follow, Share, Edit */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto pt-2 lg:pt-0">
            {/* Social Network Counters */}
            <div className="flex items-center gap-2 mr-2">
              <button
                type="button"
                onClick={() => dispatch(openSocialDrawer({ mode: "followers", target: m.handle }))}
                className="px-3 py-1.5 bg-neutral-900 border border-neutral-800 hover:border-neutral-600 font-mono text-xs text-neutral-300 flex items-center gap-1.5 transition-colors"
              >
                <Users className="w-3.5 h-3.5 text-cyan-400" />
                <span>
                  <strong className="text-white font-bold">{displayedFollowers}</strong> Followers
                </span>
              </button>
              <button
                type="button"
                onClick={() => dispatch(openSocialDrawer({ mode: "following", target: m.handle }))}
                className="px-3 py-1.5 bg-neutral-900 border border-neutral-800 hover:border-neutral-600 font-mono text-xs text-neutral-300 flex items-center gap-1.5 transition-colors"
              >
                <span>
                  <strong className="text-white font-bold">{m.following_count || 0}</strong> Following
                </span>
              </button>
            </div>

            {/* If viewing another student: Follow / Unfollow */}
            {!isViewingSelf && !m.is_self && (
              <Button
                onClick={handleFollowToggle}
                disabled={followLoading}
                className={cn(
                  "font-mono text-xs uppercase font-bold tracking-wider px-4 transition-all",
                  isFollowing
                    ? "bg-neutral-800 text-neutral-200 border border-neutral-700 hover:bg-rose-950 hover:text-rose-400 hover:border-rose-800"
                    : "bg-[var(--accent)] text-black hover:bg-[var(--accent)]/90"
                )}
              >
                {isFollowing ? (
                  <>
                    <UserCheck className="w-3.5 h-3.5 mr-1.5" />
                    Following
                  </>
                ) : (
                  <>
                    <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                    Follow Cadet
                  </>
                )}
              </Button>
            )}

            {/* If viewing self: Edit Profile Button */}
            {(isViewingSelf || m.is_self) && (
              <Button
                onClick={() => dispatch(openEditProfileModal())}
                className="bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-white font-mono text-xs uppercase font-bold"
              >
                <Edit3 className="w-3.5 h-3.5 mr-1.5 text-[var(--accent)]" />
                Edit Profile
              </Button>
            )}

            {/* Share Profile Link */}
            <Button
              onClick={handleCopyLink}
              variant="outline"
              className="border-neutral-800 hover:border-neutral-600 bg-neutral-900/60 text-neutral-300 font-mono text-xs uppercase"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
                  Copied
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5 mr-1.5" />
                  Share
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* ── 2. KEY STATS & STANDINGS GRID ────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Rating */}
        <div className="border border-[#292929] bg-[#0d0d0d] p-4 space-y-1">
          <span className="font-mono text-[10px] uppercase text-neutral-500 tracking-wider">Elo Rating</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-mono font-black text-[var(--accent)]">{m.rating}</span>
            <span className="text-xs font-mono text-neutral-500">Peak: {m.peak_rating}</span>
          </div>
        </div>

        {/* University Rank */}
        <div className="border border-[#292929] bg-[#0d0d0d] p-4 space-y-1">
          <span className="font-mono text-[10px] uppercase text-neutral-500 tracking-wider">Campus Rank</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-mono font-black text-white">#{m.university_rank || 1}</span>
            <span className="text-xs font-mono text-neutral-500">of {m.active_members || 420}</span>
          </div>
        </div>

        {/* Percentile */}
        <div className="border border-[#292929] bg-[#0d0d0d] p-4 space-y-1">
          <span className="font-mono text-[10px] uppercase text-neutral-500 tracking-wider">Percentile</span>
          <div className="text-2xl font-mono font-black text-cyan-400">
            Top {Math.max(0.5, 100 - (m.percentile || 95)).toFixed(1)}%
          </div>
        </div>

        {/* Attendance */}
        <div className="border border-[#292929] bg-[#0d0d0d] p-4 space-y-1">
          <span className="font-mono text-[10px] uppercase text-neutral-500 tracking-wider">Attendance</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-mono font-black text-emerald-400">{m.attendance_rate || 100}%</span>
            <span className="text-xs font-mono text-neutral-500">({m.attendance_count}/{m.attendance_total || 6})</span>
          </div>
        </div>

        {/* Podiums */}
        <div className="border border-[#292929] bg-[#0d0d0d] p-4 space-y-1">
          <span className="font-mono text-[10px] uppercase text-neutral-500 tracking-wider">Podiums</span>
          <div className="flex items-center gap-1.5">
            <Trophy className="w-4 h-4 text-amber-400" />
            <span className="text-2xl font-mono font-black text-amber-400">{m.podiums || 0}</span>
          </div>
        </div>

        {/* Streak */}
        <div className="border border-[#292929] bg-[#0d0d0d] p-4 space-y-1">
          <span className="font-mono text-[10px] uppercase text-neutral-500 tracking-wider">Contest Streak</span>
          <div className="flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-orange-400" />
            <span className="text-2xl font-mono font-black text-orange-400">{m.streak || 0} weeks</span>
          </div>
        </div>
      </div>

      {/* ── 3. PROBLEM SOLVING MATRIX & ANNUAL HEATMAP ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6">
          <ProblemSolvingMatrix stats={problemStats} />
        </div>
        <div className="lg:col-span-6">
          <ActivityHeatmap
            submissionCalendar={submissionCalendar}
            totalSubmissions={problemStats.total_submissions}
            streak={m.streak}
          />
        </div>
      </div>

      {/* ── 4. RATING PROGRESSION CHART & DISTRIBUTION ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 border border-[#292929] bg-[#0d0d0d] p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#1f1f1f] pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[var(--accent)]" />
              <h3 className="font-mono text-xs uppercase font-bold text-white tracking-wider">
                Official Rating Progression
              </h3>
            </div>
            <span className="font-mono text-xs text-neutral-400">
              {history.length} Rated Contests
            </span>
          </div>
          <div className="h-64 w-full">
            <RatingChart data={history} />
          </div>
        </div>

        <div className="lg:col-span-4">
          <RatingDistributionCard
            distribution={distribution || { total: 0, buckets: [] }}
            loading={distLoading}
            userRating={m.rating}
          />
        </div>
      </div>

      {/* ── 5. RECENT CONTEST BATTLES & CERTIFICATE PROOFS ─────────────────── */}
      <div className="border border-[#292929] bg-[#0d0d0d] p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-[#1f1f1f] pb-4">
          <div>
            <h2 className="font-mono text-sm uppercase font-bold text-white tracking-wider">
              Contest Battles & Verification Proofs
            </h2>
            <p className="text-xs font-mono text-neutral-400 pt-0.5">
              Every result begins at a proctored Medi-Caps workstation.
            </p>
          </div>
        </div>

        {battles.length === 0 ? (
          <div className="text-center py-10 font-mono text-xs text-neutral-500 border border-dashed border-[#222]">
            No verified offline contests recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-[#292929] text-neutral-500 uppercase">
                  <th className="pb-3">Contest</th>
                  <th className="pb-3">Date</th>
                  <th className="pb-3">Rank</th>
                  <th className="pb-3">Solved</th>
                  <th className="pb-3">Penalty</th>
                  <th className="pb-3">Rating Delta</th>
                  <th className="pb-3">Cryptographic Proof</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1c1c1c]">
                {battles.map((b: any, idx: number) => {
                  const deltaNum = Number(b.delta || 0);
                  const isPositive = deltaNum > 0;
                  const isNegative = deltaNum < 0;

                  return (
                    <tr key={idx} className="hover:bg-neutral-900/40 transition-colors">
                      <td className="py-3.5 font-bold text-white">
                        {b.contest_slug ? (
                          <Link
                            to={`/portal/contests/${b.contest_slug}`}
                            className="hover:text-[var(--accent)] transition-colors flex items-center gap-1"
                          >
                            {b.contest}
                            <ArrowUpRight className="w-3 h-3 text-neutral-500" />
                          </Link>
                        ) : (
                          b.contest
                        )}
                      </td>
                      <td className="py-3.5 text-neutral-400">
                        {new Date(b.date).toLocaleDateString("en-IN", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-3.5 font-bold">
                        <span
                          className={cn(
                            b.rank === 1
                              ? "text-amber-400"
                              : b.rank === 2
                              ? "text-neutral-300"
                              : b.rank === 3
                              ? "text-orange-400"
                              : "text-neutral-300"
                          )}
                        >
                          #{b.rank}
                        </span>
                      </td>
                      <td className="py-3.5 text-white">{b.solved}</td>
                      <td className="py-3.5 text-neutral-400">{b.penalty}</td>
                      <td className="py-3.5 font-bold">
                        <span
                          className={cn(
                            isPositive
                              ? "text-emerald-400"
                              : isNegative
                              ? "text-rose-400"
                              : "text-neutral-500"
                          )}
                        >
                          {isPositive ? `+${deltaNum}` : deltaNum || "0"}
                        </span>
                      </td>
                      <td className="py-3.5">
                        <Link
                          to={`/portal/verify`}
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-neutral-900 border border-neutral-800 hover:border-[var(--accent)] text-[var(--accent)] font-mono text-[11px] transition-colors"
                        >
                          <ShieldCheck className="w-3 h-3" />
                          {b.certificate_id}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── 6. VERIFIED ACHIEVEMENTS & BADGES ─────────────────────────────── */}
      {achievements.length > 0 && (
        <div className="border border-[#292929] bg-[#0d0d0d] p-6 space-y-4">
          <h2 className="font-mono text-sm uppercase font-bold text-white tracking-wider flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-400" />
            Verified Chapter Achievements
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            {achievements.map((ach: any, idx: number) => (
              <div
                key={idx}
                className="p-4 border border-neutral-800/80 bg-neutral-950/60 flex items-start gap-3.5"
              >
                <div className="w-10 h-10 flex items-center justify-center bg-neutral-900 border border-neutral-800 text-xl shrink-0">
                  {ach.icon || "🏆"}
                </div>
                <div className="space-y-1">
                  <h4 className="font-mono text-xs font-bold text-white uppercase">{ach.title}</h4>
                  <p className="font-sans text-xs text-neutral-400 leading-relaxed">
                    {ach.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
