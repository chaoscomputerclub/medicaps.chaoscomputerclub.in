/**
 * Chaos Computer Club India — Medi-Caps Chapter
 * Settings — GitHub-philosophy architecture with CCC tactical design language.
 * Left sticky nav · Section cards · Field-level save · Zero border-radius.
 */

import React, { useEffect, useLayoutEffect, useState, useRef, useCallback } from "react";
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
import { WanderingEyes } from "@/components/ui/WanderingEyes";
import { motion, AnimatePresence } from "motion/react";
import { cn, resolveAvatarUrl, formatFullName } from "@/lib/utils";
import {
  Tabs,
  TabsPanels,
  TabsPanel,
} from "@/components/animate-ui/components/base/tabs";
import { isAuthenticated, getToken, clearToken, logout } from "@/lib/auth";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  checkHandleThunk,
  deleteAccountThunk,
  fetchCurrentUserThunk,
  setHandleStatus,
  updateProfileThunk,
  uploadAvatarThunk,
  removeAvatarThunk,
  logout as logoutAction,
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
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { SettingsSkeleton } from "@/organization/components/skeletons";
import { FaLinkedinIn } from "react-icons/fa";

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
  { id: "profile", label: "Public Profile", icon: UserRound },
  { id: "account", label: "Account", icon: AtSign },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security & Session", icon: ShieldCheck },
  { id: "danger", label: "Danger Zone", icon: AlertTriangle, danger: true },
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
        "border rounded-[24px] overflow-hidden",
        danger
          ? "border-red-500/20 bg-[#1F1F1F]"
          : "border-white/[0.08] bg-[#1F1F1F]",
      )}
    >
      <div className={cn("px-6 py-4.5 border-b", danger ? "border-red-500/15" : "border-white/[0.08]")}>
        <h2
          className={cn(
            "text-base font-bold font-heading uppercase tracking-wide",
            danger ? "text-red-400" : "text-white",
          )}
        >
          {title}
        </h2>
        {description && (
          <p className="text-xs text-zinc-400 mt-1 font-sans leading-relaxed">{description}</p>
        )}
      </div>
      <div className="px-6 py-6 space-y-5">{children}</div>
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
        !borderless && "pb-5 border-b border-white/6",
      )}
    >
      <div className="sm:w-48 shrink-0 pt-0.5">
        {htmlFor ? (
          <Label htmlFor={htmlFor} className="text-xs font-medium text-zinc-200 cursor-pointer">
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

function SaveButton({
  onClick,
  disabled,
  saving,
  saved,
  label = "Save",
  savedLabel = "Saved",
  className,
}: {
  onClick: () => void;
  disabled?: boolean;
  saving?: boolean;
  saved?: boolean;
  label?: string;
  savedLabel?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled || saving}
      onClick={onClick}
      className={cn(
        "relative inline-flex items-center justify-center w-[80px] min-w-[80px] shrink-0 h-10 px-3 py-2 text-xs font-sans font-medium rounded-md transition-all duration-150 cursor-pointer select-none overflow-hidden",
        "focus:outline-none focus-visible:ring-1 focus-visible:ring-lime-400 focus-visible:border-lime-400",
        "disabled:cursor-not-allowed disabled:opacity-40 disabled:pointer-events-none disabled:border-white/8 disabled:bg-transparent",
        saved
          ? "border border-lime-400/40 bg-lime-400/10 text-lime-400"
          : saving
          ? "border border-white/15 bg-[#171717] text-zinc-300"
          : "border border-white/12 bg-[#171717] hover:bg-[#222222] text-zinc-300 hover:text-white hover:border-white/20 active:bg-[#282828]",
        className,
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        {saved ? (
          <motion.span
            key="saved"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 500, damping: 25 }}
            className="flex items-center justify-center gap-1.5 font-medium text-lime-400"
          >
            <Check size={13} className="stroke-[2.5]" />
            <span>{savedLabel}</span>
          </motion.span>
        ) : saving ? (
          <motion.span
            key="saving"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 500, damping: 25 }}
            className="flex items-center justify-center text-zinc-200"
          >
            <WanderingEyes size="sm" />
          </motion.span>
        ) : (
          <motion.span
            key="idle"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 500, damping: 25 }}
            className="flex items-center justify-center font-medium"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
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
  const activeTab: SettingsTab = raw && NAV_ITEMS.some((n) => n.id === raw) ? raw : "profile";
  const setActiveTab = (t: SettingsTab) => setSearchParams({ tab: t });

  const tabListRef = useRef<HTMLDivElement | null>(null);
  const tabItemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [indicatorStyle, setIndicatorStyle] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
    opacity: number;
    ready: boolean;
  }>({ top: 0, left: 0, width: 0, height: 38, opacity: 0, ready: false });

  useLayoutEffect(() => {
    const activeEl = tabItemRefs.current[activeTab];
    if (activeEl) {
      setIndicatorStyle({
        top: activeEl.offsetTop,
        left: activeEl.offsetLeft,
        width: activeEl.offsetWidth,
        height: activeEl.offsetHeight || 38,
        opacity: 1,
        ready: true,
      });
    } else {
      setIndicatorStyle((prev) => ({ ...prev, opacity: 0 }));
    }
  }, [activeTab]);

  useEffect(() => {
    const handleResize = () => {
      const activeEl = tabItemRefs.current[activeTab];
      if (activeEl) {
        setIndicatorStyle({
          top: activeEl.offsetTop,
          left: activeEl.offsetLeft,
          width: activeEl.offsetWidth,
          height: activeEl.offsetHeight || 38,
          opacity: 1,
          ready: true,
        });
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [activeTab]);

  const handleLogout = () => {
    dispatch(logoutAction());
    clearToken();
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("ccc_auth_token");
        localStorage.removeItem("ccc_member_profile");
        sessionStorage.clear();
      } catch {}
      window.location.replace("/auth");
    }
  };

  // ── Form state ──
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [department, setDepartment] = useState("");
  const [batch, setBatch] = useState("");
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
  const [fieldStatus, setFieldStatusState] = useState<
    Record<string, "idle" | "saving" | "saved" | "error">
  >({});
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
    setDepartment(member.department || "");
    setBatch(member.batch || "");
    setGithub(member.github_username || "");
    setLinkedin(member.linkedin_url || "");
    const url = member.avatar_url || "";
    setAvatarUrl(
      url.startsWith("http") || url.startsWith("/media/") || url.startsWith("/") ? url : "",
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
    const clean = handleInput
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "");
    if (!member || clean === member.handle?.toLowerCase() || clean.length < 3) {
      dispatch(setHandleStatus("idle"));
      return;
    }
    dispatch(setHandleStatus("checking"));
    const t = setTimeout(() => dispatch(checkHandleThunk(clean)), 450);
    return () => clearTimeout(t);
  }, [handleInput, member, dispatch]);

  // ── Field save helpers ──
  const markField = useCallback((key: string, status: "saving" | "saved" | "error") => {
    setFieldStatusState((p) => ({ ...p, [key]: status }));
    if (status === "saved") {
      setTimeout(() => setFieldStatusState((p) => ({ ...p, [key]: "idle" })), 2500);
    }
  }, []);

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
    [member, dispatch, markField],
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
      const tid = toast.loading("Uploading profile photo…");
      try {
        const res = await dispatch(uploadAvatarThunk(file)).unwrap();
        setAvatarUrl(res.avatar_url);
        dispatch(fetchCurrentUserThunk());
        invalidateFullProfileCache();
        toast.success("Profile photo updated successfully!", { id: tid });
      } catch (err: any) {
        toast.error(typeof err === "string" ? err : err?.message || "Upload failed.", { id: tid });
      } finally {
        setIsUploadingAvatar(false);
      }
    },
    [dispatch],
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
    const clean = handleInput
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "");
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
        id: member.id,
        handle: member.handle,
        full_name: member.full_name,
        email: member.email,
        prn: member.prn,
        department: member.department,
        batch: member.batch,
        rating: member.rating,
        tier: member.tier,
        bio: member.bio,
        github_username: member.github_username,
        linkedin_url: member.linkedin_url,
      },
    };
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
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
    member && handleInput.trim().toLowerCase() !== member.handle?.toLowerCase(),
  );

  if (!member) return <SettingsSkeleton />;

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      {/* Page Title Header */}
      <div className="flex items-center justify-between mb-8 pb-5 border-b border-white/[0.08]">
        <div>
          <h1 className="text-3xl sm:text-4xl font-normal font-display tracking-wider text-white uppercase">Settings</h1>
          <p className="text-xs text-zinc-400 mt-1 font-sans">
            Manage your competitive identity, security, and account preferences.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="hidden sm:flex rounded-[10px]">
          <Link to="/profile">
            View profile
            <ExternalLink size={12} className="opacity-70 ml-1.5" />
          </Link>
        </Button>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as SettingsTab)}
        className="flex flex-col md:flex-row gap-6 items-start"
      >
        {/* ── Left sidebar nav with Sidebar Navigation Slider ───────────────────────── */}
        <div
          ref={tabListRef}
          role="tablist"
          aria-label="Settings navigation"
          className="relative flex flex-row md:flex-col w-full md:w-56 md:min-w-56 shrink-0 sticky top-16 md:top-8 self-start z-20 gap-1 p-2 rounded-[16px] border border-white/[0.08] bg-[#1F1F1F] overflow-x-auto md:overflow-visible items-stretch no-scrollbar"
        >
          {/* Animated Active Sliding Indicator Pill */}
          <div
            aria-hidden="true"
            className={`absolute top-0 left-0 pointer-events-none rounded-md bg-white/[0.06] border border-white/10 ${
              indicatorStyle.ready
                ? "transition-[transform,width,height,opacity] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]"
                : "transition-none"
            }`}
            style={{
              transform: `translate3d(${indicatorStyle.left}px, ${indicatorStyle.top}px, 0)`,
              width: indicatorStyle.width ? `${indicatorStyle.width}px` : "auto",
              height: indicatorStyle.height ? `${indicatorStyle.height}px` : "38px",
              opacity: indicatorStyle.opacity,
            }}
          >
            {/* Subtle left accent marker in Electric Lime (or Red for Danger Zone) */}
            <span
              className={cn(
                "absolute rounded-full transition-colors duration-150",
                activeTab === "danger"
                  ? "bg-red-500"
                  : "bg-[#B1FA63]",
                // Left marker on desktop (vertical), bottom marker on mobile (horizontal)
                "max-md:bottom-0 max-md:left-2 max-md:right-2 max-md:h-[2.5px] max-md:w-auto max-md:rounded-t-full",
                "md:left-0 md:top-1.5 md:bottom-1.5 md:w-[2.5px] md:h-auto md:rounded-r-full"
              )}
            />
          </div>

          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                ref={(el) => {
                  tabItemRefs.current[item.id] = el;
                }}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "relative z-10 flex items-center gap-2.5 px-3 py-2.5 rounded-md text-xs font-heading font-medium select-none group min-h-[38px] transition-colors duration-150 cursor-pointer w-auto md:w-full justify-start shrink-0",
                  active
                    ? item.danger
                      ? "text-red-400 font-semibold"
                      : "text-white font-semibold"
                    : item.danger
                    ? "text-red-400/70 hover:text-red-300 hover:bg-white/[0.02]"
                    : "text-zinc-400 hover:text-white hover:bg-white/[0.02]"
                )}
              >
                <Icon
                  size={16}
                  className={cn(
                    "shrink-0 transition-colors duration-150",
                    active
                      ? item.danger
                        ? "text-red-400"
                        : "text-[#B1FA63]"
                      : item.danger
                      ? "text-red-400/70 group-hover:text-red-300"
                      : "text-zinc-400 group-hover:text-zinc-200"
                  )}
                />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* ── Right content panels ──────────────────────────────────────────── */}
        <TabsPanels className="flex-1 min-w-0 space-y-4">
          {/* ═══════════════════ TAB: PUBLIC PROFILE ═══════════════════════ */}
          <TabsPanel value="profile" className="space-y-4">
            <>
              {/* Avatar */}
              <SettingSection
                title="Profile Photo"
                description="Your avatar appears on the public leaderboard, contest scoreboards, and peer dossiers."
              >
                <div className="flex flex-col sm:flex-row items-start gap-6">
                  {/* Avatar preview */}
                  <Avatar className="size-20 rounded-lg border border-white/10 bg-black shrink-0">
                    {avatarUrl ? (
                      <AvatarImage
                        src={resolveAvatarUrl(avatarUrl)}
                        alt={fullName}
                        className="object-cover rounded-lg"
                      />
                    ) : null}
                    <AvatarFallback className="rounded-lg bg-lime-400/10 text-lime-400 font-sans font-semibold text-xl">
                      {initials}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0 space-y-3">
                    {/* Drop zone */}
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragging(true);
                      }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={handleDrop}
                      onClick={() => !isUploadingAvatar && fileInputRef.current?.click()}
                      className={cn(
                        "rounded-lg border border-dashed px-5 py-6 text-center cursor-pointer transition-colors bg-[#171717]",
                        isDragging
                          ? "border-lime-400 bg-lime-400/5"
                          : "border-white/10 hover:border-white/25 hover:bg-white/[0.02]",
                      )}
                    >
                      {isUploadingAvatar ? (
                        <div className="flex items-center justify-center gap-2 text-zinc-400 text-xs font-sans">
                          <WanderingEyes size="sm" className="h-4 text-lime-400" />
                          <span>Uploading…</span>
                        </div>
                      ) : (
                        <>
                          <Upload size={16} className="mx-auto text-zinc-500 mb-2" />
                          <p className="text-xs text-zinc-400 font-sans">
                            <span className="text-lime-400 font-semibold">Click to upload</span> or
                            drag &amp; drop
                          </p>
                          <p className="text-[11px] text-zinc-600 mt-0.5 font-sans">
                            PNG, JPG, WebP, GIF (max 10 MB)
                          </p>
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
                        className="text-[11px] font-sans text-red-400 hover:text-red-300 cursor-pointer underline underline-offset-2 transition-colors"
                      >
                        Remove photo
                      </button>
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
                  <div className="flex gap-2 items-center">
                    <div className="relative flex-1 min-w-0">
                      <Input
                        id="s-fullname"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === "Enter" && saveField("full_name", { full_name: fullName.trim() })
                        }
                        placeholder="Full Name"
                        className="h-10 text-base md:text-xs font-sans bg-[#171717] border-white/12 text-white rounded-md focus-visible:border-lime-400 focus-visible:ring-1 focus-visible:ring-lime-400/40 w-full"
                      />
                    </div>
                    <SaveButton
                      onClick={() => saveField("full_name", { full_name: fullName.trim() })}
                      disabled={fullName.trim() === (member?.full_name || "")}
                      saving={fieldStatus["full_name"] === "saving"}
                      saved={fieldStatus["full_name"] === "saved"}
                    />
                  </div>
                </SettingRow>

                <SettingRow
                  label="Bio / Focus"
                  htmlFor="s-bio"
                  hint="Up to 500 characters. Share your competitive focus and learning trajectory."
                >
                  <div className="flex gap-2 items-start">
                    <div className="relative flex-1 min-w-0">
                      <Textarea
                        id="s-bio"
                        value={bio}
                        maxLength={500}
                        onChange={(e) => setBio(e.target.value)}
                        rows={3}
                        placeholder="Competitive programmer, building expertise in algorithms…"
                        className="text-base md:text-xs font-sans resize-none bg-[#171717] border-white/12 text-white rounded-md focus-visible:border-lime-400 focus-visible:ring-1 focus-visible:ring-lime-400/40 w-full"
                      />
                      <div className="mt-1 font-sans">
                        <span className="text-[11px] text-zinc-500 tabular-nums">
                          {bio.length}/500
                        </span>
                      </div>
                    </div>
                    <SaveButton
                      onClick={() => saveField("bio", { bio: bio.trim() })}
                      disabled={bio.trim() === (member?.bio || "")}
                      saving={fieldStatus["bio"] === "saving"}
                      saved={fieldStatus["bio"] === "saved"}
                    />
                  </div>
                </SettingRow>

                <SettingRow label="Department" htmlFor="s-dept">
                  <div className="flex items-center gap-2">
                    <Select
                      value={department || "unspecified"}
                      onValueChange={(v) => {
                        const finalVal = v === "unspecified" ? "" : v;
                        setDepartment(finalVal);
                        saveField("department", { department: finalVal });
                      }}
                    >
                      <SelectTrigger id="s-dept" className="min-w-[200px]">
                        <SelectValue placeholder="Select Department…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unspecified" className="text-zinc-500 italic">
                          Not Specified
                        </SelectItem>
                        {DEPARTMENTS.map((d) => (
                          <SelectItem key={d.value} value={d.value}>
                            {d.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </SettingRow>

                <SettingRow label="Graduation Batch" htmlFor="s-batch" borderless>
                  <div className="flex items-center gap-2">
                    <Select
                      value={batch || "unspecified"}
                      onValueChange={(v) => {
                        const finalVal = v === "unspecified" ? "" : v;
                        setBatch(finalVal);
                        saveField("batch", { batch: finalVal });
                      }}
                    >
                      <SelectTrigger id="s-batch" className="min-w-[200px]">
                        <SelectValue placeholder="Select Graduation Batch…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unspecified" className="text-zinc-500 italic">
                          Not Specified
                        </SelectItem>
                        {BATCHES.map((b) => (
                          <SelectItem key={b} value={b}>
                            {b}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </SettingRow>
              </SettingSection>

              {/* Social links */}
              <SettingSection
                title="Developer Links"
                description="Connect your public developer profiles to display on your cadet dossier."
              >
                <SettingRow
                  label="GitHub"
                  htmlFor="s-github"
                  hint="Your GitHub username (without @)."
                >
                  <div className="flex gap-2 items-center">
                    <div className="relative flex-1 min-w-0">
                      <Github
                        size={13}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
                      />
                      <Input
                        id="s-github"
                        value={github}
                        onChange={(e) => setGithub(e.target.value.replace(/^@/, ""))}
                        onKeyDown={(e) =>
                          e.key === "Enter" &&
                          saveField("github", { github_username: github.trim() })
                        }
                        placeholder="octocat"
                        className="h-10 pl-8 text-base md:text-xs font-sans bg-[#171717] border-white/12 text-white rounded-md focus-visible:border-lime-400 focus-visible:ring-1 focus-visible:ring-lime-400/40 w-full"
                      />
                    </div>
                    <SaveButton
                      onClick={() => saveField("github", { github_username: github.trim() })}
                      disabled={github.trim() === (member?.github_username || "")}
                      saving={fieldStatus["github"] === "saving"}
                      saved={fieldStatus["github"] === "saved"}
                    />
                  </div>
                  {github && (
                    <a
                      href={`https://github.com/${github}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-1.5 text-[11px] font-sans text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      <ExternalLink size={10} />
                      github.com/{github}
                    </a>
                  )}
                </SettingRow>

                <SettingRow
                  label="LinkedIn"
                  htmlFor="s-linkedin"
                  hint="Full profile URL or handle."
                  borderless
                >
                  <div className="flex gap-2 items-center">
                    <div className="relative flex-1 min-w-0">
                      <FaLinkedinIn
                        size={13}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
                      />
                      <Input
                        id="s-linkedin"
                        value={linkedin}
                        onChange={(e) => setLinkedin(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === "Enter" &&
                          saveField("linkedin", { linkedin_url: linkedin.trim() })
                        }
                        placeholder="https://linkedin.com/in/username"
                        className="h-10 pl-8 text-base md:text-xs font-sans bg-[#171717] border-white/12 text-white rounded-md focus-visible:border-lime-400 focus-visible:ring-1 focus-visible:ring-lime-400/40 w-full"
                      />
                    </div>
                    <SaveButton
                      onClick={() => saveField("linkedin", { linkedin_url: linkedin.trim() })}
                      disabled={linkedin.trim() === (member?.linkedin_url || "")}
                      saving={fieldStatus["linkedin"] === "saving"}
                      saved={fieldStatus["linkedin"] === "saved"}
                    />
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
                    <div className="h-9 px-3 flex items-center bg-[#171717] border border-white/8 rounded-md text-zinc-400 font-sans text-xs select-all">
                      {member.prn && member.prn !== "N/A" && member.prn !== "—"
                        ? member.prn
                        : member.email?.includes("@")
                          ? member.email.split("@")[0]?.toUpperCase() || "—"
                          : member.handle?.toUpperCase() || "—"}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Lock size={11} /> Institutional Email
                    </Label>
                    <div className="h-9 px-3 flex items-center bg-[#171717] border border-white/8 rounded-md text-zinc-400 font-sans text-xs truncate select-all">
                      {member.email}
                    </div>
                  </div>
                </div>
              </SettingSection>
            </>
          </TabsPanel>

          {/* ═══════════════════ TAB: ACCOUNT ══════════════════════════════ */}
          <TabsPanel value="account" className="space-y-4">
            <>
              <SettingSection
                title="Username / Handle"
                description="Your unique @handle used across leaderboards, contest submissions, and peer mentions."
              >
                <SettingRow
                  label="Handle alias"
                  htmlFor="acc-handle"
                  hint="Lowercase letters, numbers, and underscores only. Min 3 characters."
                  borderless
                >
                  <div className="space-y-2">
                    <div className="flex gap-2 items-center">
                      <div className="relative flex-1 min-w-0">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 font-sans text-xs">
                          @
                        </span>
                        <Input
                          id="acc-handle"
                          value={handleInput}
                          onChange={(e) =>
                            setHandleInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
                          }
                          className={cn(
                            "h-10 pl-7 text-base md:text-xs font-sans bg-[#171717] border-white/12 text-white rounded-md focus-visible:ring-0 w-full",
                            isHandleChanged &&
                              handleStatus === "available" &&
                              "border-emerald-500/60 focus-visible:border-emerald-500",
                            isHandleChanged &&
                              handleStatus === "taken" &&
                              "border-red-500/60 focus-visible:border-red-500",
                            (!isHandleChanged || handleStatus === "idle") &&
                              "focus-visible:border-lime-400",
                          )}
                          placeholder="handle"
                        />
                      </div>
                      <SaveButton
                        label="Update"
                        savedLabel="Updated"
                        onClick={saveHandle}
                        disabled={
                          !isHandleChanged ||
                          handleInput.length < 3 ||
                          handleStatus !== "available" ||
                          fieldStatus["handle"] === "saving"
                        }
                        saving={fieldStatus["handle"] === "saving"}
                        saved={fieldStatus["handle"] === "saved"}
                      />
                    </div>
                    <div className="h-4 flex items-center">
                      {!isHandleChanged && (
                        <span className="text-[11px] text-zinc-600">
                          Current handle:{" "}
                          <strong className="text-zinc-400 font-sans">@{member.handle}</strong>
                        </span>
                      )}
                      {isHandleChanged && handleStatus === "checking" && (
                        <span className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                          <WanderingEyes size="inline" className="h-2.5 text-zinc-400" /> Checking
                          availability…
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
                    <div className="size-9 bg-[#171717] border border-white/10 rounded-md flex items-center justify-center shrink-0">
                      <span className="font-bold text-sm text-white">G</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">Google Workspace SSO</p>
                      <p className="text-[11px] text-zinc-500 font-sans mt-0.5">{member.email}</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-emerald-500/40 bg-emerald-950/20 text-[11px] font-sans font-bold uppercase tracking-wider text-emerald-400 rounded">
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
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      Includes all contest entries, rating data, and cadet identity records.
                    </p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={handleExport}>
                    <Download size={13} />
                    Export
                  </Button>
                </div>
              </SettingSection>
            </>
          </TabsPanel>

          {/* ═══════════════════ TAB: NOTIFICATIONS ═════════════════════════ */}
          <TabsPanel value="notifications" className="space-y-4">
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
                    i < arr.length - 1 && "border-b border-white/8",
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
          </TabsPanel>

          {/* ═══════════════════ TAB: SECURITY & SESSION ════════════════════ */}
          <TabsPanel value="security" className="space-y-4">
            <>
              <SettingSection
                title="Active Session"
                description="Current terminal device authorization and cryptographic token parameters."
              >
                <div className="flex items-start justify-between gap-4 p-4 bg-[#171717] border border-white/8 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Monitor size={18} className="text-lime-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-white">
                        {typeof window !== "undefined"
                          ? window.navigator.platform || "Workstation"
                          : "Workstation"}
                      </p>
                      <p className="text-[11px] text-zinc-500 mt-0.5">
                        Stateless HMAC-SHA256 JWT · Session storage
                      </p>
                      <span className="inline-flex items-center gap-1.5 mt-2 text-[11px] font-sans text-emerald-400">
                        <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Active now
                      </span>
                    </div>
                  </div>
                  <Button type="button" variant="destructive" size="sm" onClick={handleLogout}>
                    <LogOut size={12} />
                    Sign out
                  </Button>
                </div>
              </SettingSection>
            </>
          </TabsPanel>

          {/* ═══════════════════ TAB: DANGER ZONE ══════════════════════════ */}
          <TabsPanel value="danger" className="space-y-4">
            <SettingSection
              title="Danger Zone"
              description="Irreversible actions that permanently affect your account."
              danger
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border border-red-500/30 bg-red-950/20 rounded-lg">
                <div>
                  <p className="text-sm font-semibold text-red-200">Delete this account</p>
                  <p className="text-[11px] text-red-300/70 mt-0.5 leading-relaxed">
                    Permanently erases your rating record, contest history, and leaderboard
                    standings. This cannot be undone.
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="shrink-0">
                      <Trash2 size={13} className="mr-1.5" />
                      Delete account
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-[#1F1F1F] border border-red-500/40 rounded-lg text-white sm:max-w-md p-6">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-red-400 flex items-center gap-2 text-base">
                        <ShieldAlert size={18} />
                        Confirm account deletion
                      </AlertDialogTitle>
                      <AlertDialogDescription className="text-zinc-400 text-xs leading-relaxed space-y-2">
                        <p>
                          This will permanently delete{" "}
                          <strong className="text-white">@{member.handle}</strong> and all
                          associated records including contest history, rating certificates, and
                          standings.
                        </p>
                        <p>
                          Type{" "}
                          <code className="font-sans text-lime-400 bg-white/5 px-1.5 py-0.5 border border-white/10 rounded">
                            {member.handle}
                          </code>{" "}
                          to confirm:
                        </p>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="my-1">
                      <Input
                        value={deleteConfirmText}
                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                        placeholder={member.handle || "handle"}
                        className="font-sans text-sm bg-[#171717] border-red-500/40 text-white rounded-md focus-visible:ring-0 focus-visible:border-red-400"
                      />
                    </div>
                    <AlertDialogFooter className="mt-4 flex justify-end gap-2">
                      <AlertDialogCancel
                        onClick={() => setDeleteConfirmText("")}
                        className="text-xs rounded-md border border-white/15 bg-transparent hover:bg-white/5 text-zinc-300 px-4 py-2 cursor-pointer"
                      >
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        disabled={
                          deleteConfirmText.trim().toLowerCase() !==
                            member.handle?.toLowerCase() || isDeleting
                        }
                        onClick={handleDelete}
                        className="text-xs rounded-md bg-red-600 hover:bg-red-700 text-white font-semibold disabled:opacity-40 px-4 py-2 cursor-pointer"
                      >
                        {isDeleting ? (
                          <span className="inline-flex items-center gap-1.5">
                            <WanderingEyes size="sm" />
                            <span>Permanently deleting…</span>
                          </span>
                        ) : (
                          "Permanently delete"
                        )}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </SettingSection>
          </TabsPanel>
        </TabsPanels>
      </Tabs>
    </div>
  );
}
