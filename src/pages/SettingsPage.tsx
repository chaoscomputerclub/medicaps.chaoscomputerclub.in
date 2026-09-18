/**
 * Chaos Computer Club India — Medi-Caps Chapter
 * Settings — GitHub-philosophy architecture with CCC tactical design language.
 * Left sticky nav · Section cards · Field-level save · Zero border-radius.
 */

import React, { useEffect, useState, useRef, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  AtSign,
  Bell,
  Check,
  ChevronRight,
  Download,
  ExternalLink,
  Github,
  KeyRound,
  Laptop,
  Linkedin,
  Loader2,
  Lock,
  LogOut,
  Monitor,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload,
  User,
  UserRound,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { cn, resolveAvatarUrl, formatFullName } from "@/lib/utils";
import { isAuthenticated, logout } from "@/lib/auth";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  checkHandleThunk,
  deleteAccountThunk,
  fetchCurrentUserThunk,
  setHandleStatus,
  updateProfileThunk,
  uploadAvatarThunk,
  removeAvatarThunk,
} from "@/store/slices/authSlice";
import { uploadMedia } from "@/lib/storage";
import { invalidateFullProfileCache } from "@/organization/data/queries";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { SettingsSkeleton } from "@/organization/components/skeletons";

// ─── Constants ───────────────────────────────────────────────────────────────

const DEPARTMENTS = [
  { value: "CSE", label: "CSE — Computer Science & Engineering" },
  { value: "IT", label: "IT — Information Technology" },
  { value: "AIDS", label: "AIDS — AI & Data Science" },
  { value: "Cyber Security", label: "Cyber Security" },
  { value: "CSBS", label: "CSBS — Computer Science & Business Systems" },
  { value: "ECE", label: "ECE — Electronics & Communication" },
  { value: "Other", label: "Other" },
];

const BATCHES = ["2022-26", "2023-27", "2024-28", "2025-29", "Alumni / Special"];

type SettingsTab = "profile" | "account" | "notifications" | "security" | "danger";

// ─── Nav definition ───────────────────────────────────────────────────────────

const NAV_ITEMS: { id: SettingsTab; label: string; icon: React.ElementType; danger?: boolean }[] = [
  { id: "profile",       label: "Public Profile",    icon: UserRound },
  { id: "account",       label: "Account",           icon: AtSign },
  { id: "notifications", label: "Notifications",     icon: Bell },
  { id: "security",      label: "Security & Session", icon: ShieldCheck },
  { id: "danger",        label: "Danger Zone",       icon: AlertTriangle, danger: true },
];

// ─── Small shared UI pieces ───────────────────────────────────────────────────

function SettingSection({
  title,
  description,
  children,
  danger,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <section
      className={cn(
        "border rounded-none",
        danger ? "border-red-500/30 bg-red-950/10" : "border-white/10 bg-zinc-900/50"
      )}
    >
      <div
        className={cn(
          "px-6 py-5 border-b",
          danger ? "border-red-500/20" : "border-white/10"
        )}
      >
        <h2
          className={cn(
            "text-sm font-semibold",
            danger ? "text-red-300" : "text-white"
          )}
        >
          {title}
        </h2>
        {description && (
          <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{description}</p>
        )}
      </div>
      <div className="px-6 py-5 space-y-5">{children}</div>
    </section>
  );
}

function SettingRow({
  label,
  hint,
  htmlFor,
  children,
  borderless,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
  borderless?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-start gap-4",
        !borderless && "pb-5 border-b border-white/8"
      )}
    >
      <div className="sm:w-48 shrink-0 pt-0.5">
        {htmlFor ? (
          <Label
            htmlFor={htmlFor}
            className="text-xs font-medium text-zinc-200 cursor-pointer"
          >
            {label}
          </Label>
        ) : (
          <span className="text-xs font-medium text-zinc-200">{label}</span>
        )}
        {hint && <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">{hint}</p>}
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function SaveIndicator({ status }: { status: "idle" | "saving" | "saved" | "error" }) {
  if (status === "idle") return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[11px] font-mono ml-2 transition-opacity",
        status === "saving" && "text-zinc-400",
        status === "saved" && "text-emerald-400",
        status === "error" && "text-red-400"
      )}
    >
      {status === "saving" && <Loader2 size={11} className="animate-spin" />}
      {status === "saved" && <Check size={11} />}
      {status === "error" && <X size={11} />}
      {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : "Error"}
    </span>
  );
}

