/**
 * Chaos Computer Club India — Medi-Caps Chapter
 * Settings & Profile Architecture — GitHub-Style Personal Account Suite.
 * Replaces the legacy modal with full 2-column GitHub-modeled architecture:
 * Access (Public profile, Account), Code & Workspace, Security & Danger Zone.
 */

import { useEffect, useState, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  Building,
  Check,
  Clock,
  Code2,
  CreditCard,
  Download,
  ExternalLink,
  Github,
  Globe,
  KeyRound,
  Laptop,
  Linkedin,
  Loader2,
  Lock,
  LogOut,
  MapPin,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  Trash2,
  Upload,
  UserRound,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { isAuthenticated, logout } from "@/lib/auth";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  checkHandleThunk,
  deleteAccountThunk,
  fetchCurrentUserThunk,
  setHandleStatus,
  updateProfileThunk,
} from "@/store/slices/authSlice";
import { uploadMedia } from "@/lib/storage";
import { invalidateFullProfileCache } from "@/organization/data/queries";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SettingsSkeleton } from "@/organization/components/skeletons";

const PRESET_EMBLEMS = [
  { id: "volt", label: "Volt", icon: "⚡", bg: "bg-amber-500/10", border: "border-amber-500/40", text: "text-amber-400" },
  { id: "binary", label: "Binary", icon: "👾", bg: "bg-cyan-500/10", border: "border-cyan-500/40", text: "text-cyan-400" },
  { id: "quantum", label: "Quantum", icon: "⚛️", bg: "bg-purple-500/10", border: "border-purple-500/40", text: "text-purple-400" },
  { id: "matrix", label: "Matrix", icon: "💻", bg: "bg-emerald-500/10", border: "border-emerald-500/40", text: "text-emerald-400" },
  { id: "grandmaster", label: "Grandmaster", icon: "🏆", bg: "bg-lime-400/10", border: "border-lime-400/40", text: "text-lime-400" },
  { id: "cipher", label: "Cipher", icon: "🛡️", bg: "bg-rose-500/10", border: "border-rose-500/40", text: "text-rose-400" },
];

const LANGUAGES = [
  "No Preference",
  "C++20 (GCC 13.2)",
  "Python 3.12 (CPython)",
  "Java 21 (OpenJDK)",
  "Rust 1.78",
  "Go 1.22",
  "TypeScript / JavaScript",
  "English",
  "Hindi",
];

type SettingsTab = "profile" | "account" | "workspace" | "security" | "danger";

