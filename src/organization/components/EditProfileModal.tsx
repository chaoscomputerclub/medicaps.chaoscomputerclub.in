/**
 * Chaos Computer Club India — Cyber Profile Editor Modal
 * Modeled after Interleet (interleet.sharexpress.in) developer profile suite.
 * Allows editing full name, department, batch, bio, github, linkedin, and avatar emblem
 * with real-time live card preview, immutable institutional locks, and Redux Toolkit state.
 */

import { useEffect, useState, useMemo } from "react";
import {
  Award,
  Check,
  Code2,
  ExternalLink,
  Github,
  Globe,
  GraduationCap,
  Linkedin,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  User,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { closeEditProfileModal } from "@/store/slices/uiSlice";
import { updateProfileThunk } from "@/store/slices/authSlice";
import { invalidateFullProfileCache } from "@/organization/data/queries";
import { TierBadge } from "./ui";
import { cn } from "@/lib/utils";

// Preset Cyber Emblems available to CCC members
interface EmblemDef { id: string; label: string; icon: string; bg: string; border: string; text: string; }
const PRESET_EMBLEMS: EmblemDef[] = [
  { id: "volt", label: "Volt Terminal", icon: "⚡", bg: "from-lime-500/20 to-lime-900/40", border: "border-lime-500/60", text: "text-lime-400" },
  { id: "binary", label: "Binary Spectre", icon: "👾", bg: "from-cyan-500/20 to-blue-900/40", border: "border-cyan-500/60", text: "text-cyan-400" },
  { id: "quantum", label: "Quantum Core", icon: "⚛️", bg: "from-purple-500/20 to-indigo-900/40", border: "border-purple-500/60", text: "text-purple-400" },
  { id: "matrix", label: "Matrix Hacker", icon: "💻", bg: "from-emerald-500/20 to-teal-900/40", border: "border-emerald-500/60", text: "text-emerald-400" },
  { id: "grandmaster", label: "Grandmaster", icon: "🏆", bg: "from-amber-500/20 to-orange-900/40", border: "border-amber-500/60", text: "text-amber-400" },
  { id: "cipher", label: "Crypto Vault", icon: "🛡️", bg: "from-rose-500/20 to-red-900/40", border: "border-rose-500/60", text: "text-rose-400" },
];

const DEPARTMENTS = [
  "CSE",
  "IT",
  "AIDS",
  "Cyber Security",
  "CSBS",
  "ECE",
  "Other",
];

const BATCHES = [
  "2022-26",
  "2023-27",
  "2024-28",
  "2025-29",
  "Faculty / Alumni",
];

export function EditProfileModal() {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();

  const isEditProfileOpen = useAppSelector((state) => state.ui.isEditProfileOpen);
  const member = useAppSelector((state) => state.auth.member);

  // Editable Form State
  const [fullName, setFullName] = useState("");
  const [department, setDepartment] = useState("CSE");
  const [batch, setBatch] = useState("2023-27");
  const [bio, setBio] = useState("");
  const [githubUsername, setGithubUsername] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [avatarEmblem, setAvatarEmblem] = useState("volt");
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
      if (member.avatar_url && PRESET_EMBLEMS.some((e) => e.id === member.avatar_url)) {
        setAvatarEmblem(member.avatar_url);
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || fullName.trim().length < 2) {
      toast.error("Full name must be at least 2 characters.");
      return;
    }

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
          avatar_url: avatarEmblem,
        })
      ).unwrap();

      // Invalidate memoized caches
      invalidateFullProfileCache();
      queryClient.invalidateQueries({ queryKey: ["portal", "full-profile"] });
      queryClient.invalidateQueries({ queryKey: ["portal", "leaderboard"] });

      toast.success("Competitive profile updated successfully!");
      dispatch(closeEditProfileModal());
    } catch (err: any) {
      toast.error(err || "Failed to update profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const selectedEmblem: EmblemDef = PRESET_EMBLEMS.find((e) => e.id === avatarEmblem) || PRESET_EMBLEMS[0]!;

  const initials = fullName
    ? fullName
        .split(" ")
        .map((w) => w[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : member?.handle?.slice(0, 2).toUpperCase() || "CC";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Edit Profile"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
    >
      {/* Click outside to close */}
      <div
        className="fixed inset-0"
        onClick={() => !saving && dispatch(closeEditProfileModal())}
      />

      {/* Modal Dialog Window */}
      <div className="relative z-10 w-full max-w-4xl bg-[var(--surface)] border border-[var(--line)] shadow-2xl rounded-[1px] overflow-hidden flex flex-col my-8 animate-in zoom-in-95 duration-200">
        
        {/* Top Accent Stripe */}
        <div className="h-1 w-full bg-gradient-to-r from-[var(--accent)] via-emerald-400 to-[var(--accent)]" />

        {/* Modal Header */}
        <div className="p-5 border-b border-[var(--line)] bg-[var(--surface-2)]/60 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
              <p className="font-mono text-[10px] uppercase font-bold tracking-widest text-[var(--accent)]">
                MEMBER IDENTITY CONFIGURATION
              </p>
            </div>
            <h2 className="text-lg font-bold text-white uppercase tracking-tight mt-0.5">
              Edit Competitive Profile
            </h2>
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={() => dispatch(closeEditProfileModal())}
            className="p-1.5 text-[var(--muted)] hover:text-white border border-transparent hover:border-[var(--line)] rounded-[1px] hover:bg-[var(--surface-2)] transition-all cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body: 2 Columns on Desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.25fr_1fr] gap-6 p-6 max-h-[75vh] overflow-y-auto">
          
          {/* Left Column: Form Fields */}
          <form id="edit-profile-form" onSubmit={handleSave} className="space-y-5">
            
            {/* Full Name */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase text-[var(--muted)]">
                <User size={12} className="text-[var(--accent)]" />
                <span>Full Name</span>
                <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Santusht Kotai"
                required
                maxLength={100}
                className="w-full h-9 px-3 text-xs font-mono bg-[var(--surface-2)] border border-[var(--line)] rounded-[1px] text-white placeholder:text-[var(--muted)]/50 focus:outline-none focus:border-[var(--accent)] transition-colors"
              />
              <p className="text-[10px] text-[var(--muted)] font-mono">
                Official name shown on university leaderboards and verified certificates.
              </p>
            </div>

            {/* Department & Batch */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase text-[var(--muted)]">
                  <GraduationCap size={12} className="text-[var(--accent)]" />
                  <span>Department</span>
                </label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full h-9 px-3 text-xs font-mono bg-[var(--surface-2)] border border-[var(--line)] rounded-[1px] text-white focus:outline-none focus:border-[var(--accent)] transition-colors"
                >
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d} className="bg-[var(--surface)] text-white">
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase text-[var(--muted)]">
                  <Code2 size={12} className="text-[var(--accent)]" />
                  <span>Batch Cohort</span>
                </label>
                <select
                  value={batch}
                  onChange={(e) => setBatch(e.target.value)}
                  className="w-full h-9 px-3 text-xs font-mono bg-[var(--surface-2)] border border-[var(--line)] rounded-[1px] text-white focus:outline-none focus:border-[var(--accent)] transition-colors"
                >
                  {BATCHES.map((b) => (
                    <option key={b} value={b} className="bg-[var(--surface)] text-white">
                      {b}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Bio / Tagline */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase text-[var(--muted)]">
                  <Sparkles size={12} className="text-[var(--accent)]" />
                  <span>Bio / Persona Tagline</span>
                </label>
                <span className="text-[10px] font-mono text-[var(--muted)]">
                  {bio.length}/300
                </span>
              </div>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, 300))}
                placeholder="e.g. Systems engineer & algorithm competitor at Medi-Caps. Focused on memory safety and graph dynamics."
                rows={3}
                className="w-full p-2.5 text-xs font-sans bg-[var(--surface-2)] border border-[var(--line)] rounded-[1px] text-white placeholder:text-[var(--muted)]/50 focus:outline-none focus:border-[var(--accent)] transition-colors resize-none"
              />
            </div>

            {/* Social Links: GitHub & LinkedIn */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase text-[var(--muted)]">
                  <Github size={12} className="text-white" />
                  <span>GitHub Handle</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-[var(--muted)]">
                    @
                  </span>
                  <input
                    type="text"
                    value={githubUsername}
                    onChange={(e) => setGithubUsername(e.target.value)}
                    placeholder="octocat"
                    className="w-full h-9 pl-7 pr-3 text-xs font-mono bg-[var(--surface-2)] border border-[var(--line)] rounded-[1px] text-white placeholder:text-[var(--muted)]/50 focus:outline-none focus:border-[var(--accent)] transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase text-[var(--muted)]">
                  <Linkedin size={12} className="text-[#0a66c2]" />
                  <span>LinkedIn Handle</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-[var(--muted)]">
                    in/
                  </span>
                  <input
                    type="text"
                    value={linkedinUrl}
                    onChange={(e) => setLinkedinUrl(e.target.value)}
                    placeholder="username"
                    className="w-full h-9 pl-8 pr-3 text-xs font-mono bg-[var(--surface-2)] border border-[var(--line)] rounded-[1px] text-white placeholder:text-[var(--muted)]/50 focus:outline-none focus:border-[var(--accent)] transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Avatar Emblem Picker */}
            <div className="space-y-2">
              <label className="flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase text-[var(--muted)]">
                <ShieldCheck size={12} className="text-[var(--accent)]" />
                <span>Cyber Emblem</span>
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {PRESET_EMBLEMS.map((emblem) => {
                  const isSelected = avatarEmblem === emblem.id;
                  return (
                    <button
                      key={emblem.id}
                      type="button"
                      onClick={() => setAvatarEmblem(emblem.id)}
                      className={cn(
                        "p-2.5 rounded-[1px] border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer bg-[var(--surface-2)]",
                        isSelected
                          ? "border-[var(--accent)] bg-[var(--accent)]/10 shadow-[0_0_10px_rgba(200,255,54,0.15)]"
                          : "border-[var(--line)] hover:border-[var(--muted)] hover:bg-[var(--surface-3)]"
                      )}
                    >
                      <span className="text-xl">{emblem.icon}</span>
                      <span className="text-[9px] font-mono font-bold uppercase text-[var(--muted)] truncate w-full text-center">
                        {emblem.id}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Immutable Campus Identity Box (Locked) */}
            <div className="p-3.5 bg-[var(--surface-2)] border border-[var(--line)] rounded-[1px] space-y-2.5">
              <div className="flex items-center gap-2">
                <Lock size={12} className="text-amber-400" />
                <span className="font-mono text-[10px] font-bold uppercase text-amber-400 tracking-wider">
                  Verified Institutional Identity (Locked)
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-2 bg-[var(--surface)] border border-[var(--line)] rounded-[1px]">
                  <span className="text-[9px] uppercase text-[var(--muted)] block">
                    Institutional Email
                  </span>
                  <strong className="text-white truncate block mt-0.5">
                    {member?.email || "—"}
                  </strong>
                </div>
                <div className="p-2 bg-[var(--surface)] border border-[var(--line)] rounded-[1px]">
                  <span className="text-[9px] uppercase text-[var(--muted)] block">
                    Medi-Caps PRN
                  </span>
                  <strong className="text-white truncate block mt-0.5">
                    {member?.prn || "—"}
                  </strong>
                </div>
              </div>
              <p className="text-[9px] text-[var(--muted)] font-mono leading-relaxed">
                PRN and official @medicaps.ac.in emails are cryptographically verified and cannot be altered. Contact chapter administrators if corrections are required.
              </p>
            </div>
          </form>

          {/* Right Column: Real-Time Live Card Preview (Exact Interleet Pattern) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                REAL-TIME CARD PREVIEW
              </span>
              <span className="text-[9px] font-mono text-[var(--accent)] uppercase font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-ping" />
                Live Sync
              </span>
            </div>

            {/* Live Interactive Card */}
            <div className="relative rounded-[1px] border border-[var(--line)] bg-[var(--surface-2)] p-5 shadow-2xl overflow-hidden space-y-4">
              {/* Background ambient gradient */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--accent)]/5 blur-3xl pointer-events-none" />

              {/* Card Header with Emblem & Verified Identity */}
              <div className="flex items-start gap-3.5">
                <div
                  className={cn(
                    "w-12 h-12 rounded-[1px] border flex items-center justify-center font-mono text-base font-bold flex-shrink-0 shadow-lg",
                    selectedEmblem.bg,
                    selectedEmblem.border,
                    selectedEmblem.text
                  )}
                >
                  <span>{selectedEmblem.icon}</span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="font-bold text-sm text-white truncate tracking-tight">
                      {fullName || "New Cadet"}
                    </h3>
                    <span className="proof-seal text-[8px] py-0.5">
                      <ShieldCheck size={10} />
                      VERIFIED
                    </span>
                  </div>

                  <p className="text-xs font-mono text-[var(--accent)]">
                    @{member?.handle || "cadet"}
                  </p>

                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[9px] font-mono uppercase bg-[var(--surface)] border border-[var(--line)] text-[var(--muted)] px-1.5 py-0.2 rounded-[1px]">
                      {department} · {batch}
                    </span>
                    <TierBadge>{member?.tier || "1★ Explorer"}</TierBadge>
                  </div>
                </div>
              </div>

              {/* Live Bio Quote */}
              <div className="p-2.5 bg-[var(--surface)] border border-[var(--line)] rounded-[1px]">
                <p className="text-xs text-zinc-300 italic leading-relaxed line-clamp-3">
                  "{bio || "No competitive bio written yet. Share your coding focus and algorithms trajectory."}"
                </p>
              </div>

              {/* Live Social Badges */}
              <div className="flex items-center gap-2 flex-wrap pt-1">
                {githubUsername && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono text-white bg-[var(--surface)] border border-[var(--line)] px-2 py-1 rounded-[1px]">
                    <Github size={11} />
                    <span>github.com/{githubUsername}</span>
                  </span>
                )}
                {linkedinUrl && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono text-[#0a66c2] bg-[var(--surface)] border border-[var(--line)] px-2 py-1 rounded-[1px]">
                    <Linkedin size={11} />
                    <span>in/{linkedinUrl}</span>
                  </span>
                )}
                {!githubUsername && !linkedinUrl && (
                  <span className="text-[10px] font-mono text-[var(--muted)] italic">
                    No external social links added
                  </span>
                )}
              </div>

              {/* Performance Metrics Quick Strip */}
              <div className="grid grid-cols-3 gap-2 border-t border-[var(--line)] pt-3 text-center">
                <div className="p-1.5 rounded-[1px] bg-[var(--surface)] border border-[var(--line)]">
                  <span className="text-[8px] uppercase font-mono text-[var(--muted)] block">
                    Rating
                  </span>
                  <strong className="text-xs font-mono text-[var(--accent)] mt-0.5 block">
                    {member?.rating || 1200}
                  </strong>
                </div>
                <div className="p-1.5 rounded-[1px] bg-[var(--surface)] border border-[var(--line)]">
                  <span className="text-[8px] uppercase font-mono text-[var(--muted)] block">
                    Campus Rank
                  </span>
                  <strong className="text-xs font-mono text-white mt-0.5 block">
                    #{member?.university_rank || 1}
                  </strong>
                </div>
                <div className="p-1.5 rounded-[1px] bg-[var(--surface)] border border-[var(--line)]">
                  <span className="text-[8px] uppercase font-mono text-[var(--muted)] block">
                    Followers
                  </span>
                  <strong className="text-xs font-mono text-white mt-0.5 block">
                    {member?.followers_count ?? 0}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 border-t border-[var(--line)] bg-[var(--surface-2)] flex items-center justify-end gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={() => dispatch(closeEditProfileModal())}
            className="px-4 py-2 font-mono text-xs uppercase font-bold text-[var(--muted)] hover:text-white border border-[var(--line)] hover:bg-[var(--surface-3)] rounded-[1px] transition-all cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="submit"
            form="edit-profile-form"
            disabled={saving}
            className="px-5 py-2 font-mono text-xs uppercase font-bold bg-[var(--accent)] text-[var(--accent-ink)] hover:brightness-110 rounded-[1px] flex items-center gap-2 transition-all cursor-pointer shadow-[0_0_15px_rgba(200,255,54,0.2)] disabled:opacity-50"
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
          </button>
        </div>

      </div>
    </div>
  );
}
