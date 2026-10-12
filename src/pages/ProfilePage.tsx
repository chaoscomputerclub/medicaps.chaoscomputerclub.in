import { useState, useEffect, useRef } from "react";
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
  Camera,
  Trash2,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { WanderingEyes } from "@/components/ui/WanderingEyes";
import { cn, formatFullName, resolveAvatarUrl } from "@/lib/utils";
import {
  fetchMySocialStatsThunk,
  toggleFollowThunk,
  syncSocialCounts,
  syncCadetSocialCounts,
} from "@/store/slices/socialSlice";
import { fetchContestsThunk } from "@/store/slices/contestSlice";
import { SocialFollowStats } from "@/organization/components/SocialFollowStats";
import {
  uploadAvatarThunk,
  removeAvatarThunk,
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
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

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
  const [showRemoveAvatarModal, setShowRemoveAvatarModal] = useState(false);

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

  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select a PNG, JPG, WebP, or GIF image.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File exceeds 10MB limit.");
      return;
    }

    setIsUploadingAvatar(true);
    const tid = toast.loading("Uploading photo…");
    try {
      const res = await dispatch(uploadAvatarThunk(file)).unwrap();
      if (mutateOwnProfile) {
        mutateOwnProfile((prev: any) => {
          if (!prev) return prev;
          return {
            ...prev,
            member: {
              ...prev.member,
              avatar_url: res.avatar_url,
            },
          };
        });
      }
      toast.success("Profile photo updated!", { id: tid });
      await dispatch(fetchCurrentUserThunk());
      if (revalidateOwnProfile) await revalidateOwnProfile();
    } catch (err: any) {
      toast.error(typeof err === "string" ? err : "Failed to upload photo", { id: tid });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleAvatarRemove = async () => {
    setShowRemoveAvatarModal(false);
    const tid = toast.loading("Removing photo…");
    try {
      await dispatch(removeAvatarThunk()).unwrap();
      if (mutateOwnProfile) {
        mutateOwnProfile((prev: any) => {
          if (!prev) return prev;
          return {
            ...prev,
            member: {
              ...prev.member,
              avatar_url: null,
            },
          };
        });
      }
      toast.success("Profile photo removed", { id: tid });
      await dispatch(fetchCurrentUserThunk());
      if (revalidateOwnProfile) await revalidateOwnProfile();
    } catch (err: any) {
      toast.error(typeof err === "string" ? err : "Failed to remove photo", { id: tid });
    }
  };

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
    () => practiceApi.getRecentSubmissions(isViewingSelf ? undefined : targetHandle, false, 15),
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
        <div className="w-12 h-12 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center mb-4 text-zinc-500">
          <User className="size-6" />
        </div>
        <h2 className="text-lg font-bold text-white mb-2">Member Profile Not Found</h2>
        <p className="text-sm text-zinc-400 max-w-md mb-6">
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
  const achievements = activeData?.achievements || [];
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

  // Attendance metrics (moved before return for two-column layout)
  const officialFinishedContests = contests.filter(
    (c) => c.status === "finished" || c.status === "live",
  ).length;
  const rawAttendanceCount = m.attendance_count ?? 0;
  const rawAttendanceTotal = m.attendance_total ?? 0;
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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-12 space-y-0">

      {/* ═══════════════════════════════════════════════
          HERO — Banner + Overlapping Avatar + Identity
      ═══════════════════════════════════════════════ */}
      <div className="rounded-[24px] overflow-hidden border border-white/[0.08] bg-[#1F1F1F] mb-5">

        {/* Banner */}
        <div className="relative h-28 sm:h-36 bg-gradient-to-br from-[#B1FA63]/10 via-[#1F1F1F] to-[#0d0d0d] border-b border-white/[0.06]">
          {/* Subtle grid texture */}
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 31px, rgba(177,250,99,0.5) 31px, rgba(177,250,99,0.5) 32px), repeating-linear-gradient(90deg, transparent, transparent 31px, rgba(177,250,99,0.5) 31px, rgba(177,250,99,0.5) 32px)`,
            }}
          />
          {/* Glow orb */}
          <div className="absolute -top-8 -left-8 w-48 h-48 bg-[#B1FA63]/5 rounded-full blur-3xl pointer-events-none" />
          {/* Share button top-right */}
          <div className="absolute top-3 right-3 flex gap-2">
            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-zinc-300 hover:text-white bg-[#171717]/80 border border-white/[0.08] hover:border-[#B1FA63]/30 rounded-[10px] transition-colors backdrop-blur-sm"
            >
              {copied ? <Check size={11} className="text-[#B1FA63]" /> : <Share2 size={11} />}
              <span>{copied ? "Copied!" : "Share"}</span>
            </button>
          </div>
        </div>

        {/* Avatar + Identity strip */}
        <div className="px-5 sm:px-7 pb-5 sm:pb-6 -mt-10 sm:-mt-12">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">

            {/* Avatar (overlapping banner) */}
            <div className="relative group shrink-0">
              <Avatar className="size-20 sm:size-24 rounded-[20px] border-2 border-[#1F1F1F] ring-2 ring-white/[0.08] bg-[#171717] overflow-hidden">
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

              {/* Upload overlay */}
              {isSelfUser && (
                <button
                  type="button"
                  onClick={() => !isUploadingAvatar && avatarInputRef.current?.click()}
                  disabled={isUploadingAvatar}
                  aria-label="Change photo"
                  className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity rounded-[20px] flex flex-col items-center justify-center gap-1 cursor-pointer text-[#B1FA63] font-sans text-xs font-semibold"
                >
                  {isUploadingAvatar ? (
                    <WanderingEyes size="sm" className="h-4 text-[#B1FA63]" />
                  ) : (
                    <>
                      <Camera className="size-4" />
                      <span>Upload</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {isSelfUser && (
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            )}

            {/* Name + Actions row */}
            <div className="flex-1 flex flex-col sm:flex-row sm:items-end justify-between gap-3 sm:pb-1">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-heading font-extrabold text-[10px] uppercase tracking-wider text-[#B1FA63]">
                    (06 // Cadet Dossier)
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-display uppercase tracking-wide text-white leading-none">
                  {displayName}
                </h1>
                <div className="flex items-center gap-2 flex-wrap text-xs font-mono text-zinc-400 pt-0.5">
                  <span className="text-[#B1FA63] font-bold">@{displayHandle || "cadet"}</span>
                  <TierBadge tier={m.tier} rating={m.rating}>{m.tier || "1★ Explorer"}</TierBadge>
                  {(m.department || (isSelfUser ? currentMember?.department : null)) && (
                    <>
                      <span className="text-zinc-600">·</span>
                      <span className="text-zinc-300">{m.department || currentMember?.department}</span>
                    </>
                  )}
                  {(m.batch || (isSelfUser ? currentMember?.batch : null)) && (
                    <>
                      <span className="text-zinc-600">·</span>
                      <span className="text-zinc-500">{m.batch || currentMember?.batch}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 flex-wrap shrink-0">
                {isSelfUser ? (
                  <>
                    <Button
                      type="button"
                      onClick={() => !isUploadingAvatar && avatarInputRef.current?.click()}
                      disabled={isUploadingAvatar}
                      variant="outline"
                      size="sm"
                      className="rounded-[10px] bg-[#171717] border-white/[0.08] hover:border-[#B1FA63]/30 hover:bg-[#171717] text-zinc-300 hover:text-white font-heading font-bold uppercase tracking-wider text-xs"
                    >
                      {isUploadingAvatar ? (
                        <WanderingEyes size="inline" className="h-3 mr-1" />
                      ) : (
                        <Camera size={11} className="text-[#B1FA63]" />
                      )}
                      <span>{resolvedAvatar ? "Photo" : "Upload"}</span>
                    </Button>

                    {resolvedAvatar && (
                      <Button
                        type="button"
                        onClick={() => setShowRemoveAvatarModal(true)}
                        variant="destructive"
                        size="sm"
                        className="rounded-[10px] font-heading font-bold uppercase tracking-wider text-xs"
                      >
                        <Trash2 size={10} />
                        <span>Remove</span>
                      </Button>
                    )}

                    <Button asChild variant="outline" size="sm" className="rounded-[10px] bg-[#171717] border-white/[0.08] hover:border-[#B1FA63]/30 hover:bg-[#171717] text-zinc-300 hover:text-white font-heading font-bold uppercase tracking-wider text-xs">
                      <Link to="/settings">
                        <Edit3 size={11} className="text-[#B1FA63]" />
                        <span>Settings</span>
                      </Link>
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      type="button"
                      onClick={handleFollowToggle}
                      disabled={isPendingFollowAction}
                      variant={isFollowing ? "secondary" : "outline"}
                      size="sm"
                      className={isFollowing
                        ? "rounded-[10px] bg-[#B1FA63] text-black font-heading font-extrabold uppercase tracking-wider text-xs hover:bg-[#a0ee4e]"
                        : "rounded-[10px] bg-[#171717] border-white/[0.08] hover:border-[#B1FA63]/30 hover:bg-[#171717] text-zinc-300 hover:text-white font-heading font-bold uppercase tracking-wider text-xs"}
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
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Bio */}
          {m.bio && (
            <p className="text-xs text-zinc-400 max-w-2xl mt-3.5 leading-relaxed font-sans">
              {m.bio}
            </p>
          )}

          {/* Social row */}
          <div className="flex items-center gap-2.5 flex-wrap mt-3.5">
            <SocialFollowStats
              targetId={m.id}
              targetHandle={m.handle}
              targetName={m.full_name || m.handle}
              initialFollowersCount={m.followers_count ?? activeData?.stats?.followers_count}
              initialFollowingCount={m.following_count ?? activeData?.stats?.following_count}
              isSelf={isSelfUser}
            />

            {m.github_username && (
              <a
                href={`https://github.com/${m.github_username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-zinc-300 hover:text-white bg-[#171717] border border-white/[0.08] hover:border-[#B1FA63]/30 rounded-[10px] transition-colors"
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
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-zinc-300 hover:text-white bg-[#171717] border border-white/[0.08] hover:border-[#B1FA63]/30 rounded-[10px] transition-colors"
              >
                <FaLinkedinIn size={11} className="text-[#B1FA63]" />
                <span>LinkedIn</span>
              </a>
            )}

            {/* Enrollment badge */}
            <div className="ml-auto hidden sm:flex items-center gap-4 text-xs font-mono border-l border-white/[0.06] pl-4">
              <div>
                <span className="block text-zinc-500 uppercase text-[9px] font-heading font-bold tracking-wider">Enrollment No.</span>
                <span className="text-white font-medium tabular-nums">{enrollmentNo}</span>
              </div>
              <div>
                <span className="block text-zinc-500 uppercase text-[9px] font-heading font-bold tracking-wider">Email</span>
                <span className="text-zinc-300">
                  {isSelfUser
                    ? m.email || currentMember?.email || "—"
                    : m.email || "Campus Only"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════
          METRICS STRIP — 4 stat tiles
      ═══════════════════════════════════════════════ */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
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

      {/* ═══════════════════════════════════════════════
          TWO-COLUMN LAYOUT
          Left (main feed) | Right (sticky sidebar)
      ═══════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5 items-start">

        {/* ── LEFT COLUMN ── */}
        <div className="space-y-5 min-w-0">

          {/* Problem Solving + Badges */}
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

          {/* 365-Day Activity Heatmap */}
          <CodingActivityGraph activityData={activityData} loading={activityLoading} />

          {/* Recent Submissions */}
          <RecentSubmissionsCard
            submissions={recentSubmissionsData || []}
            battles={battles}
            loading={recentSubmissionsLoading && !recentSubmissionsData}
          />

          {/* Contest Battle Logs */}
          <section className="rounded-[24px] border border-white/[0.08] bg-[#1F1F1F] p-6 sm:p-8 space-y-5">
            <SectionHeader kicker="04 // Record" index="CONTESTS" title="Attended Tournaments" />
            <div className="space-y-2 font-mono text-xs">
              {battles.length === 0 ? (
                <div className="text-center py-8 flex flex-col items-center justify-center">
                  <div className="size-20 mb-2 flex items-center justify-center">
                    <img
                      src="/matiks-assets/empty-states/no_duels_to_flex.png"
                      alt="No tournaments on file"
                      className="size-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                  </div>
                  <p className="text-xs font-mono text-zinc-400">No recorded tournaments on file.</p>
                </div>
              ) : (
                battles.map((b: any) => (
                  <article
                    key={b.certificate_id}
                    className="py-3 px-3.5 rounded-[12px] bg-[#171717] border border-white/[0.04] hover:border-white/[0.12] transition-colors flex items-center justify-between flex-wrap gap-3"
                  >
                    <time className="text-zinc-500 font-mono text-xs">
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
                        <span className="text-[10px] text-zinc-500 font-mono block mt-0.5">
                          {b.certificate_id}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-zinc-400 font-sans">
                        Rank{" "}
                        <strong className="text-white font-mono font-bold tabular-nums">#{b.rank}</strong>
                      </span>
                      <span className="text-zinc-400 font-sans">
                        Solved{" "}
                        <strong className="text-white font-mono font-bold tabular-nums">{b.solved}</strong>
                      </span>
                      <em
                        className={
                          b.delta >= 0
                            ? "text-[#B1FA63] not-italic font-mono font-bold tabular-nums"
                            : "text-red-400 not-italic font-mono font-bold tabular-nums"
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

          {/* Achievement Ledger */}
          <section className="rounded-[24px] border border-white/[0.08] bg-[#1F1F1F] p-6 sm:p-8 space-y-5">
            <SectionHeader kicker="05 // Milestones" index="HONORS" title="Achievement Ledger" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
          {achievements.length === 0 ? (
            <div className="text-center py-8 text-zinc-500 col-span-full flex flex-col items-center justify-center">
              <div className="size-16 mb-2 flex items-center justify-center">
                <img
                  src="/matiks-assets/badges/Novice.png"
                  alt="Locked Badge"
                  className="size-8 object-contain opacity-40 grayscale"
                />
              </div>
              <span className="font-heading font-bold uppercase tracking-wider text-xs">No achievements unlocked yet.</span>
            </div>
          ) : (
            achievements.map((a: any) => {
              const code = (a.code || a.id || a.name || a.title || "").toLowerCase();
              const certSrc =
                code.includes("contest") || code.includes("tourn") || code.includes("podium")
                  ? "/matiks-assets/achievements/ContestRecognition.webp"
                  : code.includes("survival") || code.includes("streak") || code.includes("fire")
                  ? "/matiks-assets/achievements/SurvivalSaturdayRecognition.webp"
                  : code.includes("showdown") || code.includes("duel") || code.includes("battle")
                  ? "/matiks-assets/achievements/ShowdownRecognition.webp"
                  : "/matiks-assets/badges/badge.webp";

              return (
                <article
                  key={a.code || a.id || a.name || a.title}
                  className={`p-4 rounded-[16px] border bg-[#171717] transition-all ${
                    a.earned !== false
                      ? "border-[#B1FA63]/30 shadow-[0_0_16px_rgba(177,250,99,0.06)]"
                      : "border-white/[0.06] opacity-40"
                  }`}
                >
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="size-6 shrink-0 flex items-center justify-center">
                      <img
                        src={certSrc}
                        alt="Achievement badge"
                        className="size-full object-contain"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                    </div>
                    <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-400">
                      {a.code || a.id || "ACH"}
                    </span>
                  </div>
                  <h3 className="font-heading font-bold text-white text-sm">{a.name || a.title}</h3>
                  <p className="text-zinc-400 text-xs mt-1 leading-relaxed font-sans">{a.description}</p>
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

        {/* ── RIGHT SIDEBAR ── */}
        <div className="space-y-5 lg:sticky lg:top-4">

          {/* Rating Trajectory */}
          <div className="rounded-[24px] border border-white/[0.08] bg-[#1F1F1F] p-5 space-y-4">
            <SectionHeader
              kicker="03 // Rating History"
              index="TRAJECTORY"
              title="Competitive Trajectory"
            />
            <RatingChart data={history} loading={isLoading && history.length === 0} />
          </div>

          {/* Rating Distribution */}
          <RatingDistributionCard
            member={m}
            distribution={distribution}
            loading={distLoading && !distribution}
          />

          {/* Enrollment info (mobile only — shown in hero on sm+) */}
          <div className="sm:hidden rounded-[18px] border border-white/[0.08] bg-[#1F1F1F] p-4 space-y-3 text-xs font-mono">
            <div>
              <span className="block text-zinc-500 uppercase text-[9px] font-heading font-bold tracking-wider mb-0.5">Enrollment No.</span>
              <span className="text-white font-medium tabular-nums">{enrollmentNo}</span>
            </div>
            <div>
              <span className="block text-zinc-500 uppercase text-[9px] font-heading font-bold tracking-wider mb-0.5">Email</span>
              <span className="text-zinc-300">
                {isSelfUser
                  ? m.email || currentMember?.email || "—"
                  : m.email || "Campus Only"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Remove Avatar Confirmation Modal */}
      <AlertDialog open={showRemoveAvatarModal} onOpenChange={setShowRemoveAvatarModal}>
        <AlertDialogContent className="border border-white/[0.08] bg-[#1F1F1F] text-white p-6 max-w-md rounded-[24px]">
          <AlertDialogHeader className="space-y-2 text-left">
            <AlertDialogTitle className="text-lg font-heading font-bold text-white">
              Remove profile photo?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-zinc-400 font-sans leading-relaxed">
              Are you sure you want to remove your custom profile photo? This will revert your
              avatar to your initials placeholder.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter className="mt-5 flex justify-end gap-2.5">
            <AlertDialogCancel
              onClick={() => setShowRemoveAvatarModal(false)}
              className="bg-transparent border border-white/[0.08] text-zinc-300 hover:bg-white/5 hover:text-white px-4 py-2 text-xs font-heading font-bold uppercase tracking-wider rounded-[8px] cursor-pointer"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAvatarRemove}
              className="bg-red-600 hover:bg-red-700 text-white font-heading font-bold uppercase tracking-wider px-4 py-2 text-xs rounded-[8px] cursor-pointer"
            >
              Remove Photo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
