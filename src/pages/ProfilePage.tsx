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
  Zap,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { openSocialDrawer, fetchMyFollowingIdsThunk, toggleFollowThunk } from "@/store/slices/socialSlice";
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
    handle.toLowerCase() === "me" ||
    (currentMember?.handle && handle.toLowerCase() === currentMember.handle.toLowerCase());

  const {
    data: ownProfileData,
    loading: ownLoading,
  } = useSwrData(
    "member:profile:full",
    () => getMemberProfileData(true),
    { ttl: 5 * 60 * 1000, enabled: isViewingSelf }
  );

  const {
    data: studentProfileData,
    loading: studentLoading,
    revalidate: revalidateStudentProfile,
  } = useSwrData(
    `student:profile:${handle?.toLowerCase() || ""}`,
    () => (handle ? getStudentProfileData(handle, true) : Promise.resolve(null)),
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-4">
        <h1 className="text-2xl font-mono font-bold text-white uppercase">
          {handle ? `Cadet '@${handle}' not found` : "Profile unavailable"}
        </h1>
        <p className="text-zinc-400 text-sm">
          {handle
            ? "No student record exists with this handle in the Medi-Caps competitive programming index."
            : "Please log in to view your competition profile."}
        </p>
        <div className="flex gap-3 pt-2">
          <Button
            onClick={() => navigate("/portal/leaderboard")}
            className="bg-lime-400 hover:bg-lime-300 text-black font-bold font-mono uppercase text-xs rounded-none shadow-md shadow-lime-400/20"
          >
            View Leaderboard
          </Button>
          {!isAuthenticated() && (
            <Button
              onClick={() => navigate("/auth")}
              variant="outline"
              className="border-white/10 text-white font-mono uppercase text-xs rounded-none"
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

  const enrollmentNo =
    m.prn && m.prn !== "N/A" && m.prn !== "—"
      ? m.prn
      : m.email?.includes("@")
        ? m.email.split("@")[0].toUpperCase()
        : m.handle?.toUpperCase() || "—";

  const isSelfUser =
    Boolean(m.is_self) ||
    isViewingSelf ||
    Boolean(currentMember?.id && m.id && currentMember.id === m.id) ||
    Boolean(currentMember?.handle && m.handle && currentMember.handle.toLowerCase() === m.handle.toLowerCase());

  const isNameDefaultEnrollment = Boolean(
    isSelfUser &&
    m.full_name &&
    (m.full_name.trim().toLowerCase() === enrollmentNo.toLowerCase() ||
      m.full_name.trim().toLowerCase() === (m.handle || "").toLowerCase() ||
      /^EN\d{2}[A-Z]{2}\d+/i.test(m.full_name.trim()))
  );

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

  // Copy Profile Link Handler
  const handleCopyLink = () => {
    const url = `${window.location.origin}/portal/profile/${m.handle}`;
    void navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Profile URL copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  // Follow / Unfollow Handler
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
        toast.success(`You are now following @${m.handle || "student"}`);
      } else {
        toast.info(`Unfollowed @${m.handle || "student"}`);
      }

      if (revalidateStudentProfile) {
        await revalidateStudentProfile();
      }
    } catch (err: any) {
      console.error("Follow action failed:", err);
      toast.error(typeof err === "string" ? err : "Failed to toggle follow status");
    } finally {
      setFollowLoading(false);
    }
  };



  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Profile Header */}
      <header className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 rounded-none border border-white/10 bg-zinc-900/60 p-6 md:p-8 backdrop-blur-md shadow-xl">
        <div className="flex items-start gap-5">
          <Avatar className="size-16 sm:size-20 rounded-none border border-white/10 bg-zinc-950 shrink-0 shadow-inner">
            {m.avatar_url &&
            (m.avatar_url.startsWith("http") ||
              m.avatar_url.startsWith("/media/") ||
              m.avatar_url.startsWith("/")) ? (
              <AvatarImage src={m.avatar_url} alt={m.full_name || m.handle} className="object-cover rounded-none" />
            ) : null}
            <AvatarFallback className="rounded-none bg-lime-400/10 text-lime-400 font-mono font-bold text-xl flex items-center justify-center w-full h-full">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-lime-400">
                (05 // Cadet Identity)
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500 tabular-nums">
                INDEX 5.0 · INSTITUTIONAL DOSSIER
              </span>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white uppercase font-mono tracking-tight">
                {m.full_name || m.handle}
              </h1>

              {/* If viewing own profile: Direct link to Settings */}
              {isSelfUser ? (
                <Button
                  asChild
                  id="profile-edit-btn"
                  className="h-auto inline-flex items-center gap-1.5 px-3 py-1 font-mono text-xs uppercase font-bold text-lime-400 bg-lime-400/10 border border-lime-400/30 hover:bg-lime-400 hover:text-black rounded-none cursor-pointer"
                >
                  <Link to="/portal/settings">
                    <Edit3 size={12} />
                    <span>Edit Profile</span>
                  </Link>
                </Button>
              ) : (
                /* If viewing another student: Follow & Share buttons */
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    onClick={handleFollowToggle}
                    disabled={isPendingFollowAction}
                    className={cn(
                      "h-auto inline-flex items-center gap-1.5 px-3.5 py-1 font-mono text-xs uppercase font-bold rounded-none cursor-pointer transition-all",
                      isFollowing
                        ? "bg-zinc-800 text-zinc-200 border border-white/10 hover:bg-rose-950/40 hover:text-rose-400 hover:border-rose-800/60"
                        : "bg-lime-400 text-black hover:bg-lime-300 font-bold shadow-md shadow-lime-400/20"
                    )}
                  >
                    {isFollowing ? (
                      <>
                        {isPendingFollowAction ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <UserCheck size={12} />
                        )}
                        <span>Following</span>
                      </>
                    ) : (
                      <>
                        {isPendingFollowAction ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <UserPlus size={12} />
                        )}
                        <span>Follow</span>
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    onClick={handleCopyLink}
                    variant="outline"
                    className="h-auto inline-flex items-center gap-1.5 px-2.5 py-1 font-mono text-xs uppercase text-zinc-300 border border-white/10 hover:border-zinc-500 bg-zinc-800/60 rounded-none cursor-pointer"
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

            <div className="flex items-center gap-2 flex-wrap text-xs font-mono text-zinc-400 pt-0.5">
              <TierBadge>{m.tier || "1★ Explorer"}</TierBadge>
              <span>•</span>
              <span className="text-zinc-200 font-bold">{m.department}</span>
              <span>•</span>
              <span className="text-zinc-300">{m.batch}</span>
              <span>•</span>
              <span className="text-lime-400 font-bold">@{m.handle}</span>
            </div>

            {m.bio && (
              <p className="text-xs text-zinc-300 font-sans max-w-xl pt-1">
                {m.bio}
              </p>
            )}

            {isNameDefaultEnrollment && (
              <p className="text-[11px] font-sans text-amber-400/90 pt-1 flex items-center gap-1.5 flex-wrap">
                <span>Displaying enrollment number as name.</span>
                <Link to="/portal/settings" className="text-lime-400 hover:underline font-medium">
                  Update to your real name in Settings →
                </Link>
              </p>
            )}

            {/* Followers / Following and CP Links */}
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
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono uppercase bg-zinc-800/60 hover:bg-zinc-700/60 text-zinc-300 hover:text-white border border-white/10 hover:border-lime-400/40 rounded-none cursor-pointer transition-colors"
              >
                <Users size={12} className="text-lime-400" />
                <strong className="text-white font-mono tabular-nums">{displayedFollowers}</strong> Followers
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
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono uppercase bg-zinc-800/60 hover:bg-zinc-700/60 text-zinc-300 hover:text-white border border-white/10 hover:border-lime-400/40 rounded-none cursor-pointer transition-colors"
              >
                <UserCheck size={12} className="text-lime-400" />
                <strong className="text-white font-mono tabular-nums">{displayedFollowing}</strong> Following
              </button>
              {m.github_username && (
                <a
                  href={`https://github.com/${m.github_username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-mono text-zinc-300 hover:text-white bg-zinc-800/60 border border-white/10 hover:border-zinc-500 rounded-none"
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
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-mono text-cyan-400 hover:text-cyan-300 bg-zinc-800/60 border border-white/10 hover:border-cyan-500/40 rounded-none"
                >
                  <Linkedin size={12} />
                  <span>LinkedIn</span>
                </a>
              )}
            </div>
          </div>
        </div>

        <dl className="flex sm:flex-col gap-4 font-mono text-xs border-t lg:border-t-0 lg:border-l border-white/10 pt-4 lg:pt-0 lg:pl-6">
          <div>
            <dt className="text-zinc-500 uppercase text-[10px]">Enrollment No.</dt>
            <dd className="text-zinc-200 font-bold tabular-nums">{enrollmentNo}</dd>
          </div>
          <div>
            <dt className="text-zinc-500 uppercase text-[10px]">Institutional mail</dt>
            <dd className="text-zinc-200 font-bold">{m.email || "—"}</dd>
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
        <div className="lg:col-span-2 rounded-none border border-white/10 bg-zinc-900/60 p-6 space-y-4 backdrop-blur-md shadow-xl">
          <SectionHeader kicker="01 // Rating Archive" index="INDEX 5.1 · TRAJECTORY" title="Competitive Trajectory" />
          <RatingChart data={history} />
        </div>
        <div>
          <RatingDistributionCard member={m} distribution={distribution} />
        </div>
      </section>

      {/* Offline Battle History */}
      <section className="rounded-none border border-white/10 bg-zinc-900/60 p-6 space-y-4 backdrop-blur-md shadow-xl">
        <SectionHeader kicker="02 // Permanent Record" index="INDEX 5.2 · CONTEST LOGS" title="Offline Battle History" />
        <div className="divide-y divide-white/5">
          {battles.length === 0 ? (
            <div className="text-center py-8 text-zinc-500 font-mono text-xs">
              No offline battles recorded yet. Attend an offline contest to establish a permanent record.
            </div>
          ) : (
            battles.map((b: any) => (
              <article key={b.certificate_id} className="py-3.5 flex items-center justify-between flex-wrap gap-4">
                <time className="font-mono text-xs text-zinc-400">
                  {new Date(b.date).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </time>
                <div>
                  <h3 className="text-sm font-bold text-white font-mono uppercase">{b.contest}</h3>
                  <code className="font-mono text-[10px] text-zinc-500">{b.certificate_id}</code>
                </div>
                <div className="flex items-center gap-4 font-mono text-xs">
                  <span>RANK <strong className="text-white font-bold tabular-nums">#{b.rank}</strong></span>
                  <span>SOLVED <strong className="text-white font-bold tabular-nums">{b.solved}</strong></span>
                  <span>PENALTY <strong className="text-white font-bold tabular-nums">{b.penalty}</strong></span>
                  <em className={b.delta >= 0 ? "text-emerald-400 not-italic font-bold tabular-nums" : "text-rose-400 not-italic font-bold tabular-nums"}>
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
        <div className="lg:col-span-2 rounded-none border border-white/10 bg-zinc-900/60 p-6 space-y-4 backdrop-blur-md shadow-xl">
          <SectionHeader kicker="03 // Milestones" index="INDEX 5.3 · HONORS LEDGER" title="Achievement Ledger" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {achievements.length === 0 ? (
              <div className="text-center py-8 text-zinc-500 font-mono text-xs col-span-2">
                No achievements unlocked yet.
              </div>
            ) : (
              achievements.map((a: any) => (
                <article
                  key={a.code || a.id || a.name || a.title}
                  className={`p-4 rounded-none border ${
                    a.earned !== false ? "border-lime-400/30 bg-lime-400/5" : "border-white/5 bg-zinc-950/40 opacity-60"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {a.earned !== false ? <Award className="size-4 text-lime-400" /> : <LockKeyhole className="size-4 text-zinc-500" />}
                    <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">{a.code || a.id || "ACH"}</span>
                  </div>
                  <h3 className="font-mono text-sm font-bold text-white uppercase">{a.name || a.title}</h3>
                  <p className="text-xs text-zinc-400 mt-1">{a.description}</p>
                </article>
              ))
            )}
          </div>
        </div>

        <div className="rounded-none border border-white/10 bg-zinc-900/60 p-6 space-y-4 backdrop-blur-md shadow-xl">
          <SectionHeader kicker="04 // Cryptographic Result" index="INDEX 5.4 · CHAIN PROOF" title="Latest Proof" />
          {proofs[0] ? (
            <>
              <ProofBadge proof={proofs[0]} />
              <Link
                to={`/portal/verify?proof=${encodeURIComponent(proofs[0].certificate_id ?? "")}`}
                className="inline-flex items-center gap-1.5 font-mono text-xs text-lime-400 hover:underline mt-4"
              >
                Open verification console <ExternalLink className="size-3.5" />
              </Link>
            </>
          ) : (
            <div className="py-8 text-center text-zinc-500 font-mono text-xs">
              No proofs generated yet. Complete an offline contest to seal results.
            </div>
          )}
        </div>
      </section>

      {/* Trust Footer */}
      <footer className="flex items-center gap-3 p-4 rounded-none border border-white/10 bg-zinc-900/40 text-zinc-400 font-mono text-xs backdrop-blur-sm">
        <Zap className="size-4 text-lime-400 shrink-0" />
        <p>
          Your profile only reflects attended, proctored sessions. Practice streaks and browser activity are intentionally excluded.
        </p>
      </footer>
    </div>
  );
}
