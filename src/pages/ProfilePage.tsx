import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Users,
  User,
  Edit3,
  UserCheck,
  UserPlus,
  Share2,
  Check,
  Github,
  Award,
  LockKeyhole,
  Zap,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { WanderingEyes } from "@/components/ui/WanderingEyes";
import { MakoMascot } from "@/components/common/MakoMascot";
import { cn, formatFullName, resolveAvatarUrl } from "@/lib/utils";
import { getChapterBadgeAsset, computeAuthoritativeBadges, isOfficialChapterBadge } from "@/lib/profileAssets";
import {
  fetchMySocialStatsThunk,
  toggleFollowThunk,
  syncSocialCounts,
  syncCadetSocialCounts,
} from "@/store/slices/socialSlice";
import { fetchContestsThunk } from "@/store/slices/contestSlice";
import { SocialFollowStats } from "@/organization/components/SocialFollowStats";
import {
  fetchCurrentUserThunk,
} from "@/store/slices/authSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { RatingDistributionCard } from "@/organization/components/RatingDistributionCard";
import { RatingChart } from "@/organization/components/RatingChart";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Metric, SectionHeader, TierBadge } from "@/organization/components/ui";
import { FaLinkedinIn } from "react-icons/fa";

import {
  getMemberProfileData,
  getStudentProfileData,
  getRatingDistribution,
} from "@/organization/data/portal.functions";
import { CodingActivityGraph } from "@/components/profile/CodingActivityGraph";
import { SolvedProblemsCard } from "@/components/profile/SolvedProblemsCard";
import { BadgesCard } from "@/components/profile/BadgesCard";
import { RecentSubmissionsCard } from "@/components/profile/RecentSubmissionsCard";
import { practiceApi } from "@/features/practice/api";
import { ProfileSkeleton } from "@/organization/components/skeletons";
import { isAuthenticated } from "@/lib/auth";
import { useSwrData } from "@/lib/cache/swrCache";
import { markNavigationMount, markNavigationContentReady } from "@/lib/navigationTelemetry";

