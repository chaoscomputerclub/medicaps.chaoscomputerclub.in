/**
 * Chaos Computer Club India — Cyber Profile Editor Modal
 * Modeled after Interleet (interleet.sharexpress.in) developer profile suite.
 * Supports custom avatar image uploads to MinIO Object Storage, preset cyber emblems,
 * real-time live card preview, immutable institutional locks, and Redux Toolkit state.
 */

import { useEffect, useState, useRef } from "react";
import {
  Award,
  Camera,
  Check,
  Code2,
  ExternalLink,
  Github,
  Globe,
  GraduationCap,
  Image as ImageIcon,
  Linkedin,
  Loader2,
  Lock,
  Mail,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  User,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { closeEditProfileModal } from "@/store/slices/uiSlice";
import { updateProfileThunk } from "@/store/slices/authSlice";
import { invalidateFullProfileCache } from "@/organization/data/queries";
import { uploadMedia } from "@/lib/storage";
import { TierBadge } from "./ui";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

// Preset Cyber Emblems available to CCC members
interface EmblemDef {
  id: string;
  label: string;
  icon: string;
  bg: string;
  border: string;
  text: string;
}

const PRESET_EMBLEMS: EmblemDef[] = [
  {
    id: "volt",
    label: "Volt Terminal",
    icon: "⚡",
    bg: "from-lime-500/20 to-lime-900/40",
    border: "border-lime-500/60",
    text: "text-lime-400",
  },
  {
    id: "binary",
    label: "Binary Spectre",
    icon: "👾",
    bg: "from-cyan-500/20 to-blue-900/40",
    border: "border-cyan-500/60",
    text: "text-cyan-400",
  },
  {
    id: "quantum",
    label: "Quantum Core",
    icon: "⚛️",
    bg: "from-purple-500/20 to-indigo-900/40",
    border: "border-purple-500/60",
    text: "text-purple-400",
  },
  {
    id: "matrix",
    label: "Matrix Hacker",
    icon: "💻",
    bg: "from-emerald-500/20 to-teal-900/40",
    border: "border-emerald-500/60",
    text: "text-emerald-400",
  },
  {
    id: "grandmaster",
    label: "Grandmaster",
    icon: "🏆",
    bg: "from-amber-500/20 to-orange-900/40",
    border: "border-amber-500/60",
    text: "text-amber-400",
  },
  {
    id: "cipher",
    label: "Crypto Vault",
    icon: "🛡️",
    bg: "from-rose-500/20 to-red-900/40",
    border: "border-rose-500/60",
    text: "text-rose-400",
  },
];

const DEPARTMENTS = ["CSE", "IT", "AIDS", "Cyber Security", "CSBS", "ECE", "Other"];

const BATCHES = ["2022-26", "2023-27", "2024-28", "2025-29", "Alumni / Special"];

export function EditProfileModal() {
  const dispatch = useAppDispatch();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEditProfileOpen = useAppSelector((state) => state.ui.isEditProfileOpen);
  const member = useAppSelector((state) => state.auth.member);

  // Editable Form State
  const [fullName, setFullName] = useState("");
  const [department, setDepartment] = useState("CSE");
  const [batch, setBatch] = useState("2023-27");
  const [bio, setBio] = useState("");
  const [githubUsername, setGithubUsername] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");

  // Avatar State: supports either custom MinIO image URL or preset cyber emblem
  const [avatarMode, setAvatarMode] = useState<"custom" | "emblem">("emblem");
  const [customAvatarUrl, setCustomAvatarUrl] = useState<string | null>(null);
  const [avatarEmblem, setAvatarEmblem] = useState("volt");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);

  // Sync state whenever modal opens or member profile changes
  useEffect(() => {
    if (member) {
      setFullName(member.full_name || "");
      setDepartment(member.department || "CSE");
      setBatch(member.batch || "2023-27");
      setBio(member.bio || "");
      setGithubUsername(member.github_username || "");
      setLinkedinUrl(member.linkedin_url || "");

      const url = member.avatar_url;
      if (url && (url.startsWith("http") || url.startsWith("/media/"))) {
        setAvatarMode("custom");
        setCustomAvatarUrl(url);
      } else if (url && PRESET_EMBLEMS.some((e) => e.id === url)) {
        setAvatarMode("emblem");
        setAvatarEmblem(url);
      } else {
        setAvatarMode("emblem");
        setAvatarEmblem("volt");
      }
    }
  }, [member, isEditProfileOpen]);

  // Keyboard shortcut: ESC to close
  useEffect(() => {
    if (!isEditProfileOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        dispatch(closeEditProfileModal());
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dispatch, isEditProfileOpen]);

  if (!isEditProfileOpen) return null;

  // Handle direct file upload to MinIO S3 bucket
  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input value so re-selecting same file triggers change
    e.target.value = "";

    // Client validation
    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file (PNG, JPG, WebP, GIF).");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File exceeds 10MB limit. Please upload a smaller image.");
      return;
    }

    setUploadingAvatar(true);
    const toastId = toast.loading("Uploading avatar to MinIO storage...");

    try {
      const res = await uploadMedia(file, "avatars");
      setCustomAvatarUrl(res.public_url);
      setAvatarMode("custom");
      toast.success("Profile photo uploaded to MinIO!", { id: toastId });
    } catch (err: any) {
      toast.error(err.message || "Failed to upload image. Try again.", { id: toastId });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || fullName.trim().length < 2) {
      toast.error("Full name must be at least 2 characters.");
      return;
    }

    const finalAvatarUrl =
      avatarMode === "custom" && customAvatarUrl ? customAvatarUrl : avatarEmblem;

    setSaving(true);
    try {
      await dispatch(
        updateProfileThunk({
          full_name: fullName.trim(),
          department,
          batch,
          bio: bio.trim(),
          github_username: githubUsername.trim().replace(/^@/, ""),
          linkedin_url: linkedinUrl.trim(),
          avatar_url: finalAvatarUrl,
        }),
      ).unwrap();

      // Invalidate memoized caches
      invalidateFullProfileCache();

      toast.success("Competitive profile updated successfully!");
      dispatch(closeEditProfileModal());
    } catch (err: any) {
      toast.error(err || "Failed to update profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const selectedEmblem: EmblemDef =
    PRESET_EMBLEMS.find((e) => e.id === avatarEmblem) || PRESET_EMBLEMS[0]!;

  return (
    <Dialog
      open={isEditProfileOpen}
      onOpenChange={(open) => {
        if (!open) dispatch(closeEditProfileModal());
      }}
    >
      <DialogContent className="max-w-3xl rounded-2xl bg-zinc-950 border border-white/10 text-white p-0 gap-0 overflow-hidden max-h-[90vh] shadow-2xl">
        {/* Modal Header */}
        <DialogHeader className="p-4 border-b border-white/10 bg-zinc-900/80 backdrop-blur-md flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <User size={16} className="text-orange-400" />
            <DialogTitle className="font-mono text-sm font-bold uppercase tracking-wider text-white">
              Edit Competitive Profile
            </DialogTitle>
            <span className="rounded-md border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-widest text-orange-400 inline-flex items-center gap-1">
              <Sparkles size={10} />
              INTERLEET V4
            </span>
          </div>
        </DialogHeader>

        {/* Modal Body: 2 Columns (Form on left, Real-Time Preview on right) */}
        <div className="p-5 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column: Form Fields */}
          <form id="edit-profile-form" onSubmit={handleSave} className="space-y-4">
            {/* Avatar & Photo Identity Section with MinIO Upload */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold">
                  Profile Avatar & Emblem
                </label>
                <div className="flex items-center gap-1 border border-white/10 rounded-xl p-0.5 bg-zinc-900">
                  <button
                    type="button"
                    onClick={() => setAvatarMode("custom")}
                    className={cn(
                      "px-2.5 py-1 text-[9px] font-mono uppercase font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1",
                      avatarMode === "custom"
                        ? "bg-orange-500 text-black shadow-sm"
                        : "text-zinc-400 hover:text-white",
                    )}
                  >
                    <Camera size={10} />
                    Custom Photo
                  </button>
                  <button
                    type="button"
                    onClick={() => setAvatarMode("emblem")}
                    className={cn(
                      "px-2.5 py-1 text-[9px] font-mono uppercase font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1",
                      avatarMode === "emblem"
                        ? "bg-orange-500 text-black shadow-sm"
                        : "text-zinc-400 hover:text-white",
                    )}
                  >
                    <Zap size={10} />
                    Emblem
                  </button>
                </div>
              </div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleAvatarFileChange}
                className="hidden"
              />

              {avatarMode === "custom" ? (
                <div className="p-3.5 border border-white/10 bg-zinc-900/60 rounded-xl flex items-center gap-3.5">
                  <div className="relative w-14 h-14 rounded-xl border border-white/10 bg-zinc-900 overflow-hidden flex-shrink-0 flex items-center justify-center group shadow-md">
                    {customAvatarUrl ? (
                      <img
                        src={customAvatarUrl}
                        alt="Avatar Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ImageIcon size={22} className="text-zinc-500" />
                    )}

                    {uploadingAvatar && (
                      <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                        <Loader2 size={16} className="text-orange-400 animate-spin" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={uploadingAvatar}
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono uppercase font-bold text-orange-400 bg-orange-500/10 border border-orange-500/40 hover:bg-orange-500 hover:text-black rounded-lg transition-all cursor-pointer disabled:opacity-50 active:scale-[0.98]"
                      >
                        {uploadingAvatar ? (
                          <>
                            <Loader2 size={10} className="animate-spin" />
                            <span>Uploading...</span>
                          </>
                        ) : (
                          <>
                            <Upload size={10} />
                            <span>{customAvatarUrl ? "Change Photo" : "Upload to MinIO"}</span>
                          </>
                        )}
                      </button>

                      {customAvatarUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            setCustomAvatarUrl(null);
                            setAvatarMode("emblem");
                          }}
                          className="p-1.5 text-zinc-400 hover:text-rose-400 border border-white/10 hover:border-rose-500/50 rounded-lg transition-colors cursor-pointer"
                          title="Remove custom photo and revert to emblem"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                    <p className="text-[9px] font-mono text-zinc-500 leading-tight">
                      Stored on dedicated MinIO object storage. Max 10MB. JPG, PNG, WebP.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-6 gap-2">
                  {PRESET_EMBLEMS.map((emblem) => (
                    <button
                      key={emblem.id}
                      type="button"
                      onClick={() => setAvatarEmblem(emblem.id)}
                      className={cn(
                        "h-11 rounded-xl border flex flex-col items-center justify-center text-sm transition-all cursor-pointer relative group",
                        avatarEmblem === emblem.id
                          ? cn(
                              "border-orange-500 shadow-md shadow-orange-500/20 bg-orange-500/10",
                              emblem.bg,
                            )
                          : "border-white/10 bg-zinc-900/60 hover:border-white/20",
                      )}
                      title={emblem.label}
                    >
                      <span className="text-base">{emblem.icon}</span>
                      {avatarEmblem === emblem.id && (
                        <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-orange-500" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Full Name */}
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1 font-bold">
                Competitive Full Name <span className="text-orange-400">*</span>
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                maxLength={60}
                required
                placeholder="e.g. Santusht Kotai"
                className="w-full px-3 py-2 text-xs font-mono bg-zinc-900/60 border border-white/10 focus:border-orange-500/60 text-white outline-none rounded-xl transition-colors"
              />
            </div>

            {/* Department & Batch */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1 font-bold">
                  Department
                </label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs font-mono bg-zinc-900/60 border border-white/10 focus:border-orange-500/60 text-white outline-none rounded-xl transition-colors cursor-pointer"
                >
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept} className="bg-zinc-900 text-white">
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1 font-bold">
                  Academic Batch
                </label>
                <select
                  value={batch}
                  onChange={(e) => setBatch(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs font-mono bg-zinc-900/60 border border-white/10 focus:border-orange-500/60 text-white outline-none rounded-xl transition-colors cursor-pointer"
                >
                  {BATCHES.map((b) => (
                    <option key={b} value={b} className="bg-zinc-900 text-white">
                      {b}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Competitive Bio */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold">
                  Developer Bio / Status Quote
                </label>
                <span className="text-[9px] font-mono text-zinc-500 tabular-nums">{bio.length}/280</span>
              </div>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={280}
                rows={3}
                placeholder="Share your algorithms trajectory, preferred languages, and competitive goals..."
                className="w-full px-3 py-2 text-xs font-mono bg-zinc-900/60 border border-white/10 focus:border-orange-500/60 text-white outline-none rounded-xl transition-colors resize-none leading-relaxed"
              />
            </div>

            {/* Social Handles */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1 font-bold flex items-center gap-1">
                  <Github size={11} />
                  <span>GitHub Username</span>
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-500 font-mono">
                    @
                  </span>
                  <input
                    type="text"
                    value={githubUsername}
                    onChange={(e) => setGithubUsername(e.target.value)}
                    placeholder="octocat"
                    className="w-full pl-6 pr-3 py-1.5 text-xs font-mono bg-zinc-900/60 border border-white/10 focus:border-orange-500/60 text-white outline-none rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1 font-bold flex items-center gap-1">
                  <Linkedin size={11} />
                  <span>LinkedIn Handle</span>
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-500 font-mono">
                    in/
                  </span>
                  <input
                    type="text"
                    value={linkedinUrl}
                    onChange={(e) => setLinkedinUrl(e.target.value)}
                    placeholder="username"
                    className="w-full pl-7 pr-3 py-1.5 text-xs font-mono bg-zinc-900/60 border border-white/10 focus:border-orange-500/60 text-white outline-none rounded-xl"
                  />
                </div>
              </div>
            </div>

            {/* Immutable Locked Fields Banner */}
            <div className="p-3.5 bg-zinc-900/60 border border-white/10 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-[10px] font-mono uppercase font-bold text-orange-400">
                <Lock size={12} />
                <span>Cryptographically Locked Credentials</span>
              </div>
              <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                <div className="p-2.5 bg-zinc-950/60 border border-white/10 rounded-lg">
                  <span className="text-[9px] uppercase text-zinc-500 block font-mono">
                    Institutional Email
                  </span>
                  <strong className="text-white truncate block mt-0.5">
                    {member?.email || "—"}
                  </strong>
                </div>
                <div className="p-2.5 bg-zinc-950/60 border border-white/10 rounded-lg">
                  <span className="text-[9px] uppercase text-zinc-500 block font-mono">
                    Medi-Caps PRN
                  </span>
                  <strong className="text-white truncate block mt-0.5">{member?.prn || "—"}</strong>
                </div>
              </div>
              <p className="text-[9px] text-zinc-500 font-mono leading-relaxed">
                PRN and official @medicaps.ac.in emails are cryptographically verified and cannot be
                altered. Contact chapter administrators if corrections are required.
              </p>
            </div>
          </form>

          {/* Right Column: Real-Time Live Card Preview (Exact Interleet Pattern) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                REAL-TIME CARD PREVIEW
              </span>
              <span className="text-[9px] font-mono text-orange-400 uppercase font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-ping" />
                Live Sync
              </span>
            </div>

            {/* Live Interactive Card */}
            <div className="relative rounded-2xl border border-white/10 bg-zinc-900/60 p-5 shadow-2xl overflow-hidden space-y-4 backdrop-blur-md">
              {/* Background ambient gradient */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 blur-3xl pointer-events-none" />

              {/* Card Header with MinIO Photo / Emblem & Verified Identity */}
              <div className="flex items-start gap-3.5">
                {avatarMode === "custom" && customAvatarUrl ? (
                  <div className="w-12 h-12 rounded-xl border border-white/10 bg-zinc-900 overflow-hidden flex-shrink-0 shadow-lg">
                    <img
                      src={customAvatarUrl}
                      alt={fullName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div
                    className={cn(
                      "w-12 h-12 rounded-xl border flex items-center justify-center font-mono text-base font-bold flex-shrink-0 shadow-lg",
                      selectedEmblem.bg,
                      selectedEmblem.border,
                      selectedEmblem.text,
                    )}
                  >
                    <span>{selectedEmblem.icon}</span>
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="font-bold text-sm text-white truncate tracking-tight">
                      {fullName || "New Cadet"}
                    </h3>
                    <span className="rounded-md border border-emerald-500/40 bg-emerald-950/40 px-1.5 py-0.5 text-[8px] font-mono font-bold uppercase text-emerald-400 inline-flex items-center gap-1">
                      <ShieldCheck size={10} />
                      VERIFIED
                    </span>
                  </div>

                  <p className="text-xs font-mono text-orange-400">
                    @{member?.handle || "cadet"}
                  </p>

                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[9px] font-mono uppercase bg-zinc-800/80 border border-white/10 text-zinc-400 px-1.5 py-0.5 rounded-md">
                      {department} · {batch}
                    </span>
                    <TierBadge>{member?.tier || "1★ Explorer"}</TierBadge>
                  </div>
                </div>
              </div>

              {/* Live Bio Quote */}
              <div className="p-3 bg-zinc-950/60 border border-white/10 rounded-xl">
                <p className="text-xs text-zinc-300 italic leading-relaxed line-clamp-3">
                  "
                  {bio ||
                    "No competitive bio written yet. Share your coding focus and algorithms trajectory."}
                  "
                </p>
              </div>

              {/* Live Social Badges */}
              <div className="flex items-center gap-2 flex-wrap pt-1">
                {githubUsername && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono text-white bg-zinc-950/60 border border-white/10 px-2 py-1 rounded-lg">
                    <Github size={11} />
                    <span>github.com/{githubUsername}</span>
                  </span>
                )}
                {linkedinUrl && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono text-[#38bdf8] bg-zinc-950/60 border border-white/10 px-2 py-1 rounded-lg">
                    <Linkedin size={11} />
                    <span>in/{linkedinUrl}</span>
                  </span>
                )}
                {!githubUsername && !linkedinUrl && (
                  <span className="text-[10px] font-mono text-zinc-500 italic">
                    No external social links added
                  </span>
                )}
              </div>

              {/* Performance Metrics Quick Strip */}
              <div className="grid grid-cols-3 gap-2 border-t border-white/10 pt-3 text-center">
                <div className="p-2 rounded-xl bg-zinc-950/60 border border-white/10">
                  <span className="text-[8px] uppercase font-mono text-zinc-500 block">
                    Rating
                  </span>
                  <strong className="text-xs font-mono text-orange-400 mt-0.5 block tabular-nums">
                    {member?.rating || 1200}
                  </strong>
                </div>
                <div className="p-2 rounded-xl bg-zinc-950/60 border border-white/10">
                  <span className="text-[8px] uppercase font-mono text-zinc-500 block">
                    Campus Rank
                  </span>
                  <strong className="text-xs font-mono text-white mt-0.5 block tabular-nums">
                    #{member?.university_rank || 1}
                  </strong>
                </div>
                <div className="p-2 rounded-xl bg-zinc-950/60 border border-white/10">
                  <span className="text-[8px] uppercase font-mono text-zinc-500 block">
                    Followers
                  </span>
                  <strong className="text-xs font-mono text-white mt-0.5 block tabular-nums">
                    {member?.followers_count ?? 0}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <DialogFooter className="p-4 border-t border-white/10 bg-zinc-900/80 backdrop-blur-md flex flex-row items-center justify-end gap-3 space-x-0">
          <Button
            type="button"
            variant="outline"
            disabled={saving || uploadingAvatar}
            onClick={() => dispatch(closeEditProfileModal())}
            className="px-4 py-2 font-mono text-xs uppercase font-bold text-zinc-300 border-white/10 hover:border-white/20 hover:text-white rounded-xl transition-all cursor-pointer active:scale-[0.98]"
          >
            Cancel
          </Button>

          <Button
            type="submit"
            form="edit-profile-form"
            disabled={saving || uploadingAvatar}
            className="px-5 py-2 font-mono text-xs uppercase font-bold bg-orange-500 text-black hover:bg-orange-400 rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-orange-500/20 active:scale-[0.98] disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>Saving Profile...</span>
              </>
            ) : (
              <>
                <Check size={13} />
                <span>Save Profile Changes</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
