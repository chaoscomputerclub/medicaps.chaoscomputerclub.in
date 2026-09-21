import { useState, useEffect, useRef } from "react";
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
  Zap,
  Loader2,
  Camera,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { cn, formatFullName, resolveAvatarUrl } from "@/lib/utils";
import { openSocialDrawer, fetchMyFollowingIdsThunk, toggleFollowThunk } from "@/store/slices/socialSlice";
import { uploadAvatarThunk, removeAvatarThunk, fetchCurrentUserThunk } from "@/store/slices/authSlice";
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
import { isAuthenticated } from "@/lib/auth";
import { useSwrData } from "@/lib/cache/swrCache";

export function ProfilePage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { handle } = useParams<{ handle?: string }>();
  const currentMember = useAppSelector((s) => s.auth.member);
  const followingIds = useAppSelector((s) => s.social.followingIds);
  const hasFetchedFollowing = useAppSelector((s) => s.social.hasFetchedFollowing);
  const actionPendingId = useAppSelector((s) => s.social.actionPendingId);

  const [copied, setCopied] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  // Determine if viewing own profile or another student's profile
  const isViewingSelf =
    !handle ||
    (handle && handle.toLowerCase() === "me") ||
    Boolean(
      currentMember?.handle &&
        (handle || "").toLowerCase() === (currentMember.handle || "").toLowerCase()
    );

  const {
    data: ownProfileData,
    loading: ownLoading,
    revalidate: revalidateOwnProfile,
    mutate: mutateOwnProfile,
  } = useSwrData(
    "member:profile:full",
    () => getMemberProfileData(true),
    { ttl: 5 * 60 * 1000, enabled: isViewingSelf }
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
    if (!confirm("Remove your custom profile picture?")) return;
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
  } = useSwrData(
    `student:profile:${targetHandle}`,
    () => getStudentProfileData(targetHandle),
    { ttl: 5 * 60 * 1000, enabled: !isViewingSelf }
  );

  const { data: distribution } = useSwrData(
    "leaderboard:distribution",
    () => getRatingDistribution(),
    { ttl: 10 * 60 * 1000 }
  );

  useEffect(() => {
    if (isAuthenticated() && !hasFetchedFollowing) {
      dispatch(fetchMyFollowingIdsThunk());
    }
  }, [dispatch, hasFetchedFollowing]);

  const activeData = isViewingSelf ? ownProfileData : studentProfileData;
  const isLoading = isViewingSelf ? (ownLoading && !ownProfileData) : (studentLoading && !studentProfileData);

  if (isLoading || !activeData) {
    return <ProfileSkeleton />;
  }

  const m = activeData.member;
  const history = activeData.history || [];
  const battles = activeData.battles || [];
  const achievements = activeData.achievements || [];
  const proofs = activeData.proofs || [];

  const isSelfUser = Boolean(
    isViewingSelf ||
    (currentMember?.id && m.id === currentMember.id) ||
    (currentMember?.handle && (m.handle || "").toLowerCase() === (currentMember.handle || "").toLowerCase())
  );

  const enrollmentNo = m.enrollment_number || m.enrollment_no || m.enrollment || "—";
  const formattedFullName = formatFullName(m.first_name, m.last_name, m.full_name);
  const displayName = formattedFullName || m.handle || "Cadet";

  const initials = formattedFullName
    ? formattedFullName
        .split(" ")
        .map((w: string) => w[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : m.handle
      ? m.handle.slice(0, 2).toUpperCase()
      : "CC";

  const effectiveAvatar = isSelfUser
    ? (currentMember?.avatar_url ?? m.avatar_url)
    : m.avatar_url;
  const resolvedAvatar = resolveAvatarUrl(effectiveAvatar);

  const isFollowedInStore =
    !isSelfUser &&
    (followingIds.includes(m.id) || (m.handle ? followingIds.includes(m.handle) : false));

  const isFollowing =
    isSelfUser
      ? false
      : hasFetchedFollowing
        ? isFollowedInStore
        : (isFollowedInStore || Boolean(m.is_following));

  const initialFollowed = Boolean(m.is_following);
  const delta =
    !isSelfUser
      ? (isFollowing ? 1 : 0) - (initialFollowed ? 1 : 0)
      : 0;
  const displayedFollowers = Math.max(0, (m.followers_count || 0) + delta);
  const displayedFollowing = isSelfUser
    ? (hasFetchedFollowing ? followingIds.length : (m.following_count ?? 0))
    : (m.following_count ?? 0);

  const isPendingFollowAction =
    followLoading ||
    actionPendingId === m.id ||
    (m.handle ? actionPendingId === m.handle : false);

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
        })
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
      <header className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 rounded-lg border border-white/8 bg-black p-6 sm:p-7">
        <div className="flex items-start gap-5">
          {/* Avatar Container */}
          <div className="relative group shrink-0">
            <Avatar className="size-16 sm:size-20 rounded-lg border border-white/10 bg-black overflow-hidden">
              {resolvedAvatar ? (
                <AvatarImage
                  src={resolvedAvatar}
                  alt={displayName}
                  className="object-cover rounded-lg"
                />
              ) : null}
              <AvatarFallback className="rounded-lg bg-lime-400/10 text-lime-400 font-mono font-semibold text-lg flex items-center justify-center w-full h-full">
                {initials}
              </AvatarFallback>
            </Avatar>

            {isSelfUser && (
              <>
                <button
                  type="button"
                  onClick={() => !isUploadingAvatar && avatarInputRef.current?.click()}
                  disabled={isUploadingAvatar}
                  aria-label="Change photo"
                  className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity rounded-lg flex flex-col items-center justify-center gap-1 cursor-pointer text-lime-400 font-mono text-[9px] font-semibold uppercase tracking-wider p-1 text-center"
                >
                  {isUploadingAvatar ? (
                    <Loader2 className="size-4 animate-spin text-lime-400" />
                  ) : (
                    <>
                      <Camera className="size-3.5" />
                      <span>Upload</span>
                    </>
                  )}
                </button>
              </>
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

          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                Cadet Dossier
              </span>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
                {displayName}
              </h1>

              {isSelfUser ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    type="button"
                    onClick={() => !isUploadingAvatar && avatarInputRef.current?.click()}
                    disabled={isUploadingAvatar}
                    size="sm"
                    className="h-7 inline-flex items-center gap-1.5 px-2.5 font-mono text-xs text-black bg-lime-400 hover:bg-lime-300 rounded-md font-semibold"
                  >
                    {isUploadingAvatar ? <Loader2 size={11} className="animate-spin" /> : <Camera size={11} />}
                    <span>{resolvedAvatar ? "Photo" : "Upload"}</span>
                  </Button>

                  {resolvedAvatar && (
                    <Button
                      type="button"
                      onClick={handleAvatarRemove}
                      variant="outline"
                      size="sm"
                      className="h-7 inline-flex items-center gap-1 px-2 font-mono text-xs text-zinc-400 hover:text-white border-white/10 bg-black rounded-md"
                    >
                      <Trash2 size={10} />
                    </Button>
                  )}

                  <Button
                    asChild
                    size="sm"
                    className="h-7 inline-flex items-center gap-1.5 px-2.5 font-mono text-xs text-zinc-300 border border-white/10 bg-black hover:text-white hover:border-white/20 rounded-md"
                  >
                    <Link to="/settings">
                      <Edit3 size={11} />
                      <span>Settings</span>
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    onClick={handleFollowToggle}
                    disabled={isPendingFollowAction}
                    size="sm"
                    className={cn(
                      "h-7 inline-flex items-center gap-1.5 px-3 font-mono text-xs rounded-md transition-colors",
                      isFollowing
                        ? "bg-black text-zinc-300 border border-white/10 hover:text-white"
                        : "bg-lime-400 text-black hover:bg-lime-300 font-semibold"
                    )}
                  >
                    {isFollowing ? (
                      <>
                        {isPendingFollowAction ? <Loader2 size={11} className="animate-spin" /> : <UserCheck size={11} />}
                        <span>Following</span>
                      </>
                    ) : (
                      <>
                        {isPendingFollowAction ? <Loader2 size={11} className="animate-spin" /> : <UserPlus size={11} />}
                        <span>Follow</span>
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    onClick={handleCopyLink}
                    variant="outline"
                    size="sm"
                    className="h-7 inline-flex items-center gap-1 px-2 font-mono text-xs text-zinc-400 border border-white/10 bg-black hover:text-white rounded-md"
                  >
                    {copied ? <Check size={11} className="text-lime-400" /> : <Share2 size={11} />}
                  </Button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap text-xs font-mono text-zinc-400 pt-0.5">
              <TierBadge>{m.tier || "1★ Explorer"}</TierBadge>
              <span>·</span>
              <span className="text-zinc-300">{m.department}</span>
              <span>·</span>
              <span className="text-zinc-500">{m.batch}</span>
              <span>·</span>
              <span className="text-lime-400">@{m.handle}</span>
            </div>

            {m.bio && (
              <p className="text-xs text-zinc-400 max-w-xl pt-0.5 leading-relaxed font-sans">
                {m.bio}
              </p>
            )}

            {/* Social Pills */}
            <div className="flex items-center gap-2 flex-wrap pt-2">
              <button
                type="button"
                onClick={() =>
                  dispatch(
                    openSocialDrawer({
                      targetId: m.id,
                      targetHandle: m.handle,
                      targetName: m.full_name || m.handle,
                      followersCount: displayedFollowers,
                      followingCount: displayedFollowing,
                      type: "followers",
                    })
                  )
                }
                className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-mono rounded bg-zinc-950 hover:bg-zinc-900 text-zinc-400 hover:text-white border border-white/8 transition-colors cursor-pointer"
              >
                <Users size={11} className="text-lime-400" />
                <strong className="text-white tabular-nums">{displayedFollowers}</strong> Followers
              </button>
              <button
                type="button"
                onClick={() =>
                  dispatch(
                    openSocialDrawer({
                      targetId: m.id,
                      targetHandle: m.handle,
                      targetName: m.full_name || m.handle,
                      followersCount: displayedFollowers,
                      followingCount: displayedFollowing,
                      type: "following",
                    })
                  )
                }
                className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-mono rounded bg-zinc-950 hover:bg-zinc-900 text-zinc-400 hover:text-white border border-white/8 transition-colors cursor-pointer"
              >
                <UserCheck size={11} className="text-lime-400" />
                <strong className="text-white tabular-nums">{displayedFollowing}</strong> Following
              </button>
              {m.github_username && (
                <a
                  href={`https://github.com/${m.github_username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono text-zinc-400 hover:text-white bg-zinc-950 border border-white/8 rounded"
                >
                  <Github size={11} />
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
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono text-zinc-400 hover:text-white bg-zinc-950 border border-white/8 rounded"
                >
                  <Linkedin size={11} />
                  <span>LinkedIn</span>
                </a>
              )}
            </div>
          </div>
        </div>

        <dl className="flex sm:flex-col gap-3 font-mono text-xs border-t lg:border-t-0 lg:border-l border-white/8 pt-4 lg:pt-0 lg:pl-6">
          <div>
            <dt className="text-zinc-500 uppercase text-[9px] tracking-wider">Enrollment No.</dt>
            <dd className="text-white font-medium tabular-nums">{enrollmentNo}</dd>
          </div>
          <div>
            <dt className="text-zinc-500 uppercase text-[9px] tracking-wider">Email</dt>
            <dd className="text-zinc-300">{m.email || "—"}</dd>
          </div>
        </dl>
      </header>

      {/* 4 Metric Bento Strip */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric label="Rating" value={m.rating} detail={`Peak: ${m.peak_rating}`} />
        <Metric
          label="Rank"
          value={(m.attendance_count ?? 0) > 0 ? `#${m.university_rank}` : "#—"}
          detail={(m.attendance_count ?? 0) > 0 ? `of ${m.active_members}` : "Unranked"}
        />
        <Metric label="Podiums" value={m.podiums} detail="Verified finishes" />
        <Metric
          label="Contests"
          value={`${m.attendance_count}/${m.attendance_total}`}
          detail="Official attendance"
        />
      </section>

      {/* Trajectory & Distribution */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 rounded-lg border border-white/8 bg-black p-5 sm:p-6 space-y-4">
          <SectionHeader kicker="01 // Rating History" index="TRAJECTORY" title="Competitive Trajectory" />
          <RatingChart data={history} />
        </div>
        <div>
          <RatingDistributionCard member={m} distribution={distribution} />
        </div>
      </section>

      {/* Contest Battle Logs */}
      <section className="rounded-lg border border-white/8 bg-black p-5 sm:p-6 space-y-4">
        <SectionHeader kicker="02 // Record" index="CONTESTS" title="Attended Tournaments" />
        <div className="divide-y divide-white/6 font-mono text-xs">
          {battles.length === 0 ? (
            <div className="text-center py-8 text-zinc-600">
              No recorded tournaments on file.
            </div>
          ) : (
            battles.map((b: any) => (
              <article key={b.certificate_id} className="py-3 flex items-center justify-between flex-wrap gap-3">
                <time className="text-zinc-500">
                  {new Date(b.date).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </time>
                <div>
                  <h3 className="font-semibold text-white">{b.contest}</h3>
                  <code className="text-[10px] text-zinc-500">{b.certificate_id}</code>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-zinc-400">Rank <strong className="text-white font-semibold tabular-nums">#{b.rank}</strong></span>
                  <span className="text-zinc-400">Solved <strong className="text-white font-semibold tabular-nums">{b.solved}</strong></span>
                  <em className={b.delta >= 0 ? "text-lime-400 not-italic font-semibold tabular-nums" : "text-red-400 not-italic font-semibold tabular-nums"}>
                    {b.delta > 0 ? "+" : ""}{b.delta}
                  </em>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      {/* Achievements & Proof */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 rounded-lg border border-white/8 bg-black p-5 sm:p-6 space-y-4">
          <SectionHeader kicker="03 // Milestones" index="HONORS" title="Achievement Ledger" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
            {achievements.length === 0 ? (
              <div className="text-center py-8 text-zinc-600 col-span-2">
                No achievements unlocked yet.
              </div>
            ) : (
              achievements.map((a: any) => (
                <article
                  key={a.code || a.id || a.name || a.title}
                  className={`p-3.5 rounded-lg border ${
                    a.earned !== false ? "border-lime-400/30 bg-black" : "border-white/6 bg-black opacity-40"
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1.5">
                    {a.earned !== false ? <Award className="size-3.5 text-lime-400" /> : <LockKeyhole className="size-3.5 text-zinc-500" />}
                    <span className="text-[9px] uppercase tracking-wider text-zinc-500">{a.code || a.id || "ACH"}</span>
                  </div>
                  <h3 className="font-semibold text-white">{a.name || a.title}</h3>
                  <p className="text-zinc-400 text-[11px] mt-0.5 leading-relaxed">{a.description}</p>
                </article>
              ))
            )}
          </div>
        </div>

        <div className="rounded-lg border border-white/8 bg-black p-5 sm:p-6 space-y-4">
          <SectionHeader kicker="04 // Verification" index="CRYPTOGRAPHIC" title="Latest Proof" />
          {proofs[0] ? (
            <>
              <ProofBadge proof={proofs[0]} />
              <Link
                to={`/verify?proof=${encodeURIComponent(proofs[0].certificate_id ?? "")}`}
                className="inline-flex items-center gap-1 font-mono text-xs text-lime-400 hover:underline pt-2"
              >
                Open Verification Console <ExternalLink className="size-3" />
              </Link>
            </>
          ) : (
            <div className="py-8 text-center text-zinc-600 font-mono text-xs">
              No cryptographic proofs generated yet.
            </div>
          )}
        </div>
      </section>

      {/* Trust Footer */}
      <footer className="flex items-center gap-2.5 p-4 rounded-lg border border-white/8 bg-black text-zinc-500 font-mono text-xs">
        <Zap className="size-3.5 text-lime-400 shrink-0" />
        <p>
          Ratings and achievements derive exclusively from physically proctored campus tournaments.
        </p>
      </footer>
    </div>
  );
}