export function ProfilePage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { handle } = useParams<{ handle?: string }>();
  const currentMember = useAppSelector((s) => s.auth.member);
  const contests = useAppSelector((s) => s.contest.contests);
  const followingIds = useAppSelector((s) => s.social.followingIds);
  const hasFetchedFollowing = useAppSelector((s) => s.social.hasFetchedFollowing);
  const actionPendingId = useAppSelector((s) => s.social.actionPendingId);
  const myFollowersCount = useAppSelector((s) => s.social.myFollowersCount);
  const myFollowingCount = useAppSelector((s) => s.social.myFollowingCount);
  const hasSyncedMyCounts = useAppSelector((s) => s.social.hasSyncedMyCounts);

  useEffect(() => {
    if (contests.length === 0) {
      void dispatch(fetchContestsThunk(false));
    }
  }, [dispatch, contests.length]);

  const [copied, setCopied] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  // Determine if viewing own profile or another student's profile
  const isViewingSelf =
    !handle ||
    (handle && handle.toLowerCase() === "me") ||
    Boolean(
      currentMember?.handle &&
      (handle || "").toLowerCase() === (currentMember.handle || "").toLowerCase(),
    );

  const {
    data: ownProfileData,
    loading: ownLoading,
    revalidate: revalidateOwnProfile,
    mutate: mutateOwnProfile,
  } = useSwrData(
    isViewingSelf && isAuthenticated() ? "member:profile:full" : null,
    () => getMemberProfileData(false),
    { ttl: 5 * 60 * 1000, staleTime: 30 * 1000, enabled: isViewingSelf && isAuthenticated() },
  );

  const targetHandle = handle || currentMember?.handle || "me";

  const {
    data: studentProfileData,
    loading: studentLoading,
    revalidate: revalidateStudentProfile,
  } = useSwrData(`student:profile:${targetHandle}`, () => getStudentProfileData(targetHandle), {
    ttl: 5 * 60 * 1000,
    enabled: !isViewingSelf,
  });

  const { data: distribution, loading: distLoading } = useSwrData(
    "leaderboard:distribution",
    () => getRatingDistribution(),
    { ttl: 10 * 60 * 1000 },
  );

  const { data: activityData, loading: activityLoading } = useSwrData(
    `practice:activity:${isViewingSelf ? "me" : targetHandle}`,
    () => practiceApi.getActivity(undefined, isViewingSelf ? undefined : targetHandle),
    { ttl: 2 * 60 * 1000, staleTime: 30 * 1000 }
  );

  const { data: practiceStatsData, loading: practiceStatsLoading } = useSwrData(
    `practice:stats:${isViewingSelf ? "me" : targetHandle}`,
    () => practiceApi.getStats(isViewingSelf ? undefined : targetHandle),
    { ttl: 2 * 60 * 1000, staleTime: 30 * 1000 }
  );

  const { data: recentSubmissionsData, loading: recentSubmissionsLoading } = useSwrData(
    `practice:submissions:recent:${isViewingSelf ? "me" : targetHandle}`,
    () => practiceApi.getRecentSubmissions(isViewingSelf ? undefined : targetHandle, false, 50),
    { ttl: 60 * 1000, staleTime: 15 * 1000 }
  );

  useEffect(() => {
    if (isAuthenticated()) {
      dispatch(fetchMySocialStatsThunk());
    }
  }, [dispatch]);

  const activeData: any = isViewingSelf ? ownProfileData : studentProfileData;
  const isLoading = isViewingSelf
    ? ownLoading && !ownProfileData
    : studentLoading && !studentProfileData;

  const candidate = activeData?.member;
  const isCandidateValid = Boolean(
    candidate && (candidate.id || candidate.handle || candidate.email) && candidate.id !== "",
  );

  const m = isCandidateValid ? candidate : isViewingSelf ? currentMember : null;

  useEffect(() => {
    if (m) {
      const stats = activeData?.stats;
      const fc = m.followers_count ?? stats?.followers_count;
      const fgc = m.following_count ?? stats?.following_count;

      if (isViewingSelf) {
        if (typeof fc === "number" || typeof fgc === "number") {
          dispatch(
            syncSocialCounts({
              ...(typeof fc === "number" ? { followersCount: fc } : {}),
              ...(typeof fgc === "number" ? { followingCount: fgc } : {}),
            }),
          );
        }
      } else if (m.handle || m.id) {
        dispatch(
          syncCadetSocialCounts({
            handleOrId: m.handle || m.id,
            ...(typeof fc === "number" ? { followersCount: fc } : {}),
            ...(typeof fgc === "number" ? { followingCount: fgc } : {}),
            ...(typeof m.is_following === "boolean" ? { isFollowing: m.is_following } : {}),
          }),
        );
      }
    }
  }, [
    dispatch,
    isViewingSelf,
    m?.id,
    m?.handle,
    m?.followers_count,
    m?.following_count,
    m?.is_following,
    activeData?.stats?.followers_count,
    activeData?.stats?.following_count,
    currentMember?.followers_count,
    currentMember?.following_count,
  ]);

  useEffect(() => {
    markNavigationMount(
      window.location.pathname,
      ownProfileData || studentProfileData ? "hit" : (m ? "stale" : "miss")
    );
    markNavigationContentReady(window.location.pathname);
  }, [ownProfileData, studentProfileData, m]);

  if (!m && (isLoading || ownLoading || studentLoading)) {
    return <ProfileSkeleton />;
  }

  if (!m) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <MakoMascot variant="not-found" size="xl" className="mb-4" />
        <h2 className="text-lg font-bold text-white mb-2">Member Profile Not Found</h2>
        <p className="text-sm text-zinc-400 max-w-md mb-6 font-sans">
          The requested cadet profile could not be found or you may need to sign in.
        </p>
        <Button asChild>
          <Link to={isViewingSelf ? "/auth" : "/leaderboard"}>
            {isViewingSelf ? "Sign In to Access Profile" : "Back to Leaderboard"}
          </Link>
        </Button>
      </div>
    );
  }
  const history = activeData?.history || activeData?.ratingHistory || [];
  const battles = activeData?.battles || activeData?.recentBattles || [];
  const rawAchievements = activeData?.achievements || [];
  const cadetSolves =
    practiceStatsData?.problems?.solved ??
    m?.problem_stats?.problems?.solved ??
    m?.problemStats?.total_solved ??
    0;
  const achievements = computeAuthoritativeBadges({
    rating: m?.rating,
    attended: m?.attendance_count,
    podiums: m?.podiums,
    total_solved: cadetSolves,
    rawAchievements,
  });
  const proofs = activeData?.proofs || [];

  const isSelfUser = Boolean(
    isViewingSelf ||
    (currentMember?.id && m.id === currentMember.id) ||
    (currentMember?.handle &&
      (m.handle || "").toLowerCase() === (currentMember.handle || "").toLowerCase()),
  );

  const rawEnrollment =
    (m.enrollment_number && m.enrollment_number !== "—" && m.enrollment_number !== "N/A"
      ? m.enrollment_number
      : null) ||
    (m.enrollment_no && m.enrollment_no !== "—" && m.enrollment_no !== "N/A"
      ? m.enrollment_no
      : null) ||
    (m.enrollment && m.enrollment !== "—" && m.enrollment !== "N/A" ? m.enrollment : null) ||
    (m.prn && m.prn !== "N/A" && m.prn !== "—" ? m.prn : null) ||
    (isSelfUser && currentMember?.prn && currentMember.prn !== "N/A" && currentMember.prn !== "—"
      ? currentMember.prn
      : null) ||
    (isSelfUser &&
    m.email &&
    m.email.includes("@") &&
    /^[a-zA-Z]{2}\d+/i.test(m.email.split("@")[0])
      ? m.email.split("@")[0].toUpperCase()
      : null);
  const enrollmentNo = rawEnrollment || "—";

  const rawFullName =
    m.full_name ||
    (m.first_name ? `${m.first_name} ${m.last_name || ""}`.trim() : "") ||
    (isSelfUser ? (currentMember?.full_name ?? "") : "");
  const formattedFullName = formatFullName(rawFullName);
  const displayHandle = m.handle || (isSelfUser ? currentMember?.handle || "" : "");
  const displayName = formattedFullName || (displayHandle ? `@${displayHandle}` : "Cadet");

  const initials = formattedFullName
    ? formattedFullName
        .split(" ")
        .map((w: string) => w[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : (displayHandle.slice(0, 2) || "CC").toUpperCase();

  const effectiveAvatar = isSelfUser ? m.avatar_url || currentMember?.avatar_url : m.avatar_url;
  const resolvedAvatar = resolveAvatarUrl(effectiveAvatar);

  const isFollowedInStore =
    !isSelfUser &&
    (followingIds.includes(m.id) || (m.handle ? followingIds.includes(m.handle) : false));

  const isFollowing = isSelfUser
    ? false
    : hasFetchedFollowing
      ? isFollowedInStore
      : isFollowedInStore || Boolean(m.is_following);

  const isPendingFollowAction =
    followLoading || actionPendingId === m.id || (m.handle ? actionPendingId === m.handle : false);

  const handleCopyLink = () => {
    const url = `${window.location.origin}/profile/${m.handle}`;
    void navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Profile URL copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFollowToggle = async () => {
    if (!isAuthenticated()) {
      toast.error("Please sign in to follow fellow cadets.");
      navigate("/auth");
      return;
    }
    if (isSelfUser || followLoading) return;

    setFollowLoading(true);
    try {
      const res = await dispatch(
        toggleFollowThunk({
          targetId: m.id,
          targetHandle: m.handle,
        }),
      ).unwrap();

      if (res.isFollowing) {
        toast.success(`Following @${m.handle || "cadet"}`);
      } else {
        toast.info(`Unfollowed @${m.handle || "cadet"}`);
      }

      if (revalidateStudentProfile) {
        await revalidateStudentProfile();
      }
    } catch (err: any) {
      toast.error(typeof err === "string" ? err : "Failed to update follow");
    } finally {
      setFollowLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Profile Header Card */}
      <header className="relative flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 rounded-[24px] border border-white/[0.08] bg-[#1F1F1F] p-6 sm:p-8">
        <div className="flex items-start gap-5">
          {/* Avatar Container */}
          <div className="relative shrink-0">
            <Avatar className="size-16 sm:size-20 rounded-[20px] border border-white/[0.08] bg-[#171717] overflow-hidden">
              {resolvedAvatar ? (
                <AvatarImage
                  src={resolvedAvatar}
                  alt={displayName}
                  className="object-cover rounded-[20px]"
                />
              ) : null}
              <AvatarFallback className="rounded-[20px] bg-[#B1FA63]/10 text-[#B1FA63] font-display text-2xl uppercase tracking-wider flex items-center justify-center w-full h-full">
                {initials}
              </AvatarFallback>
            </Avatar>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-3.5 flex-wrap">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-display uppercase tracking-wide text-white leading-none">
                {displayName}
              </h1>

              {isSelfUser ? (
                <div className="flex items-center gap-2">
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="rounded-[10px] bg-[#171717] border-white/[0.08] text-zinc-300 hover:bg-[#B1FA63] hover:text-black hover:border-[#B1FA63] hover:[&_*]:!text-black hover:[&_svg]:!text-black font-heading font-bold uppercase tracking-wider text-xs"
                  >
                    <Link to="/settings">
                      <Edit3 size={11} className="text-[#B1FA63]" />
                      <span>Edit</span>
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    onClick={handleFollowToggle}
                    disabled={isPendingFollowAction}
                    variant={isFollowing ? "secondary" : "outline"}
                    size="sm"
                    className={isFollowing ? "rounded-[10px] bg-[#B1FA63] text-black font-heading font-extrabold uppercase tracking-wider text-xs hover:bg-[#a0ee4e]" : "rounded-[10px] bg-[#171717] border-white/[0.08] text-zinc-300 hover:bg-[#B1FA63] hover:text-black hover:border-[#B1FA63] hover:[&_*]:!text-black hover:[&_svg]:!text-black font-heading font-bold uppercase tracking-wider text-xs"}
                  >
                    {isFollowing ? (
                      <>
                        {isPendingFollowAction ? (
                          <WanderingEyes size="inline" className="h-3 mr-1" />
                        ) : (
                          <UserCheck size={11} />
                        )}
                        <span>Following</span>
                      </>
                    ) : (
                      <>
                        {isPendingFollowAction ? (
                          <WanderingEyes size="inline" className="h-3 mr-1" />
                        ) : (
                          <UserPlus size={11} />
                        )}
                        <span>Follow</span>
                      </>
                    )}
                  </Button>
                  <Button type="button" onClick={handleCopyLink} variant="outline" size="icon-sm" className="rounded-[10px] bg-[#171717] border-white/[0.08] hover:bg-[#B1FA63] hover:text-black hover:border-[#B1FA63] hover:[&_*]:!text-black hover:[&_svg]:!text-black">
                    {copied ? <Check size={11} className="text-[#B1FA63]" /> : <Share2 size={11} />}
                  </Button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap text-xs font-sans text-zinc-400 pt-0.5">
              <TierBadge tier={m.tier} rating={m.rating} attendanceCount={m.attendance_count} />
              {m.department || (isSelfUser ? currentMember?.department : null) ? (
                <>
                  <span>·</span>
                  <span className="text-zinc-300">{m.department || currentMember?.department}</span>
                </>
              ) : null}
              {m.batch || (isSelfUser ? currentMember?.batch : null) ? (
                <>
                  <span>·</span>
                  <span className="text-zinc-500">{m.batch || currentMember?.batch}</span>
                </>
              ) : null}
              <span>·</span>
              <span className="text-[#B1FA63] font-bold">@{displayHandle || "cadet"}</span>
            </div>

            {m.bio && (
              <p className="text-xs text-zinc-400 max-w-xl pt-0.5 leading-relaxed font-sans">
                {m.bio}
              </p>
            )}

            {/* Campus Social & Peer Telemetry */}
            <div className="flex items-center gap-3 flex-wrap pt-2.5">
              <SocialFollowStats
                targetId={m.id}
                targetHandle={m.handle}
                targetName={m.full_name || m.handle}
                initialFollowersCount={m.followers_count ?? activeData?.stats?.followers_count}
                initialFollowingCount={m.following_count ?? activeData?.stats?.following_count}
                isSelf={isSelfUser}
              />

              {(m.github_username || m.linkedin_url) && (
                <span className="text-zinc-700 select-none hidden sm:inline text-xs" aria-hidden="true">·</span>
              )}

              {m.github_username && (
                <a
                  href={`https://github.com/${m.github_username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-sans text-zinc-300 bg-[#171717] border border-white/[0.08] hover:bg-[#B1FA63] hover:text-black hover:border-[#B1FA63] hover:[&_*]:!text-black hover:[&_svg]:!text-black [&:hover_svg]:text-black rounded-[8px] transition-colors"
                >
                  <Github size={11} className="text-[#B1FA63]" />
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
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-sans text-zinc-300 bg-[#171717] border border-white/[0.08] hover:bg-[#B1FA63] hover:text-black hover:border-[#B1FA63] hover:[&_*]:!text-black hover:[&_svg]:!text-black [&:hover_svg]:text-black rounded-[8px] transition-colors"
                >
                  <FaLinkedinIn size={11} className="text-[#B1FA63]" />
                  <span>LinkedIn</span>
                </a>
              )}
            </div>
          </div>
        </div>

        <dl className="flex sm:flex-col gap-3.5 font-sans text-xs border-t lg:border-t-0 lg:border-l border-white/[0.08] pt-4 lg:pt-0 lg:pl-6 relative z-10 shrink-0">
          <div>
            <dt className="text-zinc-500 uppercase text-[9px] font-heading font-bold tracking-wider">Enrollment No.</dt>
            <dd className="text-white font-medium tabular-nums text-sm mt-0.5">{enrollmentNo}</dd>
          </div>
          <div>
            <dt className="text-zinc-500 uppercase text-[9px] font-heading font-bold tracking-wider">Email</dt>
            <dd className="text-zinc-300 mt-0.5">
              {isSelfUser
                ? m.email || currentMember?.email || "—"
                : m.email || "Protected (Campus Only)"}
            </dd>
          </div>
        </dl>
      </header>

      {/* 4 Metric Bento Strip */}
      {(() => {
        const officialFinishedContests = contests.filter(
          (c) => c.status === "finished" || c.status === "live",
        ).length;
        const rawAttendanceCount = m.attendance_count ?? 0;
        const rawAttendanceTotal = m.attendance_total ?? 0;

        // Strict attendance total resolution:
        // 1. If officialFinishedContests > 0, attendance_total is at least officialFinishedContests or rawAttendanceTotal.
        // 2. If battles exist, attendance_total is at least battles.length.
        // 3. If rawAttendanceCount > 0, use rawAttendanceTotal.
        // 4. Otherwise (no official contests held, no battles, attendance count 0), attendance_total must strictly be 0,
        //    rendering "0/0" with detail "No official contests yet" and eliminating any phantom "0/1" state.
        const effectiveAttendanceTotal =
          officialFinishedContests > 0
            ? Math.max(officialFinishedContests, rawAttendanceTotal)
            : battles.length > 0
              ? Math.max(battles.length, rawAttendanceTotal)
              : rawAttendanceCount > 0
                ? rawAttendanceTotal
                : 0;
        const effectiveAttendanceCount = rawAttendanceCount;

        return (
          <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Metric label="Rating" value={m.rating} detail={`Peak: ${m.peak_rating}`} />
            <Metric
              label="Rank"
              value={m.is_ranked && m.university_rank ? `#${m.university_rank}` : "Unranked"}
              detail={
                m.is_ranked && m.university_rank
                  ? `of ${m.active_members || 1} cadets`
                  : "Attend 1 contest to rank"
              }
            />
            <Metric label="Podiums" value={m.podiums} detail="Verified finishes" />
            <Metric
              label="Contests"
              value={`${effectiveAttendanceCount}/${effectiveAttendanceTotal}`}
              detail={
                effectiveAttendanceTotal === 0
                  ? "No official contests yet"
                  : "Official attendance"
              }
            />
          </section>
        );
      })()}

      {/* Problem Solving Utilization & Badges Grid (Side by Side) */}
      <section className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
        <div className="md:col-span-7">
          <SolvedProblemsCard
            stats={practiceStatsData || m.problem_stats}
            loading={practiceStatsLoading && !m.problem_stats}
          />
        </div>
        <div className="md:col-span-5">
          <BadgesCard
            achievements={achievements}
            tier={m.tier}
            rating={m.rating}
          />
        </div>
      </section>

      {/* 365-Day Coding Activity Heatmap */}
      <CodingActivityGraph activityData={activityData} loading={activityLoading} />

      {/* Recent Submissions Ledger */}
      <RecentSubmissionsCard
        submissions={Array.isArray(recentSubmissionsData) ? recentSubmissionsData : []}
        battles={Array.isArray(battles) ? battles : []}
        loading={recentSubmissionsLoading && !recentSubmissionsData}
      />

      {/* Trajectory & Distribution */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 rounded-[24px] border border-white/[0.08] bg-[#1F1F1F] p-6 sm:p-7 space-y-4">
          <SectionHeader
            title="Competitive Trajectory"
          />
          <RatingChart data={history} loading={isLoading && history.length === 0} />
        </div>
        <div className="h-full">
          <RatingDistributionCard
            member={m}
            distribution={distribution}
            loading={distLoading && !distribution}
          />
        </div>
      </section>

      {/* Contest Battle Logs */}
      <section className="rounded-[24px] border border-white/[0.08] bg-[#1F1F1F] p-6 sm:p-8 space-y-5">
        <SectionHeader title="Attended Tournaments" />
        <div className="space-y-2 font-sans text-xs">
          {battles.length === 0 ? (
            <div className="text-center py-8 flex flex-col items-center justify-center">
              <div className="size-20 mb-2 flex items-center justify-center">
                <MakoMascot variant="gamer" size="md" />
              </div>
              <p className="text-xs font-sans text-zinc-400">No recorded tournaments on file.</p>
            </div>
          ) : (
            battles.map((b: any) => (
              <article
                key={b.certificate_id}
                className="py-3 px-3.5 rounded-[12px] bg-[#171717] border border-white/[0.04] hover:border-white/[0.12] transition-colors flex items-center justify-between flex-wrap gap-3"
              >
                <time className="text-zinc-500 font-sans text-xs">
                  {new Date(b.date).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </time>
                <div>
                  {b.contest_slug || b.slug ? (
                    <Link
                      to={`/contests/${b.contest_slug || b.slug}/results`}
                      className="font-heading font-bold text-white hover:text-[#B1FA63] transition-colors block text-sm"
                    >
                      {b.contest}
                    </Link>
                  ) : (
                    <h3 className="font-heading font-bold text-white text-sm">{b.contest}</h3>
                  )}
                  {b.certificate_id ? (
                    <span className="text-[10px] text-zinc-500 font-sans block mt-0.5">
                      {b.certificate_id}
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-zinc-400 font-sans">
                    Rank{" "}
                    <strong className="text-white font-sans font-bold tabular-nums">#{b.rank}</strong>
                  </span>
                  <span className="text-zinc-400 font-sans">
                    Solved{" "}
                    <strong className="text-white font-sans font-bold tabular-nums">{b.solved}</strong>
                  </span>
                  <em
                    className={
                      b.delta >= 0
                        ? "text-[#B1FA63] not-italic font-sans font-bold tabular-nums"
                        : "text-red-400 not-italic font-sans font-bold tabular-nums"
                    }
                  >
                    {b.delta > 0 ? "+" : ""}
                    {b.delta}
                  </em>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      {/* Achievements Ledger */}
      <section className="rounded-[24px] border border-white/[0.08] bg-[#1F1F1F] p-6 sm:p-8 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <SectionHeader title="Achievement Ledger" />
          <span className="text-xs font-mono font-bold tracking-wider text-zinc-400">
            <span className="text-[#B1FA63]">{achievements.filter((a: any) => a.earned === true).length}</span> / {achievements.length} UNLOCKED
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 text-xs">
          {achievements.length === 0 ? (
            <div className="text-center py-8 text-zinc-500 col-span-full flex flex-col items-center justify-center">
              <div className="size-16 mb-2 flex items-center justify-center">
                <img
                  src="/matiks-assets/badges/badge.webp"
                  alt=""
                  className="size-10 object-contain opacity-30 grayscale"
                />
              </div>
              <span className="font-heading font-bold uppercase tracking-wider text-xs">No achievements available.</span>
            </div>
          ) : (
            achievements.filter(isOfficialChapterBadge).map((a: any) => {
              const isEarned = a.earned === true;
              const badgeSrc = a.image_url || a.badge_url || getChapterBadgeAsset(a.title || a.name || a.code);
              const title = a.title || a.name || "Badge";

              return (
                <article
                  key={a.code || a.id || title}
                  className={`p-4 rounded-[18px] border transition-all flex flex-col justify-between ${
                    isEarned
                      ? "border-[#B1FA63]/30 bg-gradient-to-b from-[#222222] to-[#181818] shadow-sm shadow-[#B1FA63]/5"
                      : "border-white/[0.06] bg-[#171717]/60 opacity-60"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2.5 mb-3">
                      <div className="size-14 rounded-[14px] bg-black/40 border border-white/[0.08] p-2 flex items-center justify-center shrink-0">
                        <img
                          src={badgeSrc}
                          alt=""
                          className={`size-full object-contain ${
                            isEarned
                              ? "filter drop-shadow-[0_2px_8px_rgba(177,250,99,0.25)]"
                              : "grayscale opacity-30"
                          }`}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "/matiks-assets/badges/badge.webp";
                          }}
                        />
                      </div>
                      <span
                        className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                          isEarned
                            ? "bg-[#B1FA63]/10 text-[#B1FA63] border-[#B1FA63]/30 font-bold"
                            : "bg-white/[0.03] text-zinc-500 border-white/[0.06]"
                        }`}
                      >
                        {isEarned ? "UNLOCKED" : "LOCKED"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-heading font-bold text-white text-sm">{title}</h3>
                      <span className="text-[10px] font-mono text-zinc-500 uppercase">
                        [{a.code || "CCC"}]
                      </span>
                    </div>
                    <p className="text-zinc-400 text-xs mt-1.5 leading-relaxed font-sans">
                      {a.description}
                    </p>
                  </div>
                  {a.criteria && (
                    <div className="mt-3 pt-2.5 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-zinc-500 font-mono">
                      <span>Requirement</span>
                      <span className={isEarned ? "text-zinc-300 font-medium" : "text-zinc-500"}>
                        {a.criteria}
                      </span>
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>
      </section>

      {/* Trust Footer */}
      <footer className="flex items-center gap-3 p-5 rounded-[18px] border border-white/[0.08] bg-[#1F1F1F] text-zinc-400 font-sans text-xs">
        <Zap className="size-4 text-[#B1FA63] shrink-0" />
        <p>
          Ratings and achievements derive exclusively from physically proctored campus tournaments.
        </p>
      </footer>
    </div>
  );
}