export function SettingsPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [searchParams, setSearchParams] = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const member = useAppSelector((state) => state.auth.member);
  const handleStatus = useAppSelector((state) => state.auth.handleStatus);

  // Tab navigation state (synced with URL ?tab=...)
  const currentTabParam = searchParams.get("tab") as SettingsTab;
  const activeTab: SettingsTab =
    currentTabParam && ["profile", "account", "workspace", "security", "danger"].includes(currentTabParam)
      ? currentTabParam
      : "profile";

  const setActiveTab = (tab: SettingsTab) => {
    setSearchParams({ tab });
  };

  // Profile Form state
  const [fullName, setFullName] = useState("");
  const [handleInput, setHandleInput] = useState("");
  const [bio, setBio] = useState("");
  const [pronouns, setPronouns] = useState("Don't specify");
  const [customPronouns, setCustomPronouns] = useState("");
  const [url, setUrl] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");
  const [displayLocalTime, setDisplayLocalTime] = useState(true);
  const [currentTimeStr, setCurrentTimeStr] = useState("");

  const [department, setDepartment] = useState("CSE");
  const [batch, setBatch] = useState("2023-27");
  const [github, setGithub] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [publicEmailOption, setPublicEmailOption] = useState<"public" | "private">("public");

  // Activity & Profile Settings toggles
  const [hideActivity, setHideActivity] = useState(false);
  const [includePrivateContributions, setIncludePrivateContributions] = useState(true);
  const [displayProBadge, setDisplayProBadge] = useState(false);
  const [showAchievements, setShowAchievements] = useState(true);
  const [availableForHire, setAvailableForHire] = useState(false);
  const [preferredLanguage, setPreferredLanguage] = useState("No Preference");

  // Code & Workspace settings
  const [defaultJudgeLang, setDefaultJudgeLang] = useState("C++20 (GCC 13.2)");
  const [editorKeybindings, setEditorKeybindings] = useState("standard");
  const [soundVerdict, setSoundVerdict] = useState(true);
  const [soundCountdown, setSoundCountdown] = useState(true);
  const [terminalTheme, setTerminalTheme] = useState("obsidian");

  // Security & Notification state
  const [notifContests, setNotifContests] = useState(true);
  const [notifRatings, setNotifRatings] = useState(true);

  // Status & loaders
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Authentication guard
  useEffect(() => {
    if (!isAuthenticated()) {
      navigate("/auth", { replace: true });
    }
  }, [navigate]);

  // Live Local Time updates
  useEffect(() => {
    const updateTime = () => {
      try {
        const now = new Date();
        const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        setCurrentTimeStr(`${time} (${tz})`);
      } catch {
        setCurrentTimeStr("18:00 (UTC+5:30)");
      }
    };
    updateTime();
    const interval = setInterval(updateTime, 20000);
    return () => clearInterval(interval);
  }, []);

  // Sync Member profile and localStorage extended prefs
  useEffect(() => {
    if (member) {
      setFullName(member.full_name || "");
      setHandleInput(member.handle || "");
      setBio(member.bio || "");
      setDepartment(member.department || "CSE");
      setBatch(member.batch || "2023-27");
      setGithub(member.github_username || "");
      setLinkedin(member.linkedin_url || "");
      setAvatarUrl(member.avatar_url || "");

      // Load extended GitHub-style preferences
      try {
        const raw = localStorage.getItem(`ccc_medicaps_profile_prefs_${member.id}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.pronouns) setPronouns(parsed.pronouns);
          if (parsed.customPronouns) setCustomPronouns(parsed.customPronouns);
          if (parsed.url) setUrl(parsed.url);
          if (parsed.company) setCompany(parsed.company);
          if (parsed.location) setLocation(parsed.location);
          if (typeof parsed.displayLocalTime === "boolean") setDisplayLocalTime(parsed.displayLocalTime);
          if (typeof parsed.hideActivity === "boolean") setHideActivity(parsed.hideActivity);
          if (typeof parsed.includePrivateContributions === "boolean") setIncludePrivateContributions(parsed.includePrivateContributions);
          if (typeof parsed.displayProBadge === "boolean") setDisplayProBadge(parsed.displayProBadge);
          else setDisplayProBadge(member.is_core_member);
          if (typeof parsed.showAchievements === "boolean") setShowAchievements(parsed.showAchievements);
          if (typeof parsed.availableForHire === "boolean") setAvailableForHire(parsed.availableForHire);
          if (parsed.preferredLanguage) setPreferredLanguage(parsed.preferredLanguage);
          if (parsed.publicEmailOption) setPublicEmailOption(parsed.publicEmailOption);
        } else {
          setDisplayProBadge(member.is_core_member);
        }
      } catch (err) {
        console.warn("Failed to load local profile preferences:", err);
      }
    }
  }, [member]);

  // Debounced handle check for account tab
  useEffect(() => {
    const clean = handleInput.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (!member || clean === member.handle?.toLowerCase()) {
      dispatch(setHandleStatus("idle"));
      return;
    }
    if (clean.length < 3) {
      dispatch(setHandleStatus("idle"));
      return;
    }
    dispatch(setHandleStatus("checking"));
    const timer = setTimeout(() => {
      dispatch(checkHandleThunk(clean));
    }, 450);
    return () => clearTimeout(timer);
  }, [handleInput, member, dispatch]);

  // Save All Profile Parameters (GitHub "Update profile" primary action)
  const handleUpdateProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!member) return;

    setIsUpdatingProfile(true);
    try {
      // 1. Update Core Database fields via API
      await dispatch(
        updateProfileThunk({
          full_name: fullName.trim(),
          bio: bio.trim(),
          department,
          batch,
          github_username: github.trim().replace(/^@/, ""),
          linkedin_url: linkedin.trim(),
          avatar_url: avatarUrl,
        })
      ).unwrap();

      // 2. Persist extended GitHub preferences to localStorage
      const prefsPayload = {
        pronouns,
        customPronouns: pronouns === "Custom" ? customPronouns.trim() : "",
        url: url.trim(),
        company: company.trim(),
        location: location.trim(),
        displayLocalTime,
        hideActivity,
        includePrivateContributions,
        displayProBadge,
        showAchievements,
        availableForHire,
        preferredLanguage,
        publicEmailOption,
      };
      localStorage.setItem(`ccc_medicaps_profile_prefs_${member.id}`, JSON.stringify(prefsPayload));

      // 3. Refresh Store & Invalidate Caches
      dispatch(fetchCurrentUserThunk());
      invalidateFullProfileCache();

      toast.success("Public profile updated successfully.");
    } catch (err: any) {
      console.error("Profile update error:", err);
      toast.error(typeof err === "string" ? err : err?.message || "Failed to update profile.");
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  // Direct MinIO Image Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file (PNG, JPG, WEBP, GIF).");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File exceeds 10MB limit. Please choose a smaller image.");
      return;
    }

    setIsUploadingImage(true);
    try {
      const uploadResult = await uploadMedia(file, "avatars");
      const newUrl = uploadResult.public_url;
      setAvatarUrl(newUrl);

      // Instantly sync avatar to user profile
      await dispatch(updateProfileThunk({ avatar_url: newUrl })).unwrap();
      dispatch(fetchCurrentUserThunk());
      invalidateFullProfileCache();

      toast.success("Profile picture uploaded and updated.");
    } catch (err: any) {
      console.error("Upload failed:", err);
      toast.error(err?.message || "Failed to upload image.");
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Remove Picture
  const handleRemovePicture = async () => {
    if (!member) return;
    setAvatarUrl("");
    try {
      await dispatch(updateProfileThunk({ avatar_url: "" })).unwrap();
      dispatch(fetchCurrentUserThunk());
      invalidateFullProfileCache();
      toast.success("Profile picture removed.");
    } catch (err: any) {
      toast.error(err?.message || "Failed to remove avatar.");
    }
  };

  // Select Preset Cyber Emblem
  const handleSelectEmblem = async (emblemId: string) => {
    if (!member) return;
    setAvatarUrl(emblemId);
    try {
      await dispatch(updateProfileThunk({ avatar_url: emblemId })).unwrap();
      dispatch(fetchCurrentUserThunk());
      invalidateFullProfileCache();
      toast.success(`Active emblem updated to ${emblemId.toUpperCase()}.`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to update emblem.");
    }
  };

  // Save Handle (Account tab)
  const handleSaveHandle = async () => {
    const clean = handleInput.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (!clean || clean.length < 3 || clean === member?.handle) return;
    if (handleStatus === "taken") {
      toast.error("This handle is already taken. Please pick another.");
      return;
    }
    try {
      await dispatch(updateProfileThunk({ handle: clean })).unwrap();
      dispatch(fetchCurrentUserThunk());
      invalidateFullProfileCache();
      toast.success("Handle updated successfully.");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update handle.");
    }
  };

  // Export Account Data as JSON
  const handleExportData = () => {
    if (!member) return;
    const exportData = {
      timestamp: new Date().toISOString(),
      institution: "Chaos Computer Club India — Medi-Caps Chapter",
      profile: {
        id: member.id,
        handle: member.handle,
        full_name: member.full_name,
        email: member.email,
        prn: member.prn,
        department: member.department,
        batch: member.batch,
        rating: member.rating,
        peak_rating: member.peak_rating,
        tier: member.tier,
        is_core_member: member.is_core_member,
        avatar_url: member.avatar_url,
        bio: member.bio,
        github_username: member.github_username,
        linkedin_url: member.linkedin_url,
      },
      preferences: {
        pronouns,
        customPronouns,
        url,
        company,
        location,
        displayLocalTime,
        hideActivity,
        includePrivateContributions,
        displayProBadge,
        showAchievements,
        availableForHire,
        preferredLanguage,
      },
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = `ccc-cadet-export-${member.handle || "profile"}.json`;
    a.click();
    URL.revokeObjectURL(downloadUrl);
    toast.success("Institutional dossier exported successfully.");
  };

  // Delete Account
  const handleDeleteAccount = async () => {
    if (!member) return;
    setIsDeleting(true);
    try {
      await dispatch(deleteAccountThunk()).unwrap();
      toast.success("Account permanently purged.");
      navigate("/auth", { replace: true });
    } catch (err: any) {
      setIsDeleting(false);
      toast.error(err || "Failed to delete account.");
    }
  };

  const isHandleChanged = Boolean(member && handleInput.trim().toLowerCase() !== member.handle?.toLowerCase());
  const activeEmblem = PRESET_EMBLEMS.find((e) => e.id === avatarUrl);
  const initials = member?.full_name
    ? member.full_name
        .split(" ")
        .map((w: string) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : (member?.handle?.slice(0, 2) || "CC").toUpperCase();

  if (!member) {
    return <SettingsSkeleton />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* ── TOP GITHUB-STYLE USER & SETTINGS HEADER ──────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div className="flex items-center gap-4">
          <Avatar className="size-12 rounded-none border border-white/10 bg-zinc-950 shrink-0">
            {avatarUrl && (avatarUrl.startsWith("http") || avatarUrl.startsWith("/media/") || avatarUrl.startsWith("/")) ? (
              <AvatarImage src={avatarUrl} alt={member.handle || "avatar"} className="object-cover rounded-none" />
            ) : null}
            <AvatarFallback
              className={cn(
                "rounded-none font-mono text-base font-bold flex items-center justify-center w-full h-full",
                activeEmblem ? cn(activeEmblem.bg, activeEmblem.border, activeEmblem.text) : "bg-lime-400 text-black"
              )}
            >
              {activeEmblem ? activeEmblem.icon : initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-mono font-extrabold text-white tracking-tight">
                {member.full_name || member.handle}
                {member.handle && <span className="text-zinc-500 font-normal ml-1.5">({member.handle})</span>}
              </h1>
              <Badge variant="outline" className="font-mono text-[10px] uppercase border-lime-400/30 text-lime-400 rounded-none">
                Settings
              </Badge>
            </div>
            <p className="font-mono text-xs text-zinc-400 mt-0.5">
              Your personal account · Medi-Caps Engineering Division
            </p>
          </div>
        </div>

        <Button
          asChild
          variant="outline"
          className="h-auto font-mono text-xs uppercase font-bold text-zinc-300 hover:text-white border-white/10 hover:border-zinc-500 bg-zinc-900/60 rounded-none cursor-pointer self-start sm:self-center"
        >
          <Link to="/portal/profile">
            <span>Go to personal profile</span>
            <ExternalLink size={12} className="ml-1.5" />
          </Link>
        </Button>
      </div>

      {/* ── 2-COLUMN SETTINGS ARCHITECTURE ───────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT NAVIGATION SIDEBAR (GitHub Categories) */}
        <aside className="lg:col-span-3 space-y-6">
          {/* Access Category */}
          <div className="space-y-1">
            <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-zinc-500 px-3 block mb-1">
              Access
            </span>
            <nav className="flex flex-col gap-1" aria-label="Access settings">
              <button
                type="button"
                onClick={() => setActiveTab("profile")}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 text-xs font-mono uppercase tracking-wider text-left rounded-none border transition-all cursor-pointer",
                  activeTab === "profile"
                    ? "bg-lime-400 text-black border-lime-400 font-bold shadow-md shadow-lime-400/20"
                    : "border-transparent text-zinc-400 hover:text-white hover:bg-zinc-900/80"
                )}
              >
                <UserRound size={14} className={activeTab === "profile" ? "text-black" : "text-zinc-400"} />
                <span>Public profile</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("account")}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 text-xs font-mono uppercase tracking-wider text-left rounded-none border transition-all cursor-pointer",
                  activeTab === "account"
                    ? "bg-lime-400 text-black border-lime-400 font-bold shadow-md shadow-lime-400/20"
                    : "border-transparent text-zinc-400 hover:text-white hover:bg-zinc-900/80"
                )}
              >
                <KeyRound size={14} className={activeTab === "account" ? "text-black" : "text-zinc-400"} />
                <span>Account</span>
              </button>
            </nav>
          </div>

          {/* Code & Workspace Category */}
          <div className="space-y-1">
            <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-zinc-500 px-3 block mb-1">
              Code, planning, and automation
            </span>
            <nav className="flex flex-col gap-1" aria-label="Code settings">
              <button
                type="button"
                onClick={() => setActiveTab("workspace")}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 text-xs font-mono uppercase tracking-wider text-left rounded-none border transition-all cursor-pointer",
                  activeTab === "workspace"
                    ? "bg-lime-400 text-black border-lime-400 font-bold shadow-md shadow-lime-400/20"
                    : "border-transparent text-zinc-400 hover:text-white hover:bg-zinc-900/80"
                )}
              >
                <Code2 size={14} className={activeTab === "workspace" ? "text-black" : "text-zinc-400"} />
                <span>Contest & Workspace</span>
              </button>
            </nav>
          </div>

          {/* Security Category */}
          <div className="space-y-1">
            <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-zinc-500 px-3 block mb-1">
              Security
            </span>
            <nav className="flex flex-col gap-1" aria-label="Security settings">
              <button
                type="button"
                onClick={() => setActiveTab("security")}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 text-xs font-mono uppercase tracking-wider text-left rounded-none border transition-all cursor-pointer",
                  activeTab === "security"
                    ? "bg-lime-400 text-black border-lime-400 font-bold shadow-md shadow-lime-400/20"
                    : "border-transparent text-zinc-400 hover:text-white hover:bg-zinc-900/80"
                )}
              >
                <ShieldCheck size={14} className={activeTab === "security" ? "text-black" : "text-zinc-400"} />
                <span>Authentication & Sessions</span>
              </button>
            </nav>
          </div>

          {/* Danger Zone Category */}
          <div className="space-y-1 pt-2 border-t border-white/10">
            <nav className="flex flex-col gap-1" aria-label="Danger settings">
              <button
                type="button"
                onClick={() => setActiveTab("danger")}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 text-xs font-mono uppercase tracking-wider text-left rounded-none border transition-all cursor-pointer",
                  activeTab === "danger"
                    ? "bg-rose-950/80 text-rose-300 border-rose-500/60 font-bold shadow-md shadow-rose-950/40"
                    : "border-transparent text-rose-400 hover:bg-rose-950/20 hover:border-rose-900/40"
                )}
              >
                <AlertTriangle size={14} className="text-rose-500" />
                <span>Danger Zone</span>
              </button>
            </nav>
          </div>
        </aside>

        {/* RIGHT MAIN PANEL */}
        <main className="lg:col-span-9">
          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* TAB 1: PUBLIC PROFILE (Two-Column Layout like GitHub)             */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {activeTab === "profile" && (
            <div className="rounded-none border border-white/10 bg-zinc-900/40 p-6 sm:p-8 backdrop-blur-md shadow-xl space-y-8">
              {/* Section Heading */}
              <div className="border-b border-white/10 pb-4">
                <h2 className="text-xl font-mono font-bold uppercase text-white tracking-wide">
                  Public profile
                </h2>
                <p className="text-xs text-zinc-400 font-mono mt-1">
                  Manage your personal presentation, institutional affiliation, and social verification.
                </p>
              </div>

              {/* Two-Column Grid: Form on Left (8 cols), Profile Picture on Right (4 cols) */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                {/* Form Fields Column */}
                <form onSubmit={handleUpdateProfile} className="md:col-span-8 space-y-6">
                  {/* Name */}
                  <div className="space-y-2">
                    <Label htmlFor="s-fullname" className="font-mono text-xs uppercase text-zinc-300 font-bold">
                      Name
                    </Label>
                    <Input
                      id="s-fullname"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Santusht Kotai"
                      className="font-mono text-sm bg-zinc-950 border-white/10 text-white rounded-none focus:border-lime-400"
                    />
                    <p className="text-[11px] text-zinc-500 leading-normal">
                      Your name may appear around the club portal where you contribute or are mentioned. You can remove it at any time.
                    </p>
                  </div>

                  {/* Public Email */}
                  <div className="space-y-2">
                    <Label htmlFor="s-public-email" className="font-mono text-xs uppercase text-zinc-300 font-bold">
                      Public email
                    </Label>
                    <Select
                      value={publicEmailOption}
                      onValueChange={(val: "public" | "private") => setPublicEmailOption(val)}
                    >
                      <SelectTrigger id="s-public-email" className="font-mono text-xs bg-zinc-950 border-white/10 text-white rounded-none">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-white/10 text-white rounded-none font-mono text-xs">
                        <SelectItem value="public">{member.email} (verified institutional)</SelectItem>
                        <SelectItem value="private">Don't display my email publicly</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-zinc-500 leading-normal">
                      Select a verified email to display. To toggle privacy, choose &ldquo;Don&apos;t display my email publicly&rdquo;.
                    </p>
                  </div>

                  {/* Bio */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="s-bio" className="font-mono text-xs uppercase text-zinc-300 font-bold">
                        Bio
                      </Label>
                      <span className="font-mono text-[10px] text-zinc-500 tabular-nums">{bio.length}/500</span>
                    </div>
                    <Textarea
                      id="s-bio"
                      value={bio}
                      maxLength={500}
                      onChange={(e) => setBio(e.target.value)}
                      rows={3}
                      placeholder="Tell us a little bit about yourself, cybersecurity research, and competitive goals"
                      className="font-mono text-xs resize-none bg-zinc-950 border-white/10 text-white rounded-none focus:border-lime-400"
                    />
                    <p className="text-[11px] text-zinc-500 leading-normal">
                      You can @mention other cadets and chapter squads to link to them.
                    </p>
                  </div>

                  {/* Pronouns */}
                  <div className="space-y-2">
                    <Label htmlFor="s-pronouns" className="font-mono text-xs uppercase text-zinc-300 font-bold">
                      Pronouns
                    </Label>
                    <div className="flex gap-2">
                      <Select value={pronouns} onValueChange={(val) => setPronouns(val)}>
                        <SelectTrigger id="s-pronouns" className="font-mono text-xs bg-zinc-950 border-white/10 text-white rounded-none">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-white/10 text-white rounded-none font-mono text-xs">
                          <SelectItem value="Don't specify">Don&apos;t specify</SelectItem>
                          <SelectItem value="they/them">they/them</SelectItem>
                          <SelectItem value="she/her">she/her</SelectItem>
                          <SelectItem value="he/him">he/him</SelectItem>
                          <SelectItem value="Custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                      {pronouns === "Custom" && (
                        <Input
                          value={customPronouns}
                          onChange={(e) => setCustomPronouns(e.target.value)}
                          placeholder="e.g. ze/zir"
                          className="font-mono text-xs bg-zinc-950 border-white/10 text-white rounded-none"
                        />
                      )}
                    </div>
                  </div>

                  {/* URL */}
                  <div className="space-y-2">
                    <Label htmlFor="s-url" className="font-mono text-xs uppercase text-zinc-300 font-bold">
                      URL
                    </Label>
                    <div className="relative">
                      <Globe size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                      <Input
                        id="s-url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://santusht.dev"
                        className="pl-8 font-mono text-xs bg-zinc-950 border-white/10 text-white rounded-none focus:border-lime-400"
                      />
                    </div>
                    <p className="text-[11px] text-zinc-500 leading-normal">
                      Your personal engineering portfolio, laboratory notebook, or research index.
                    </p>
                  </div>

                  {/* Social accounts */}
                  <div className="space-y-3">
                    <Label className="font-mono text-xs uppercase text-zinc-300 font-bold block">
                      Social accounts
                    </Label>
                    <div className="space-y-2">
                      {/* GitHub */}
                      <div className="relative">
                        <Github size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                        <Input
                          value={github}
                          onChange={(e) => setGithub(e.target.value.replace(/^@/, ""))}
                          placeholder="GitHub username (e.g. santusht06)"
                          className="pl-8 font-mono text-xs bg-zinc-950 border-white/10 text-white rounded-none focus:border-lime-400"
                        />
                      </div>
                      {/* LinkedIn */}
                      <div className="relative">
                        <Linkedin size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-400" />
                        <Input
                          value={linkedin}
                          onChange={(e) => setLinkedin(e.target.value)}
                          placeholder="LinkedIn URL (e.g. https://linkedin.com/in/username)"
                          className="pl-8 font-mono text-xs bg-zinc-950 border-white/10 text-white rounded-none focus:border-lime-400"
                        />
                      </div>
                    </div>
                    <p className="text-[11px] text-zinc-500 leading-normal">
                      Link your developer identities to display verified badges and open-source contributions on your dossier.
                    </p>
                  </div>

                  {/* Company / Squad */}
                  <div className="space-y-2">
                    <Label htmlFor="s-company" className="font-mono text-xs uppercase text-zinc-300 font-bold">
                      Company
                    </Label>
                    <div className="relative">
                      <Building size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                      <Input
                        id="s-company"
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        placeholder="e.g. @Chaos-Computer-Club or Department Lab"
                        className="pl-8 font-mono text-xs bg-zinc-950 border-white/10 text-white rounded-none focus:border-lime-400"
                      />
                    </div>
                    <p className="text-[11px] text-zinc-500 leading-normal">
                      You can @mention your company&apos;s or research lab&apos;s organization to link it.
                    </p>
                  </div>

                  {/* Location & Local Time */}
                  <div className="space-y-2">
                    <Label htmlFor="s-location" className="font-mono text-xs uppercase text-zinc-300 font-bold">
                      Location
                    </Label>
                    <div className="relative">
                      <MapPin size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                      <Input
                        id="s-location"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="Indore, Madhya Pradesh, India"
                        className="pl-8 font-mono text-xs bg-zinc-950 border-white/10 text-white rounded-none focus:border-lime-400"
                      />
                    </div>
                    <div className="flex items-start gap-2.5 pt-1.5">
                      <Checkbox
                        id="s-display-time"
                        checked={displayLocalTime}
                        onCheckedChange={(checked) => setDisplayLocalTime(Boolean(checked))}
                        className="mt-0.5 border-white/20"
                      />
                      <div className="space-y-0.5">
                        <label
                          htmlFor="s-display-time"
                          className="font-mono text-xs text-zinc-300 cursor-pointer select-none font-bold"
                        >
                          Display current local time
                        </label>
                        <p className="text-[11px] text-zinc-500">
                          Other cadets will see the time difference from their local time.{" "}
                          {displayLocalTime && (
                            <span className="text-lime-400 font-mono font-bold">
                              Current local time: {currentTimeStr}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* ORCID iD / Institutional Enrollment PRN */}
                  <div className="space-y-2">
                    <Label htmlFor="s-orcid" className="font-mono text-xs uppercase text-zinc-300 font-bold">
                      ORCID iD / Institutional PRN
                    </Label>
                    <div className="relative">
                      <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                      <Input
                        id="s-orcid"
                        value={member.prn || "—"}
                        readOnly
                        disabled
                        className="pl-8 font-mono text-xs bg-zinc-950/50 text-zinc-400 border-white/10 rounded-none cursor-not-allowed"
                      />
                    </div>
                    <p className="text-[11px] text-zinc-500 leading-normal">
                      ORCID and Enrollment PRN provide persistent identifiers that distinguish you from other researchers and students.
                    </p>
                  </div>

                  {/* Academic Department & Batch Cohort */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-2">
                      <Label className="font-mono text-xs uppercase text-zinc-300 font-bold">Department</Label>
                      <Select value={department} onValueChange={(val) => setDepartment(val)}>
                        <SelectTrigger className="font-mono text-xs bg-zinc-950 border-white/10 text-white rounded-none">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-white/10 text-white rounded-none font-mono text-xs">
                          <SelectItem value="CSE">CSE (Computer Science & Engineering)</SelectItem>
                          <SelectItem value="IT">IT (Information Technology)</SelectItem>
                          <SelectItem value="AIDS">AIDS (AI & Data Science)</SelectItem>
                          <SelectItem value="Cyber Security">Cyber Security</SelectItem>
                          <SelectItem value="ECE">ECE (Electronics & Comm.)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="font-mono text-xs uppercase text-zinc-300 font-bold">Graduation Batch</Label>
                      <Select value={batch} onValueChange={(val) => setBatch(val)}>
                        <SelectTrigger className="font-mono text-xs bg-zinc-950 border-white/10 text-white rounded-none">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-white/10 text-white rounded-none font-mono text-xs">
                          <SelectItem value="2022-26">2022–2026</SelectItem>
                          <SelectItem value="2023-27">2023–2027</SelectItem>
                          <SelectItem value="2024-28">2024–2028</SelectItem>
                          <SelectItem value="2025-29">2025–2029</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <p className="text-[11px] text-zinc-500 italic pt-2 leading-relaxed">
                    All of the fields on this page are optional and can be updated at any time, and by filling them out, you&apos;re giving us consent to share this data wherever your user profile appears.
                  </p>

                  {/* Divider */}
                  <div className="border-t border-white/10 pt-6 space-y-4">
                    <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-white">
                      Contributions & activity
                    </h3>

                    {/* Make profile private and hide activity */}
                    <div className="flex items-start gap-2.5">
                      <Checkbox
                        id="s-hide-activity"
                        checked={hideActivity}
                        onCheckedChange={(checked) => setHideActivity(Boolean(checked))}
                        className="mt-0.5 border-white/20"
                      />
                      <div className="space-y-0.5">
                        <label
                          htmlFor="s-hide-activity"
                          className="font-mono text-xs text-zinc-300 cursor-pointer select-none font-bold"
                        >
                          Make profile private and hide activity
                        </label>
                        <p className="text-[11px] text-zinc-500 leading-normal">
                          Enabling this will hide your contributions and activity from your profile and from social features like followers, rankings, feeds, and releases.
                        </p>
                      </div>
                    </div>

                    {/* Include private contributions on my profile */}
                    <div className="flex items-start gap-2.5">
                      <Checkbox
                        id="s-private-contribs"
                        checked={includePrivateContributions}
                        onCheckedChange={(checked) => setIncludePrivateContributions(Boolean(checked))}
                        className="mt-0.5 border-white/20"
                      />
                      <div className="space-y-0.5">
                        <label
                          htmlFor="s-private-contribs"
                          className="font-mono text-xs text-zinc-300 cursor-pointer select-none font-bold"
                        >
                          Include private contributions on my profile
                        </label>
                        <p className="text-[11px] text-zinc-500 leading-normal">
                          Your contribution graph, achievements, and activity overview will show your private practice solves without revealing unreleased contest problem information.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-white/10 pt-6 space-y-4">
                    <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-white">
                      Profile settings
                    </h3>

                    {/* Display PRO badge */}
                    <div className="flex items-start gap-2.5">
                      <Checkbox
                        id="s-pro-badge"
                        checked={displayProBadge}
                        onCheckedChange={(checked) => setDisplayProBadge(Boolean(checked))}
                        className="mt-0.5 border-white/20"
                      />
                      <div className="space-y-0.5">
                        <label
                          htmlFor="s-pro-badge"
                          className="font-mono text-xs text-zinc-300 cursor-pointer select-none font-bold"
                        >
                          Display PRO badge
                        </label>
                        <p className="text-[11px] text-zinc-500 leading-normal">
                          This will display the Pro / Cadet badge on your public profile page.
                        </p>
                      </div>
                    </div>

                    {/* Show Achievements on my profile */}
                    <div className="flex items-start gap-2.5">
                      <Checkbox
                        id="s-achievements"
                        checked={showAchievements}
                        onCheckedChange={(checked) => setShowAchievements(Boolean(checked))}
                        className="mt-0.5 border-white/20"
                      />
                      <div className="space-y-0.5">
                        <label
                          htmlFor="s-achievements"
                          className="font-mono text-xs text-zinc-300 cursor-pointer select-none font-bold"
                        >
                          Show Achievements on my profile
                        </label>
                        <p className="text-[11px] text-zinc-500 leading-normal">
                          Your achievements and verified podium finishes will be shown on your profile.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-white/10 pt-6 space-y-4">
                    <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-white">
                      Jobs profile
                    </h3>

                    {/* Available for hire */}
                    <div className="flex items-start gap-2.5">
                      <Checkbox
                        id="s-available-hire"
                        checked={availableForHire}
                        onCheckedChange={(checked) => setAvailableForHire(Boolean(checked))}
                        className="mt-0.5 border-white/20"
                      />
                      <div className="space-y-0.5">
                        <label
                          htmlFor="s-available-hire"
                          className="font-mono text-xs text-zinc-300 cursor-pointer select-none font-bold"
                        >
                          Available for hire
                        </label>
                        <p className="text-[11px] text-zinc-500 leading-normal">
                          Signal to campus recruiters, labs, and hackathon squads that you are open to opportunities.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-white/10 pt-6 space-y-4">
                    <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-white">
                      Trending settings
                    </h3>

                    <div className="space-y-2">
                      <Label className="font-mono text-xs uppercase text-zinc-300 font-bold">
                        Preferred spoken & coding language
                      </Label>
                      <Select value={preferredLanguage} onValueChange={(val) => setPreferredLanguage(val)}>
                        <SelectTrigger className="font-mono text-xs bg-zinc-950 border-white/10 text-white rounded-none">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-white/10 text-white rounded-none font-mono text-xs">
                          {LANGUAGES.map((lang) => (
                            <SelectItem key={lang} value={lang}>
                              {lang}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-zinc-500 leading-normal">
                        We&apos;ll use this language preference to filter problem recommendations and arena code templates.
                      </p>
                    </div>
                  </div>

                  {/* Primary Update Profile Button */}
                  <div className="pt-4">
                    <Button
                      type="submit"
                      disabled={isUpdatingProfile}
                      className="bg-lime-400 text-black hover:bg-lime-300 font-mono text-xs font-bold uppercase rounded-none px-6 py-2.5 shadow-md shadow-lime-400/20 cursor-pointer"
                    >
                      {isUpdatingProfile ? (
                        <>
                          <Loader2 className="animate-spin size-4 mr-2" />
                          <span>Updating profile...</span>
                        </>
                      ) : (
                        <span>Update profile</span>
                      )}
                    </Button>
                  </div>
                </form>

                {/* Right Column: Profile Picture & Cyber Emblems */}
                <div className="md:col-span-4 space-y-6">
                  <div>
                    <Label className="font-mono text-xs uppercase text-zinc-300 font-bold block mb-3">
                      Profile picture
                    </Label>
                    {/* Large Square Image Container */}
                    <div className="relative group size-48 sm:size-52 border border-white/15 bg-zinc-950 rounded-none overflow-hidden flex items-center justify-center shadow-2xl">
                      {avatarUrl && (avatarUrl.startsWith("http") || avatarUrl.startsWith("/media/") || avatarUrl.startsWith("/")) ? (
                        <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover rounded-none" />
                      ) : activeEmblem ? (
                        <div
                          className={cn(
                            "w-full h-full flex flex-col items-center justify-center p-4",
                            activeEmblem.bg
                          )}
                        >
                          <span className="text-6xl mb-2">{activeEmblem.icon}</span>
                          <span className={cn("font-mono text-xs font-bold uppercase", activeEmblem.text)}>
                            {activeEmblem.label}
                          </span>
                        </div>
                      ) : (
                        <div className="w-full h-full bg-lime-400/10 flex items-center justify-center text-lime-400 font-mono text-4xl font-extrabold">
                          {initials}
                        </div>
                      )}

                      {/* Hidden File Input */}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </div>

                    {/* Action Buttons under picture */}
                    <div className="flex flex-col gap-2 mt-3 max-w-[208px]">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isUploadingImage}
                        onClick={() => fileInputRef.current?.click()}
                        className="font-mono text-xs uppercase border-white/10 bg-zinc-900/80 hover:bg-zinc-800 text-white rounded-none cursor-pointer w-full"
                      >
                        {isUploadingImage ? (
                          <>
                            <Loader2 className="animate-spin size-3 mr-1.5" />
                            <span>Uploading...</span>
                          </>
                        ) : (
                          <>
                            <Upload size={13} className="mr-1.5" />
                            <span>Edit / Upload picture</span>
                          </>
                        )}
                      </Button>

                      {avatarUrl && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleRemovePicture}
                          className="font-mono text-xs uppercase text-rose-400 hover:text-rose-300 hover:bg-rose-950/20 rounded-none cursor-pointer w-full"
                        >
                          <Trash2 size={13} className="mr-1.5" />
                          <span>Remove</span>
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Preset Cyber Emblems */}
                  <div className="pt-4 border-t border-white/10 space-y-2.5">
                    <Label className="font-mono text-[11px] uppercase text-zinc-400 font-bold block">
                      Cyber Emblem Presets
                    </Label>
                    <p className="text-[11px] text-zinc-500">
                      Or pick an official CCC tactical emblem:
                    </p>
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      {PRESET_EMBLEMS.map((emblem) => {
                        const isSelected = avatarUrl === emblem.id;
                        return (
                          <button
                            key={emblem.id}
                            type="button"
                            onClick={() => handleSelectEmblem(emblem.id)}
                            className={cn(
                              "flex flex-col items-center justify-center p-2.5 border rounded-none transition-all cursor-pointer text-center",
                              isSelected
                                ? cn(emblem.border, emblem.bg, "ring-2 ring-lime-400")
                                : "border-white/10 bg-zinc-950/70 hover:border-zinc-500 hover:bg-zinc-900"
                            )}
                          >
                            <span className="text-xl mb-0.5">{emblem.icon}</span>
                            <span className={cn("font-mono text-[9px] uppercase font-bold", isSelected ? emblem.text : "text-zinc-400")}>
                              {emblem.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* TAB 2: ACCOUNT                                                   */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {activeTab === "account" && (
            <div className="rounded-none border border-white/10 bg-zinc-900/40 p-6 sm:p-8 backdrop-blur-md shadow-xl space-y-8">
              <div className="border-b border-white/10 pb-4">
                <h2 className="text-xl font-mono font-bold uppercase text-white tracking-wide">
                  Account settings
                </h2>
                <p className="text-xs text-zinc-400 font-mono mt-1">
                  Manage your handle, institutional verification credentials, and data exports.
                </p>
              </div>

              {/* Change Username / Handle */}
              <div className="space-y-3">
                <Label htmlFor="acc-handle" className="font-mono text-xs uppercase text-zinc-300 font-bold block">
                  Change username / handle
                </Label>
                <div className="flex items-center gap-2 max-w-md">
                  <div className="relative flex-1">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-zinc-500">
                      @
                    </span>
                    <Input
                      id="acc-handle"
                      value={handleInput}
                      onChange={(e) => setHandleInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                      className={cn(
                        "font-mono text-sm pl-8 bg-zinc-950 border-white/10 text-white rounded-none focus:border-lime-400",
                        isHandleChanged && handleStatus === "available" && "border-emerald-500/60",
                        isHandleChanged && handleStatus === "taken" && "border-rose-500/60 text-rose-200"
                      )}
                      placeholder="santusht06"
                    />
                  </div>
                  <Button
                    type="button"
                    disabled={!isHandleChanged || handleInput.trim().length < 3 || handleStatus !== "available"}
                    onClick={handleSaveHandle}
                    className="bg-lime-400 text-black hover:bg-lime-300 font-mono text-xs font-bold uppercase rounded-none px-4 shrink-0"
                  >
                    Change handle
                  </Button>
                </div>
                <div className="flex items-center h-4 font-mono text-[10px]">
                  {!isHandleChanged && <span className="text-zinc-500">current handle</span>}
                  {isHandleChanged && handleStatus === "checking" && (
                    <span className="text-lime-400 flex items-center gap-1">
                      <Loader2 className="animate-spin size-3" /> checking availability...
                    </span>
                  )}
                  {isHandleChanged && handleStatus === "available" && (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <Check size={12} /> available
                    </span>
                  )}
                  {isHandleChanged && handleStatus === "taken" && (
                    <span className="text-rose-400 flex items-center gap-1">
                      <X size={12} /> handle is taken
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-zinc-500 max-w-md">
                  Changing your username will redirect your public profile link (<code>/u/{member.handle}</code>).
                </p>
              </div>

              {/* Institutional Registration Locks */}
              <div className="border-t border-white/10 pt-6 space-y-4">
                <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-white">
                  Institutional Identifiers
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
                  <div>
                    <Label className="font-mono text-[10px] uppercase text-zinc-500">Enrollment PRN</Label>
                    <Input
                      value={member.prn || "—"}
                      readOnly
                      disabled
                      className="font-mono text-xs bg-zinc-950/50 text-zinc-400 cursor-not-allowed border-white/10 rounded-none mt-1"
                    />
                  </div>
                  <div>
                    <Label className="font-mono text-[10px] uppercase text-zinc-500">Registered Institutional Email</Label>
                    <Input
                      value={member.email || "—"}
                      readOnly
                      disabled
                      className="font-mono text-xs bg-zinc-950/50 text-zinc-400 cursor-not-allowed border-white/10 rounded-none mt-1"
                    />
                  </div>
                </div>
              </div>

              {/* Export Account Data */}
              <div className="border-t border-white/10 pt-6 space-y-3">
                <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-white">
                  Export account data
                </h3>
                <p className="text-[11px] text-zinc-400 max-w-md">
                  Export all your personal profile records, contest participation ledger, rating milestones, and preferences as JSON.
                </p>
                <Button
                  type="button"
                  onClick={handleExportData}
                  variant="outline"
                  className="font-mono text-xs uppercase border-white/10 rounded-none text-zinc-200 hover:text-white bg-zinc-950 cursor-pointer"
                >
                  <Download size={13} className="mr-1.5" /> Start export
                </Button>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* TAB 3: CONTEST & WORKSPACE PREFERENCES                           */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {activeTab === "workspace" && (
            <div className="rounded-none border border-white/10 bg-zinc-900/40 p-6 sm:p-8 backdrop-blur-md shadow-xl space-y-8">
              <div className="border-b border-white/10 pb-4">
                <h2 className="text-xl font-mono font-bold uppercase text-white tracking-wide">
                  Contest & Workspace Preferences
                </h2>
                <p className="text-xs text-zinc-400 font-mono mt-1">
                  Configure your Monaco code editor defaults, compiler language, and arena telemetry sound effects.
                </p>
              </div>

              {/* Default Judge Language */}
              <div className="space-y-2 max-w-md">
                <Label className="font-mono text-xs uppercase text-zinc-300 font-bold">
                  Default Judge Language
                </Label>
                <Select value={defaultJudgeLang} onValueChange={(val) => setDefaultJudgeLang(val)}>
                  <SelectTrigger className="font-mono text-xs bg-zinc-950 border-white/10 text-white rounded-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-white/10 text-white rounded-none font-mono text-xs">
                    <SelectItem value="C++20 (GCC 13.2)">C++20 (GCC 13.2 with -O3)</SelectItem>
                    <SelectItem value="Python 3.12 (CPython)">Python 3.12 (CPython)</SelectItem>
                    <SelectItem value="Java 21 (OpenJDK)">Java 21 (OpenJDK)</SelectItem>
                    <SelectItem value="Rust 1.78">Rust 1.78 (2021 Edition)</SelectItem>
                    <SelectItem value="Go 1.22">Go 1.22</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-zinc-500">
                  Pre-selected when launching into proctored offline battles and problem archive.
                </p>
              </div>

              {/* Editor Keybindings */}
              <div className="space-y-2 max-w-md">
                <Label className="font-mono text-xs uppercase text-zinc-300 font-bold">
                  Editor Keybindings
                </Label>
                <Select value={editorKeybindings} onValueChange={(val) => setEditorKeybindings(val)}>
                  <SelectTrigger className="font-mono text-xs bg-zinc-950 border-white/10 text-white rounded-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-white/10 text-white rounded-none font-mono text-xs">
                    <SelectItem value="standard">Standard (VS Code default)</SelectItem>
                    <SelectItem value="vim">Vim Mode</SelectItem>
                    <SelectItem value="emacs">Emacs Mode</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Audio feedback & telemetry */}
              <div className="border-t border-white/10 pt-6 space-y-4 max-w-xl">
                <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-white">
                  Auditory Telemetry
                </h3>
                <div className="divide-y divide-white/5">
                  <div className="py-3 flex items-center justify-between gap-4">
                    <div>
                      <strong className="font-mono text-xs block text-white">Verdict Chime</strong>
                      <span className="text-[11px] text-zinc-400 block mt-0.5">
                        Audio bell on Accepted or Rejected test suite execution.
                      </span>
                    </div>
                    <Switch checked={soundVerdict} onCheckedChange={(val) => setSoundVerdict(val)} />
                  </div>
                  <div className="py-3 flex items-center justify-between gap-4">
                    <div>
                      <strong className="font-mono text-xs block text-white">Timer Warning Pulse</strong>
                      <span className="text-[11px] text-zinc-400 block mt-0.5">
                        Audible alert when less than 5 minutes remain in the contest.
                      </span>
                    </div>
                    <Switch checked={soundCountdown} onCheckedChange={(val) => setSoundCountdown(val)} />
                  </div>
                </div>
              </div>

              {/* Save workspace button */}
              <div className="pt-2">
                <Button
                  type="button"
                  onClick={() => toast.success("Workspace preferences saved.")}
                  className="bg-lime-400 text-black hover:bg-lime-300 font-mono text-xs font-bold uppercase rounded-none px-5 py-2"
                >
                  Save workspace preferences
                </Button>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* TAB 4: SECURITY & SESSIONS                                       */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {activeTab === "security" && (
            <div className="rounded-none border border-white/10 bg-zinc-900/40 p-6 sm:p-8 backdrop-blur-md shadow-xl space-y-8">
              <div className="border-b border-white/10 pb-4">
                <h2 className="text-xl font-mono font-bold uppercase text-white tracking-wide">
                  Security & Sessions
                </h2>
                <p className="text-xs text-zinc-400 font-mono mt-1">
                  Manage connected single sign-on credentials, notification alerts, and active terminal sessions.
                </p>
              </div>

              {/* Connected Accounts */}
              <div className="space-y-3">
                <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-white">
                  Connected SSO Providers
                </h3>
                <div className="p-4 bg-zinc-950 border border-white/10 flex items-center justify-between gap-4 max-w-xl">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-none bg-zinc-900 border border-white/10 flex items-center justify-center font-bold text-xs text-white">
                      G
                    </div>
                    <div>
                      <strong className="font-mono text-xs block text-white">Google Workspace SSO</strong>
                      <span className="font-mono text-[10px] text-zinc-400">{member.email}</span>
                    </div>
                  </div>
                  <Badge variant="outline" className="font-mono text-[10px] text-emerald-400 border-emerald-500/40 bg-emerald-950/20 rounded-none">
                    CONNECTED
                  </Badge>
                </div>
              </div>

              {/* Notification Preferences */}
              <div className="border-t border-white/10 pt-6 space-y-4 max-w-xl">
                <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-white">
                  Notification Delivery
                </h3>
                <div className="divide-y divide-white/5">
                  <div className="py-3 flex items-center justify-between gap-4">
                    <div>
                      <strong className="font-mono text-xs block text-white">Contest Announcements</strong>
                      <span className="text-[11px] text-zinc-400 block mt-0.5">
                        Receive reminder alerts before scheduled proctored campus battles.
                      </span>
                    </div>
                    <Switch
                      checked={notifContests}
                      onCheckedChange={(val) => {
                        setNotifContests(val);
                        toast.success(`Contest notifications ${val ? "enabled" : "disabled"}`);
                      }}
                    />
                  </div>

                  <div className="py-3 flex items-center justify-between gap-4">
                    <div>
                      <strong className="font-mono text-xs block text-white">Rating & Standings Updates</strong>
                      <span className="text-[11px] text-zinc-400 block mt-0.5">
                        Notifications when post-contest rating shifts and badges are computed.
                      </span>
                    </div>
                    <Switch
                      checked={notifRatings}
                      onCheckedChange={(val) => {
                        setNotifRatings(val);
                        toast.success(`Rating notifications ${val ? "enabled" : "disabled"}`);
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Active Session & Security */}
              <div className="border-t border-white/10 pt-6 space-y-4 max-w-xl">
                <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-white">
                  Active Terminal Session
                </h3>
                <div className="flex items-start justify-between gap-4 p-4 bg-zinc-950 border border-white/10">
                  <div className="flex items-start gap-3">
                    <Laptop className="size-5 text-lime-400 mt-0.5" />
                    <div>
                      <strong className="font-mono text-xs block text-white">
                        {typeof window !== "undefined" ? window.navigator.platform || "Workstation Session" : "Workstation Session"}
                      </strong>
                      <p className="font-mono text-[10px] text-zinc-400 mt-0.5">
                        Stateless HMAC-SHA256 JWT · Stored in Local Session Storage
                      </p>
                      <span className="inline-flex items-center gap-1.5 mt-2 font-mono text-[10px] text-emerald-400">
                        <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        ACTIVE NOW
                      </span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="font-mono text-xs uppercase border-white/10 rounded-none text-zinc-300 hover:text-white"
                    onClick={() => logout()}
                  >
                    <LogOut size={13} className="mr-1.5" /> Log Out
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* TAB 5: DANGER ZONE                                               */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {activeTab === "danger" && (
            <div className="rounded-none border border-rose-500/40 bg-rose-950/10 p-6 sm:p-8 backdrop-blur-md shadow-xl space-y-6">
              <div className="flex items-start gap-3 border-b border-rose-500/20 pb-4">
                <AlertTriangle className="size-6 text-rose-500 shrink-0 mt-0.5" />
                <div>
                  <h2 className="font-mono text-base font-bold uppercase tracking-wider text-rose-300">
                    Danger Zone · Permanent Account Purge
                  </h2>
                  <p className="text-xs text-rose-200/80 leading-relaxed mt-1">
                    Deleting your account is permanent and irreversible. Your competitive rating record,
                    campus pass cryptographic certificates, and leaderboard standings will be permanently erased.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                <div>
                  <strong className="font-mono text-xs text-rose-200 block">Irrevocable purge action</strong>
                  <span className="font-mono text-[10px] text-rose-300/70">
                    Requires explicit confirmation of your handle (@{member.handle || "user"}).
                  </span>
                </div>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      className="font-mono text-xs uppercase tracking-wider rounded-none bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-lg shadow-rose-950/50 cursor-pointer"
                    >
                      <Trash2 size={14} className="mr-1.5" /> Delete Account
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="border-rose-500/50 bg-zinc-950 text-white rounded-none">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="font-mono uppercase text-rose-400 flex items-center gap-2">
                        <ShieldAlert className="size-5 text-rose-500" />
                        Confirm Account Deletion
                      </AlertDialogTitle>
                      <AlertDialogDescription className="text-xs text-zinc-400 leading-relaxed space-y-2">
                        <p>
                          This will permanently delete <strong className="text-white">@{member.handle}</strong> and all associated records.
                        </p>
                        <p>
                          To confirm, please type your handle <code className="text-lime-400 bg-zinc-900 px-1.5 py-0.5 rounded-none border border-white/10">{member.handle}</code> below:
                        </p>
                      </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="my-2">
                      <Input
                        value={deleteConfirmText}
                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                        placeholder={member.handle || "handle"}
                        className="font-mono text-sm bg-zinc-900 border-rose-500/40 text-white rounded-none focus-visible:ring-rose-500"
                      />
                    </div>

                    <AlertDialogFooter>
                      <AlertDialogCancel
                        onClick={() => setDeleteConfirmText("")}
                        className="font-mono text-xs uppercase rounded-none border-white/10"
                      >
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        disabled={deleteConfirmText.trim().toLowerCase() !== member.handle?.toLowerCase() || isDeleting}
                        onClick={handleDeleteAccount}
                        className="font-mono text-xs uppercase rounded-none bg-rose-600 hover:bg-rose-700 text-white font-semibold disabled:opacity-50"
                      >
                        {isDeleting ? <Loader2 className="animate-spin size-4" /> : "Permanently Delete"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── GITHUB-STYLE FOOTER ────────────────────────────────────────── */}
      <footer className="pt-12 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-[11px] text-zinc-500">
        <div>
          © 2026 Chaos Computer Club India — Medi-Caps Chapter. All rights reserved.
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <Link to="/portal" className="hover:text-zinc-300 transition-colors">Portal</Link>
          <Link to="/portal/contests" className="hover:text-zinc-300 transition-colors">Contests</Link>
          <Link to="/portal/leaderboard" className="hover:text-zinc-300 transition-colors">Leaderboard</Link>
          <Link to="/portal/verify" className="hover:text-zinc-300 transition-colors">Cryptographic Verification</Link>
          <a
            href="https://github.com/santusht06"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-zinc-300 transition-colors"
          >
            GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}