function SaveButton({
  onClick,
  disabled,
  saving,
}: {
  onClick: () => void;
  disabled?: boolean;
  saving?: boolean;
}) {
  return (
    <Button
      type="button"
      size="sm"
      disabled={disabled || saving}
      onClick={onClick}
      className="h-8 px-4 text-xs font-semibold bg-lime-400 text-black hover:bg-lime-300 active:bg-lime-500 disabled:opacity-40 rounded-none cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-lime-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
    >
      {saving ? <Loader2 size={12} className="animate-spin mr-1.5" /> : null}
      {saving ? "Saving…" : "Save"}
    </Button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function SettingsPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [searchParams, setSearchParams] = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const member = useAppSelector((s) => s.auth.member);
  const handleStatus = useAppSelector((s) => s.auth.handleStatus);

  // Tab
  const raw = searchParams.get("tab") as SettingsTab;
  const activeTab: SettingsTab =
    raw && NAV_ITEMS.some((n) => n.id === raw) ? raw : "profile";
  const setActiveTab = (t: SettingsTab) => setSearchParams({ tab: t });

  // ── Form state ──
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [department, setDepartment] = useState("CSE");
  const [batch, setBatch] = useState("2023-27");
  const [github, setGithub] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  // ── Account tab ──
  const [handleInput, setHandleInput] = useState("");

  // ── Notification toggles ──
  const [notifContests, setNotifContests] = useState(true);
  const [notifRatings, setNotifRatings] = useState(true);
  const [notifFollows, setNotifFollows] = useState(false);

  // ── Loading states ──
  const [fieldStatus, setFieldStatusState] = useState<Record<string, "idle" | "saving" | "saved" | "error">>({});
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Auth guard
  useEffect(() => {
    if (!isAuthenticated()) navigate("/auth", { replace: true });
  }, [navigate]);

  // Sync member → form
  useEffect(() => {
    if (!member) return;
    setFullName(member.full_name || "");
    setHandleInput(member.handle || "");
    setBio(member.bio || "");
    setDepartment(member.department || "CSE");
    setBatch(member.batch || "2023-27");
    setGithub(member.github_username || "");
    setLinkedin(member.linkedin_url || "");
    const url = member.avatar_url || "";
    setAvatarUrl(
      url.startsWith("http") || url.startsWith("/media/") || url.startsWith("/") ? url : ""
    );
  }, [member]);

  // Initials fallback
  const initials = (fullName || member?.handle || "CC")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((w: string) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // Debounced handle check
  useEffect(() => {
    const clean = handleInput.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (!member || clean === member.handle?.toLowerCase() || clean.length < 3) {
      dispatch(setHandleStatus("idle"));
      return;
    }
    dispatch(setHandleStatus("checking"));
    const t = setTimeout(() => dispatch(checkHandleThunk(clean)), 450);
    return () => clearTimeout(t);
  }, [handleInput, member, dispatch]);

  // ── Field save helpers ──
  const markField = useCallback(
    (key: string, status: "saving" | "saved" | "error") => {
      setFieldStatusState((p) => ({ ...p, [key]: status }));
      if (status === "saved") {
        setTimeout(() => setFieldStatusState((p) => ({ ...p, [key]: "idle" })), 2500);
      }
    },
    []
  );

  const saveField = useCallback(
    async (key: string, payload: Record<string, any>) => {
      if (!member) return;
      markField(key, "saving");
      try {
        await dispatch(updateProfileThunk(payload)).unwrap();
        dispatch(fetchCurrentUserThunk());
        invalidateFullProfileCache();
        markField(key, "saved");
      } catch (err: any) {
        markField(key, "error");
        toast.error(err || `Failed to update ${key}.`);
      }
    },
    [member, dispatch, markField]
  );

  // ── Avatar upload ──
  const uploadAvatar = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        toast.error("Please upload a PNG, JPG, WebP or GIF image.");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File must be under 10 MB.");
        return;
      }
      setIsUploadingAvatar(true);
      const tid = toast.loading("Uploading photo to MinIO…");
      try {
        const res = await dispatch(uploadAvatarThunk(file)).unwrap();
        setAvatarUrl(res.avatar_url);
        dispatch(fetchCurrentUserThunk());
        invalidateFullProfileCache();
        toast.success("Profile photo updated in real time via MinIO!", { id: tid });
      } catch (err: any) {
        toast.error(typeof err === "string" ? err : err?.message || "Upload failed.", { id: tid });
      } finally {
        setIsUploadingAvatar(false);
      }
    },
    [dispatch]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) uploadAvatar(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadAvatar(file);
  };

  const removeAvatar = async () => {
    const tid = toast.loading("Removing photo…");
    try {
      await dispatch(removeAvatarThunk()).unwrap();
      setAvatarUrl("");
      dispatch(fetchCurrentUserThunk());
      invalidateFullProfileCache();
      toast.info("Photo removed — initials placeholder restored.", { id: tid });
    } catch (err: any) {
      toast.error(typeof err === "string" ? err : "Failed to remove avatar.", { id: tid });
    }
  };

  // ── Handle save ──
  const saveHandle = async () => {
    const clean = handleInput.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (!clean || clean.length < 3 || clean === member?.handle || handleStatus === "taken") return;
    await saveField("handle", { handle: clean });
  };

  // ── Export ──
  const handleExport = () => {
    if (!member) return;
    const data = {
      timestamp: new Date().toISOString(),
      platform: "CCC Medi-Caps Chapter Portal",
      cadet: {
        id: member.id, handle: member.handle, full_name: member.full_name,
        email: member.email, prn: member.prn, department: member.department,
        batch: member.batch, rating: member.rating, tier: member.tier,
        bio: member.bio, github_username: member.github_username, linkedin_url: member.linkedin_url,
      },
    };
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    a.download = `ccc-${member.handle || "cadet"}-profile.json`;
    a.click();
    toast.success("Profile exported as JSON.");
  };

  // ── Delete account ──
  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await dispatch(deleteAccountThunk()).unwrap();
      toast.success("Account permanently deleted.");
      navigate("/auth", { replace: true });
    } catch (err: any) {
      setIsDeleting(false);
      toast.error(err || "Deletion failed.");
    }
  };

  const isHandleChanged = Boolean(
    member && handleInput.trim().toLowerCase() !== member.handle?.toLowerCase()
  );

  if (!member) return <SettingsSkeleton />;

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-8 pb-6 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-lime-400 font-bold">
              ⚙ Configuration
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Settings</h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            Manage your competitive identity, security, and account preferences.
          </p>
        </div>
        <Button
          asChild
          variant="outline"
          size="sm"
          className="hidden sm:flex text-xs border-white/15 bg-transparent hover:bg-zinc-900 text-zinc-300 hover:text-white rounded-none gap-1.5 cursor-pointer focus-visible:ring-2 focus-visible:ring-lime-400"
        >
          <Link to="/portal/profile">
            View profile
            <ExternalLink size={12} className="opacity-60" />
          </Link>
        </Button>
      </div>

      <div className="flex gap-8 items-start">
        {/* ── Left sidebar nav ─────────────────────────────────────────────── */}
        <nav className="hidden md:flex flex-col w-52 shrink-0 sticky top-6 gap-0.5" aria-label="Settings navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "flex items-center gap-2.5 w-full px-3 py-2 text-xs font-medium text-left rounded-none transition-colors duration-100 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400",
                  active
                    ? item.danger
                      ? "bg-red-950/40 text-red-300 border-l-2 border-red-500"
                      : "bg-lime-400/10 text-lime-400 border-l-2 border-lime-400"
                    : item.danger
                    ? "text-red-400 hover:text-red-300 hover:bg-red-950/20 border-l-2 border-transparent"
                    : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/60 border-l-2 border-transparent"
                )}
              >
                <Icon size={14} />
                <span>{item.label}</span>
                {active && <ChevronRight size={12} className="ml-auto opacity-60" />}
              </button>
            );
          })}
        </nav>

        {/* Mobile tab strip */}
        <div className="md:hidden w-full mb-4 flex gap-1 overflow-x-auto pb-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium whitespace-nowrap rounded-none border cursor-pointer transition-colors",
                  active
                    ? item.danger
                      ? "bg-red-950/40 text-red-300 border-red-500/50"
                      : "bg-lime-400/10 text-lime-400 border-lime-400/40"
                    : item.danger
                    ? "text-red-400 border-white/10 hover:bg-red-950/20"
                    : "text-zinc-400 border-white/10 hover:bg-zinc-900"
                )}
              >
                <Icon size={12} />
                {item.label}
              </button>
            );
          })}
        </div>

        {/* ── Right content panel ──────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* ═══════════════════ TAB: PUBLIC PROFILE ═══════════════════════ */}
          {activeTab === "profile" && (
            <>
              {/* Avatar */}
              <SettingSection
                title="Profile Photo"
                description="Your avatar appears on the public leaderboard, contest scoreboards, and peer dossiers."
              >
                <div className="flex flex-col sm:flex-row items-start gap-6">
                  {/* Avatar preview */}
                  <Avatar className="size-20 rounded-none border-2 border-white/15 bg-zinc-900 shrink-0">
                    {avatarUrl ? (
                      <AvatarImage src={resolveAvatarUrl(avatarUrl)} alt={fullName} className="object-cover" />
                    ) : null}
                    <AvatarFallback className="rounded-none bg-lime-400/10 text-lime-400 font-mono font-bold text-2xl">
                      {initials}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0 space-y-3">
                    {/* Drop zone */}
                    <div
                      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={handleDrop}
                      onClick={() => !isUploadingAvatar && fileInputRef.current?.click()}
                      className={cn(
                        "border-2 border-dashed px-5 py-6 text-center cursor-pointer transition-colors",
                        isDragging
                          ? "border-lime-400 bg-lime-400/5"
                          : "border-white/15 hover:border-white/30 hover:bg-zinc-900/40"
                      )}
                    >
                      {isUploadingAvatar ? (
                        <div className="flex items-center justify-center gap-2 text-zinc-400 text-xs">
                          <Loader2 size={14} className="animate-spin text-lime-400" />
                          <span>Uploading to MinIO…</span>
                        </div>
                      ) : (
                        <>
                          <Upload size={18} className="mx-auto text-zinc-500 mb-2" />
                          <p className="text-xs text-zinc-400">
                            <span className="text-lime-400 font-medium">Click to upload</span> or drag &amp; drop
                          </p>
                          <p className="text-[11px] text-zinc-600 mt-1">PNG, JPG, WebP, GIF — max 10 MB</p>
                        </>
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="hidden"
                      onChange={handleFileChange}
                    />

                    {avatarUrl && (
                      <button
                        type="button"
                        onClick={removeAvatar}
                        className="text-[11px] text-red-400 hover:text-red-300 cursor-pointer underline underline-offset-2 transition-colors"
                      >
                        Remove photo — revert to initials placeholder
                      </button>
                    )}

                    {!avatarUrl && (
                      <p className="text-[11px] text-zinc-500">
                        Currently showing initials placeholder:{" "}
                        <strong className="text-lime-400 font-mono">{initials}</strong>
                      </p>
                    )}
                  </div>
                </div>
              </SettingSection>

              {/* Identity */}
              <SettingSection
                title="Competitive Identity"
                description="Your public name, bio, and institutional details visible across the portal."
              >
                <SettingRow
                  label="Full Name"
                  htmlFor="s-fullname"
                  hint="Your actual human name (e.g. Rahul Sharma). Medi-Caps Google accounts default to your enrollment number, so enter your real name here."
                >
                  <div className="flex gap-2">
                    <Input
                      id="s-fullname"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveField("full_name", { full_name: fullName.trim() })}
                      placeholder="Ada Lovelace"
                      className="h-9 text-sm bg-zinc-950 border-white/15 text-white rounded-none focus-visible:border-lime-400 focus-visible:ring-0"
                    />
                    <SaveButton
                      onClick={() => saveField("full_name", { full_name: fullName.trim() })}
                      disabled={fullName.trim() === (member?.full_name || "")}
                      saving={fieldStatus["full_name"] === "saving"}
                    />
                    <SaveIndicator status={fieldStatus["full_name"] || "idle"} />
                  </div>
                </SettingRow>

                <SettingRow label="Bio / Focus" htmlFor="s-bio" hint="Up to 500 characters. Share your competitive focus and learning trajectory.">
                  <div className="space-y-2">
                    <Textarea
                      id="s-bio"
                      value={bio}
                      maxLength={500}
                      onChange={(e) => setBio(e.target.value)}
                      rows={3}
                      placeholder="Competitive programmer, building expertise in graph algorithms and dynamic programming…"
                      className="text-sm resize-none bg-zinc-950 border-white/15 text-white rounded-none focus-visible:border-lime-400 focus-visible:ring-0"
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-zinc-600 tabular-nums">{bio.length}/500</span>
                      <div className="flex items-center gap-1">
                        <SaveButton
                          onClick={() => saveField("bio", { bio: bio.trim() })}
                          disabled={bio.trim() === (member?.bio || "")}
                          saving={fieldStatus["bio"] === "saving"}
                        />
                        <SaveIndicator status={fieldStatus["bio"] || "idle"} />
                      </div>
                    </div>
                  </div>
                </SettingRow>

                <SettingRow label="Department" htmlFor="s-dept">
                  <Select
                    value={department}
                    onValueChange={(v) => { setDepartment(v); saveField("department", { department: v }); }}
                  >
                    <SelectTrigger id="s-dept" className="h-9 text-xs bg-zinc-950 border-white/15 text-white rounded-none focus:ring-0 focus:border-lime-400">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-white/15 text-white rounded-none">
                      {DEPARTMENTS.map((d) => (
                        <SelectItem key={d.value} value={d.value} className="text-xs">{d.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </SettingRow>

                <SettingRow label="Graduation Batch" htmlFor="s-batch" borderless>
                  <Select
                    value={batch}
                    onValueChange={(v) => { setBatch(v); saveField("batch", { batch: v }); }}
                  >
                    <SelectTrigger id="s-batch" className="h-9 text-xs bg-zinc-950 border-white/15 text-white rounded-none focus:ring-0 focus:border-lime-400">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-white/15 text-white rounded-none">
                      {BATCHES.map((b) => (
                        <SelectItem key={b} value={b} className="text-xs">{b}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </SettingRow>
              </SettingSection>

              {/* Social links */}
              <SettingSection
                title="Developer Links"
                description="Connect your public developer profiles to display on your cadet dossier."
              >
                <SettingRow label="GitHub" htmlFor="s-github" hint="Your GitHub username (without @).">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Github size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                      <Input
                        id="s-github"
                        value={github}
                        onChange={(e) => setGithub(e.target.value.replace(/^@/, ""))}
                        onKeyDown={(e) => e.key === "Enter" && saveField("github", { github_username: github.trim() })}
                        placeholder="octocat"
                        className="h-9 pl-8 text-xs bg-zinc-950 border-white/15 text-white rounded-none focus-visible:border-lime-400 focus-visible:ring-0"
                      />
                    </div>
                    <SaveButton
                      onClick={() => saveField("github", { github_username: github.trim() })}
                      disabled={github.trim() === (member?.github_username || "")}
                      saving={fieldStatus["github"] === "saving"}
                    />
                    <SaveIndicator status={fieldStatus["github"] || "idle"} />
                  </div>
                  {github && (
                    <a
                      href={`https://github.com/${github}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-1.5 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      <ExternalLink size={10} />
                      github.com/{github}
                    </a>
                  )}
                </SettingRow>

                <SettingRow label="LinkedIn" htmlFor="s-linkedin" hint="Full profile URL or handle." borderless>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Linkedin size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-500" />
                      <Input
                        id="s-linkedin"
                        value={linkedin}
                        onChange={(e) => setLinkedin(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && saveField("linkedin", { linkedin_url: linkedin.trim() })}
                        placeholder="https://linkedin.com/in/username"
                        className="h-9 pl-8 text-xs bg-zinc-950 border-white/15 text-white rounded-none focus-visible:border-lime-400 focus-visible:ring-0"
                      />
                    </div>
                    <SaveButton
                      onClick={() => saveField("linkedin", { linkedin_url: linkedin.trim() })}
                      disabled={linkedin.trim() === (member?.linkedin_url || "")}
                      saving={fieldStatus["linkedin"] === "saving"}
                    />
                    <SaveIndicator status={fieldStatus["linkedin"] || "idle"} />
                  </div>
                </SettingRow>
              </SettingSection>

              {/* Locked registrations */}
              <SettingSection
                title="Institutional Registrations"
                description="Verified by Medi-Caps University. These cannot be changed."
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Lock size={11} /> Enrollment Number
                    </Label>
                    <div className="h-9 px-3 flex items-center bg-zinc-950/60 border border-white/8 text-zinc-400 font-mono text-xs select-all">
                      {member.prn && member.prn !== "N/A" && member.prn !== "—"
                        ? member.prn
                        : member.email?.includes("@")
                          ? member.email.split("@")[0].toUpperCase()
                          : member.handle?.toUpperCase() || "—"}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Lock size={11} /> Institutional Email
                    </Label>
                    <div className="h-9 px-3 flex items-center bg-zinc-950/60 border border-white/8 text-zinc-400 font-mono text-xs truncate select-all">
                      {member.email}
                    </div>
                  </div>
                </div>
              </SettingSection>
            </>
          )}

          {/* ═══════════════════ TAB: ACCOUNT ══════════════════════════════ */}
          {activeTab === "account" && (
            <>
              <SettingSection
                title="Username / Handle"
                description="Your unique @handle used across leaderboards, contest submissions, and peer mentions."
              >
                <SettingRow label="Handle alias" htmlFor="acc-handle" hint="Lowercase letters, numbers, and underscores only. Min 3 characters." borderless>
                  <div className="space-y-2 max-w-xs">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 font-mono text-xs">@</span>
                        <Input
                          id="acc-handle"
                          value={handleInput}
                          onChange={(e) => setHandleInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                          className={cn(
                            "h-9 pl-7 text-xs font-mono bg-zinc-950 border-white/15 text-white rounded-none focus-visible:ring-0",
                            isHandleChanged && handleStatus === "available" && "border-emerald-500/60 focus-visible:border-emerald-500",
                            isHandleChanged && handleStatus === "taken" && "border-red-500/60 focus-visible:border-red-500",
                            (!isHandleChanged || handleStatus === "idle") && "focus-visible:border-lime-400"
                          )}
                          placeholder="handle"
                        />
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        disabled={!isHandleChanged || handleInput.length < 3 || handleStatus !== "available" || fieldStatus["handle"] === "saving"}
                        onClick={saveHandle}
                        className="h-9 px-3 text-xs font-semibold bg-lime-400 text-black hover:bg-lime-300 disabled:opacity-40 rounded-none cursor-pointer"
                      >
                        {fieldStatus["handle"] === "saving" ? <Loader2 size={12} className="animate-spin" /> : "Update"}
                      </Button>
                    </div>
                    <div className="h-4 flex items-center">
                      {!isHandleChanged && <span className="text-[11px] text-zinc-600">Current handle: <strong className="text-zinc-400 font-mono">@{member.handle}</strong></span>}
                      {isHandleChanged && handleStatus === "checking" && (
                        <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                          <Loader2 size={10} className="animate-spin" /> Checking availability…
                        </span>
                      )}
                      {isHandleChanged && handleStatus === "available" && (
                        <span className="flex items-center gap-1 text-[11px] text-emerald-400">
                          <Check size={11} /> Available
                        </span>
                      )}
                      {isHandleChanged && handleStatus === "taken" && (
                        <span className="flex items-center gap-1 text-[11px] text-red-400">
                          <X size={11} /> Handle already taken
                        </span>
                      )}
                      {fieldStatus["handle"] === "saved" && <SaveIndicator status="saved" />}
                    </div>
                  </div>
                </SettingRow>
              </SettingSection>

              <SettingSection
                title="Connected Accounts"
                description="Authentication providers linked to your Medi-Caps institutional credential."
              >
                <div className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-3">
                    <div className="size-9 bg-zinc-950 border border-white/10 flex items-center justify-center shrink-0">
                      <span className="font-bold text-sm text-white">G</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">Google Workspace SSO</p>
                      <p className="text-[11px] text-zinc-500 font-mono mt-0.5">{member.email}</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-emerald-500/40 bg-emerald-950/20 text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-400">
                    <span className="size-1.5 rounded-full bg-emerald-400" /> Connected
                  </span>
                </div>
              </SettingSection>

              <SettingSection
                title="Data Export"
                description="Download a full snapshot of your contest history, rating trajectory, and profile records."
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-zinc-300">Export profile as JSON</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Includes all contest entries, rating data, and cadet identity records.</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleExport}
                    className="text-xs border-white/15 bg-transparent hover:bg-zinc-900 text-zinc-300 hover:text-white rounded-none gap-1.5 cursor-pointer"
                  >
                    <Download size={13} />
                    Export
                  </Button>
                </div>
              </SettingSection>
            </>
          )}

          {/* ═══════════════════ TAB: NOTIFICATIONS ═════════════════════════ */}
          {activeTab === "notifications" && (
            <SettingSection
              title="Notification Preferences"
              description="Control what CCC platform alerts are dispatched to your institutional email."
            >
              {[
                {
                  key: "contests",
                  label: "Contest Announcements",
                  desc: "Reminder alerts before scheduled proctored campus battles start.",
                  value: notifContests,
                  set: setNotifContests,
                },
                {
                  key: "ratings",
                  label: "Rating & Standings Updates",
                  desc: "Notifications when post-contest Elo shifts and tier promotions are computed.",
                  value: notifRatings,
                  set: setNotifRatings,
                },
                {
                  key: "follows",
                  label: "New Followers",
                  desc: "Alert when a peer follows your cadet dossier.",
                  value: notifFollows,
                  set: setNotifFollows,
                },
              ].map((item, i, arr) => (
                <div
                  key={item.key}
                  className={cn(
                    "flex items-start justify-between gap-4 py-3",
                    i < arr.length - 1 && "border-b border-white/8"
                  )}
                >
                  <div>
                    <p className="text-sm font-medium text-zinc-200">{item.label}</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">{item.desc}</p>
                  </div>
                  <Switch
                    checked={item.value}
                    onCheckedChange={(v) => {
                      item.set(v);
                      toast.success(`${item.label} ${v ? "enabled" : "disabled"}`);
                    }}
                    className="shrink-0 mt-0.5"
                  />
                </div>
              ))}
            </SettingSection>
          )}

          {/* ═══════════════════ TAB: SECURITY & SESSION ════════════════════ */}
          {activeTab === "security" && (
            <>
              <SettingSection
                title="Active Session"
                description="Current terminal device authorization and cryptographic token parameters."
              >
                <div className="flex items-start justify-between gap-4 p-4 bg-zinc-950 border border-white/10">
                  <div className="flex items-start gap-3">
                    <Monitor size={18} className="text-lime-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-white">
                        {typeof window !== "undefined" ? window.navigator.platform || "Workstation" : "Workstation"}
                      </p>
                      <p className="text-[11px] text-zinc-500 mt-0.5">
                        Stateless HMAC-SHA256 JWT · Session storage
                      </p>
                      <span className="inline-flex items-center gap-1.5 mt-2 text-[11px] font-mono text-emerald-400">
                        <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Active now
                      </span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => logout()}
                    className="text-xs border-white/15 bg-transparent hover:bg-zinc-900 text-zinc-300 hover:text-red-400 hover:border-red-500/40 rounded-none gap-1.5 cursor-pointer"
                  >
                    <LogOut size={12} />
                    Sign out
                  </Button>
                </div>
              </SettingSection>

              <SettingSection
                title="Cryptographic Proof Certificates"
                description="Your contest participation is anchored to HMAC-SHA256 sealed proof certificates."
              >
                <div className="p-4 bg-zinc-950 border border-white/8 flex items-start gap-3">
                  <Zap size={15} className="text-lime-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-zinc-300">Proof certificates are immutable</p>
                    <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
                      Each contest you participate in generates a cryptographic proof sealed with your Enrollment Number and timestamp.
                      These certificates are permanently anchored to your institutional identity and cannot be revoked or altered.
                    </p>
                    <Button asChild variant="outline" size="sm" className="mt-3 text-xs border-white/15 bg-transparent hover:bg-zinc-900 text-zinc-300 rounded-none gap-1.5 cursor-pointer">
                      <Link to="/portal/verify">
                        View my proof certificates
                        <ChevronRight size={12} />
                      </Link>
                    </Button>
                  </div>
                </div>
              </SettingSection>
            </>
          )}

          {/* ═══════════════════ TAB: DANGER ZONE ══════════════════════════ */}
          {activeTab === "danger" && (
            <SettingSection
              title="Danger Zone"
              description="Irreversible actions that permanently affect your account."
              danger
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border border-red-500/20 bg-red-950/10">
                <div>
                  <p className="text-sm font-semibold text-red-200">Delete this account</p>
                  <p className="text-[11px] text-red-300/70 mt-0.5 leading-relaxed">
                    Permanently erases your rating record, contest history, and leaderboard standings.
                    This cannot be undone.
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="shrink-0 text-xs font-semibold rounded-none bg-red-600 hover:bg-red-700 text-white border-none cursor-pointer"
                    >
                      <Trash2 size={13} className="mr-1.5" />
                      Delete account
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-zinc-950 border-red-500/40 rounded-none text-white">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-red-400 flex items-center gap-2 text-base">
                        <ShieldAlert size={18} />
                        Confirm account deletion
                      </AlertDialogTitle>
                      <AlertDialogDescription className="text-zinc-400 text-xs leading-relaxed space-y-2">
                        <p>
                          This will permanently delete <strong className="text-white">@{member.handle}</strong>{" "}
                          and all associated records including contest history, rating certificates, and standings.
                        </p>
                        <p>
                          Type <code className="font-mono text-lime-400 bg-zinc-900 px-1.5 py-0.5 border border-white/10">{member.handle}</code> to confirm:
                        </p>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="my-1">
                      <Input
                        value={deleteConfirmText}
                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                        placeholder={member.handle || "handle"}
                        className="font-mono text-sm bg-zinc-900 border-red-500/40 text-white rounded-none focus-visible:ring-0 focus-visible:border-red-400"
                      />
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel
                        onClick={() => setDeleteConfirmText("")}
                        className="text-xs rounded-none border-white/15 bg-transparent hover:bg-zinc-900"
                      >
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        disabled={deleteConfirmText.trim().toLowerCase() !== member.handle?.toLowerCase() || isDeleting}
                        onClick={handleDelete}
                        className="text-xs rounded-none bg-red-600 hover:bg-red-700 text-white font-semibold disabled:opacity-40"
                      >
                        {isDeleting ? <Loader2 className="animate-spin size-4" /> : "Permanently delete"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </SettingSection>
          )}
        </div>
      </div>
    </div>
  );
}
