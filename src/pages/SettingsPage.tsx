/**
 * Chaos Computer Club India — Medi-Caps Chapter
 * Settings & Profile Architecture — GitHub-Style Personal Account Suite.
 * Fully SANS-SERIF typography, clean layout, and GitHub-ready cool PFPs.
 */

import React, { useEffect, useState, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  Building,
  Check,
  Clock,
  Code2,
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
  Sparkles,
  Trash2,
  Upload,
  UserRound,
  X,
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
import {
  COOL_PFPS,
  CyberAvatar,
  downloadCoolPfp,
  getCoolPfp,
  CoolPfp,
} from "@/organization/components/CyberAvatar";
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
import { SettingsSkeleton } from "@/organization/components/skeletons";

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

  // Security & Notification state
  const [notifContests, setNotifContests] = useState(true);
  const [notifRatings, setNotifRatings] = useState(true);

  // Loaders
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

  // Live Local Time calculation
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

  // Update Profile Form Submission
  const handleUpdateProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!member) return;

    setIsUpdatingProfile(true);
    try {
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

      dispatch(fetchCurrentUserThunk());
      invalidateFullProfileCache();

      toast.success("Profile updated successfully.");
    } catch (err: any) {
      console.error("Profile update error:", err);
      toast.error(typeof err === "string" ? err : err?.message || "Failed to update profile.");
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  // MinIO Image Upload
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

      await dispatch(updateProfileThunk({ avatar_url: newUrl })).unwrap();
      dispatch(fetchCurrentUserThunk());
      invalidateFullProfileCache();

      toast.success("Profile picture updated.");
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

  // Select Cool GitHub PFP
  const handleSelectCoolPfp = async (pfp: CoolPfp) => {
    if (!member) return;
    setAvatarUrl(pfp.id);
    try {
      await dispatch(updateProfileThunk({ avatar_url: pfp.id })).unwrap();
      dispatch(fetchCurrentUserThunk());
      invalidateFullProfileCache();
      toast.success(`Selected "${pfp.name}" as your active avatar.`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to update avatar.");
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
    toast.success("Account dossier exported as JSON.");
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
  const activeCoolPfp = getCoolPfp(avatarUrl);
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
    <div className="font-sans max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 text-zinc-100">
      {/* ── TOP GITHUB-STYLE USER & SETTINGS HEADER ──────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div className="flex items-center gap-4">
          <div className="size-12 rounded-none border border-white/15 bg-zinc-950 shrink-0 overflow-hidden">
            <CyberAvatar avatarUrl={avatarUrl} fallbackText={initials} />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">
                {member.full_name || member.handle}
                {member.handle && <span className="text-zinc-400 font-normal ml-2">({member.handle})</span>}
              </h1>
              <span className="text-xs font-medium px-2 py-0.5 rounded-none bg-zinc-800 text-zinc-300 border border-white/10">
                settings
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Your personal account · Medi-Caps Engineering Division
            </p>
          </div>
        </div>

        <Button
          asChild
          variant="outline"
          className="h-9 font-sans text-xs font-medium text-zinc-300 hover:text-white border-white/15 hover:border-zinc-500 bg-zinc-900/60 rounded-none cursor-pointer self-start sm:self-center"
        >
          <Link to="/portal/profile">
            <span>Go to your personal profile</span>
            <ExternalLink size={12} className="ml-1.5 opacity-70" />
          </Link>
        </Button>
      </div>

      {/* ── 2-COLUMN SETTINGS ARCHITECTURE ───────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT NAVIGATION SIDEBAR (Clean GitHub Sans-Serif Categories) */}
        <aside className="lg:col-span-3 space-y-6" aria-label="Settings Categories">
          {/* Access Category */}
          <div className="space-y-1">
            <span className="text-xs font-semibold text-zinc-400 px-3 py-1 block">
              Access
            </span>
            <nav className="flex flex-col gap-0.5">
              <button
                type="button"
                onClick={() => setActiveTab("profile")}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 text-sm text-left rounded-none transition-colors cursor-pointer w-full",
                  activeTab === "profile"
                    ? "bg-zinc-800/90 text-white font-medium border-l-2 border-lime-400 pl-2.5"
                    : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/40"
                )}
              >
                <UserRound size={15} className={activeTab === "profile" ? "text-lime-400" : "text-zinc-500"} />
                <span>Public profile</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("account")}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 text-sm text-left rounded-none transition-colors cursor-pointer w-full",
                  activeTab === "account"
                    ? "bg-zinc-800/90 text-white font-medium border-l-2 border-lime-400 pl-2.5"
                    : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/40"
                )}
              >
                <KeyRound size={15} className={activeTab === "account" ? "text-lime-400" : "text-zinc-500"} />
                <span>Account</span>
              </button>
            </nav>
          </div>

          {/* Code, planning, and automation Category */}
          <div className="space-y-1">
            <span className="text-xs font-semibold text-zinc-400 px-3 py-1 block">
              Code, planning, and automation
            </span>
            <nav className="flex flex-col gap-0.5">
              <button
                type="button"
                onClick={() => setActiveTab("workspace")}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 text-sm text-left rounded-none transition-colors cursor-pointer w-full",
                  activeTab === "workspace"
                    ? "bg-zinc-800/90 text-white font-medium border-l-2 border-lime-400 pl-2.5"
                    : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/40"
                )}
              >
                <Code2 size={15} className={activeTab === "workspace" ? "text-lime-400" : "text-zinc-500"} />
                <span>Contest & Workspace</span>
              </button>
            </nav>
          </div>

          {/* Security Category */}
          <div className="space-y-1">
            <span className="text-xs font-semibold text-zinc-400 px-3 py-1 block">
              Security
            </span>
            <nav className="flex flex-col gap-0.5">
              <button
                type="button"
                onClick={() => setActiveTab("security")}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 text-sm text-left rounded-none transition-colors cursor-pointer w-full",
                  activeTab === "security"
                    ? "bg-zinc-800/90 text-white font-medium border-l-2 border-lime-400 pl-2.5"
                    : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/40"
                )}
              >
                <ShieldCheck size={15} className={activeTab === "security" ? "text-lime-400" : "text-zinc-500"} />
                <span>Authentication & Sessions</span>
              </button>
            </nav>
          </div>

          {/* Danger Zone Category */}
          <div className="pt-2 border-t border-white/10 space-y-1">
            <span className="text-xs font-semibold text-rose-400/80 px-3 py-1 block">
              Danger Zone
            </span>
            <nav className="flex flex-col gap-0.5">
              <button
                type="button"
                onClick={() => setActiveTab("danger")}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 text-sm text-left rounded-none transition-colors cursor-pointer w-full",
                  activeTab === "danger"
                    ? "bg-rose-950/60 text-rose-200 font-medium border-l-2 border-rose-500 pl-2.5"
                    : "text-rose-400/80 hover:text-rose-200 hover:bg-rose-950/20"
                )}
              >
                <AlertTriangle size={15} className="text-rose-500" />
                <span>Danger Zone</span>
              </button>
            </nav>
          </div>
        </aside>

        {/* RIGHT MAIN PANEL */}
        <main className="lg:col-span-9">
          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* TAB 1: PUBLIC PROFILE (Clean SANS-SERIF 2-Column Layout)         */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {activeTab === "profile" && (
            <div className="rounded-none border border-white/10 bg-zinc-900/30 p-6 sm:p-8 backdrop-blur-md shadow-xl space-y-8">
              {/* Clean GitHub Section Header */}
              <div className="border-b border-white/10 pb-4">
                <h2 className="text-2xl font-semibold text-white tracking-tight">
                  Public profile
                </h2>
                <p className="text-sm text-zinc-400 mt-1">
                  Manage your verified cadet identity, developer links, and GitHub-ready avatar.
                </p>
              </div>

              {/* Two-Column Layout: Form (7-8 cols), Avatar Studio (4-5 cols) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Form Fields Column */}
                <form onSubmit={handleUpdateProfile} className="lg:col-span-7 space-y-5">
                  {/* Name */}
                  <div className="space-y-1.5">
                    <Label htmlFor="s-fullname" className="text-sm font-medium text-zinc-200">
                      Name
                    </Label>
                    <Input
                      id="s-fullname"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Santusht Kotai"
                      className="font-sans text-sm bg-zinc-950 border-white/15 text-white rounded-none focus-visible:border-lime-400 focus-visible:ring-1 focus-visible:ring-lime-400"
                    />
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Your name may appear around GitHub and the club portal where you contribute or are mentioned. You can remove it at any time.
                    </p>
                  </div>

                  {/* Public Email */}
                  <div className="space-y-1.5">
                    <Label htmlFor="s-public-email" className="text-sm font-medium text-zinc-200">
                      Public email
                    </Label>
                    <Select
                      value={publicEmailOption}
                      onValueChange={(val: "public" | "private") => setPublicEmailOption(val)}
                    >
                      <SelectTrigger id="s-public-email" className="font-sans text-sm bg-zinc-950 border-white/15 text-white rounded-none">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-white/15 text-white rounded-none font-sans text-sm">
                        <SelectItem value="public">{member.email} (verified institutional)</SelectItem>
                        <SelectItem value="private">Don&apos;t display my email publicly</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Select a verified email to display. To toggle privacy, choose &ldquo;Don&apos;t display my email publicly&rdquo;.
                    </p>
                  </div>

                  {/* Bio */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="s-bio" className="text-sm font-medium text-zinc-200">
                        Bio
                      </Label>
                      <span className="text-xs text-zinc-400 tabular-nums">{bio.length}/500</span>
                    </div>
                    <Textarea
                      id="s-bio"
                      value={bio}
                      maxLength={500}
                      onChange={(e) => setBio(e.target.value)}
                      rows={3}
                      placeholder="Tell us a little bit about yourself, cybersecurity research, and competitive goals"
                      className="font-sans text-sm resize-none bg-zinc-950 border-white/15 text-white rounded-none focus-visible:border-lime-400 focus-visible:ring-1 focus-visible:ring-lime-400"
                    />
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      You can @mention other cadets and squads to link to them.
                    </p>
                  </div>

                  {/* Pronouns */}
                  <div className="space-y-1.5">
                    <Label htmlFor="s-pronouns" className="text-sm font-medium text-zinc-200">
                      Pronouns
                    </Label>
                    <div className="flex gap-2">
                      <Select value={pronouns} onValueChange={(val) => setPronouns(val)}>
                        <SelectTrigger id="s-pronouns" className="font-sans text-sm bg-zinc-950 border-white/15 text-white rounded-none">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-white/15 text-white rounded-none font-sans text-sm">
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
                          className="font-sans text-sm bg-zinc-950 border-white/15 text-white rounded-none"
                        />
                      )}
                    </div>
                  </div>

                  {/* URL */}
                  <div className="space-y-1.5">
                    <Label htmlFor="s-url" className="text-sm font-medium text-zinc-200">
                      URL
                    </Label>
                    <div className="relative">
                      <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                      <Input
                        id="s-url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://santusht.dev"
                        className="pl-9 font-sans text-sm bg-zinc-950 border-white/15 text-white rounded-none focus-visible:border-lime-400 focus-visible:ring-1 focus-visible:ring-lime-400"
                      />
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Your personal engineering portfolio, laboratory notebook, or research index.
                    </p>
                  </div>

                  {/* Social accounts */}
                  <div className="space-y-2.5">
                    <Label className="text-sm font-medium text-zinc-200 block">
                      Social accounts
                    </Label>
                    <div className="space-y-2">
                      <div className="relative">
                        <Github size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                        <Input
                          value={github}
                          onChange={(e) => setGithub(e.target.value.replace(/^@/, ""))}
                          placeholder="GitHub username (e.g. santusht06)"
                          className="pl-9 font-sans text-sm bg-zinc-950 border-white/15 text-white rounded-none focus-visible:border-lime-400 focus-visible:ring-1 focus-visible:ring-lime-400"
                        />
                      </div>
                      <div className="relative">
                        <Linkedin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-400" />
                        <Input
                          value={linkedin}
                          onChange={(e) => setLinkedin(e.target.value)}
                          placeholder="LinkedIn URL (e.g. https://linkedin.com/in/username)"
                          className="pl-9 font-sans text-sm bg-zinc-950 border-white/15 text-white rounded-none focus-visible:border-lime-400 focus-visible:ring-1 focus-visible:ring-lime-400"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Link your developer identities to display verified badges on your profile.
                    </p>
                  </div>

                  {/* Company */}
                  <div className="space-y-1.5">
                    <Label htmlFor="s-company" className="text-sm font-medium text-zinc-200">
                      Company
                    </Label>
                    <div className="relative">
                      <Building size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                      <Input
                        id="s-company"
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        placeholder="e.g. @Chaos-Computer-Club or Department Lab"
                        className="pl-9 font-sans text-sm bg-zinc-950 border-white/15 text-white rounded-none focus-visible:border-lime-400 focus-visible:ring-1 focus-visible:ring-lime-400"
                      />
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      You can @mention your company&apos;s or research lab&apos;s organization to link it.
                    </p>
                  </div>

                  {/* Location & Local Time */}
                  <div className="space-y-1.5">
                    <Label htmlFor="s-location" className="text-sm font-medium text-zinc-200">
                      Location
                    </Label>
                    <div className="relative">
                      <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                      <Input
                        id="s-location"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="Indore, Madhya Pradesh, India"
                        className="pl-9 font-sans text-sm bg-zinc-950 border-white/15 text-white rounded-none focus-visible:border-lime-400 focus-visible:ring-1 focus-visible:ring-lime-400"
                      />
                    </div>
                    <div className="flex items-start gap-2.5 pt-1">
                      <Checkbox
                        id="s-display-time"
                        checked={displayLocalTime}
                        onCheckedChange={(checked) => setDisplayLocalTime(Boolean(checked))}
                        className="mt-0.5 border-white/20"
                      />
                      <div className="space-y-0.5">
                        <label
                          htmlFor="s-display-time"
                          className="text-xs text-zinc-200 cursor-pointer select-none font-medium"
                        >
                          Display current local time
                        </label>
                        <p className="text-xs text-zinc-400">
                          Other cadets will see the time difference from their local time.{" "}
                          {displayLocalTime && (
                            <span className="text-lime-400 font-medium">
                              Current local time: {currentTimeStr}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* ORCID iD / Institutional Enrollment PRN */}
                  <div className="space-y-1.5">
                    <Label htmlFor="s-orcid" className="text-sm font-medium text-zinc-200">
                      ORCID iD / Institutional PRN
                    </Label>
                    <div className="relative">
                      <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                      <Input
                        id="s-orcid"
                        value={member.prn || "—"}
                        readOnly
                        disabled
                        className="pl-9 font-sans text-sm bg-zinc-950/50 text-zinc-400 border-white/15 rounded-none cursor-not-allowed"
                      />
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      ORCID and Enrollment PRN provide persistent identifiers that distinguish you from other researchers and students.
                    </p>
                  </div>

                  {/* Academic Department & Batch Cohort */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium text-zinc-200">Department</Label>
                      <Select value={department} onValueChange={(val) => setDepartment(val)}>
                        <SelectTrigger className="font-sans text-sm bg-zinc-950 border-white/15 text-white rounded-none">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-white/15 text-white rounded-none font-sans text-sm">
                          <SelectItem value="CSE">CSE (Computer Science & Engineering)</SelectItem>
                          <SelectItem value="IT">IT (Information Technology)</SelectItem>
                          <SelectItem value="AIDS">AIDS (AI & Data Science)</SelectItem>
                          <SelectItem value="Cyber Security">Cyber Security</SelectItem>
                          <SelectItem value="ECE">ECE (Electronics & Comm.)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium text-zinc-200">Graduation Batch</Label>
                      <Select value={batch} onValueChange={(val) => setBatch(val)}>
                        <SelectTrigger className="font-sans text-sm bg-zinc-950 border-white/15 text-white rounded-none">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-white/15 text-white rounded-none font-sans text-sm">
                          <SelectItem value="2022-26">2022–2026</SelectItem>
                          <SelectItem value="2023-27">2023–2027</SelectItem>
                          <SelectItem value="2024-28">2024–2028</SelectItem>
                          <SelectItem value="2025-29">2025–2029</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <p className="text-xs text-zinc-400 italic pt-1 leading-relaxed">
                    All of the fields on this page are optional and can be updated at any time, and by filling them out, you&apos;re giving us consent to share this data wherever your user profile appears.
                  </p>

                  {/* Contributions & activity */}
                  <div className="border-t border-white/10 pt-6 space-y-3.5">
                    <h3 className="text-sm font-semibold text-white">
                      Contributions & activity
                    </h3>

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
                          className="text-sm text-zinc-200 cursor-pointer select-none font-medium"
                        >
                          Make profile private and hide activity
                        </label>
                        <p className="text-xs text-zinc-400 leading-relaxed">
                          Enabling this will hide your contributions and activity from your profile and from social features like followers, rankings, feeds, and releases.
                        </p>
                      </div>
                    </div>

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
                          className="text-sm text-zinc-200 cursor-pointer select-none font-medium"
                        >
                          Include private contributions on my profile
                        </label>
                        <p className="text-xs text-zinc-400 leading-relaxed">
                          Your contribution graph, achievements, and activity overview will show your private practice solves without revealing unreleased contest problem information.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Profile settings */}
                  <div className="border-t border-white/10 pt-6 space-y-3.5">
                    <h3 className="text-sm font-semibold text-white">
                      Profile settings
                    </h3>

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
                          className="text-sm text-zinc-200 cursor-pointer select-none font-medium"
                        >
                          Display PRO badge
                        </label>
                        <p className="text-xs text-zinc-400 leading-relaxed">
                          This will display the Pro / Cadet badge on your public profile page.
                        </p>
                      </div>
                    </div>

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
                          className="text-sm text-zinc-200 cursor-pointer select-none font-medium"
                        >
                          Show Achievements on my profile
                        </label>
                        <p className="text-xs text-zinc-400 leading-relaxed">
                          Your achievements and verified podium finishes will be shown on your profile.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Jobs profile */}
                  <div className="border-t border-white/10 pt-6 space-y-3.5">
                    <h3 className="text-sm font-semibold text-white">
                      Jobs profile
                    </h3>

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
                          className="text-sm text-zinc-200 cursor-pointer select-none font-medium"
                        >
                          Available for hire
                        </label>
                        <p className="text-xs text-zinc-400 leading-relaxed">
                          Signal to campus recruiters, labs, and hackathon squads that you are open to opportunities.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Trending settings */}
                  <div className="border-t border-white/10 pt-6 space-y-3.5">
                    <h3 className="text-sm font-semibold text-white">
                      Trending settings
                    </h3>

                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium text-zinc-200">
                        Preferred spoken & coding language
                      </Label>
                      <Select value={preferredLanguage} onValueChange={(val) => setPreferredLanguage(val)}>
                        <SelectTrigger className="font-sans text-sm bg-zinc-950 border-white/15 text-white rounded-none">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-white/15 text-white rounded-none font-sans text-sm">
                          {LANGUAGES.map((lang) => (
                            <SelectItem key={lang} value={lang}>
                              {lang}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-zinc-400 leading-relaxed">
                        We&apos;ll use this language preference to filter problem recommendations and arena code templates.
                      </p>
                    </div>
                  </div>

                  {/* Primary Update Profile Button */}
                  <div className="pt-3">
                    <Button
                      type="submit"
                      disabled={isUpdatingProfile}
                      className="bg-lime-400 text-black hover:bg-lime-300 font-sans text-sm font-semibold rounded-none px-5 py-2 shadow-xs cursor-pointer"
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

                {/* Right Column: Profile Picture & GitHub-Ready Cool PFPs */}
                <div className="lg:col-span-5 space-y-6">
                  {/* Active PFP Preview Box */}
                  <div className="p-4 bg-zinc-950/60 border border-white/10 rounded-none space-y-4">
                    <Label className="text-sm font-semibold text-white block">
                      Profile picture
                    </Label>

                    {/* Large Square PFP Viewport */}
                    <div className="relative size-48 border border-white/15 bg-zinc-950 rounded-none overflow-hidden flex items-center justify-center shadow-lg">
                      <CyberAvatar avatarUrl={avatarUrl} fallbackText={initials} />

                      {/* Hidden File Input */}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </div>

                    {/* PFP Actions */}
                    <div className="flex flex-col gap-2 max-w-[192px]">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isUploadingImage}
                        onClick={() => fileInputRef.current?.click()}
                        className="font-sans text-xs font-medium border-white/15 bg-zinc-900 hover:bg-zinc-800 text-white rounded-none cursor-pointer w-full justify-center"
                      >
                        {isUploadingImage ? (
                          <>
                            <Loader2 className="animate-spin size-3 mr-1.5" />
                            <span>Uploading...</span>
                          </>
                        ) : (
                          <>
                            <Upload size={13} className="mr-1.5" />
                            <span>Upload photo</span>
                          </>
                        )}
                      </Button>

                      {/* Download PFP for GitHub */}
                      {activeCoolPfp && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => downloadCoolPfp(activeCoolPfp, member.handle || "cadet")}
                          className="font-sans text-xs font-medium border-lime-400/40 bg-lime-400/10 hover:bg-lime-400 hover:text-black text-lime-400 rounded-none cursor-pointer w-full justify-center transition-colors"
                        >
                          <Download size={13} className="mr-1.5" />
                          <span>Download for GitHub</span>
                        </Button>
                      )}

                      {avatarUrl && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleRemovePicture}
                          className="font-sans text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/20 rounded-none cursor-pointer w-full justify-center"
                        >
                          <Trash2 size={13} className="mr-1.5" />
                          <span>Remove picture</span>
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* GitHub-Ready Cool PFPs Gallery */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Sparkles size={14} className="text-lime-400" />
                        <h3 className="text-sm font-semibold text-white">
                          GitHub-Ready Cool PFPs
                        </h3>
                      </div>
                      <Badge variant="outline" className="text-[10px] text-lime-400 border-lime-400/30 font-mono">
                        Vector SVG
                      </Badge>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Select any cool developer avatar to use immediately on CCC and download for your GitHub profile:
                    </p>

                    <div className="grid grid-cols-2 gap-2.5 pt-1">
                      {COOL_PFPS.map((pfp) => {
                        const isSelected = avatarUrl === pfp.id;
                        return (
                          <button
                            key={pfp.id}
                            type="button"
                            onClick={() => handleSelectCoolPfp(pfp)}
                            className={cn(
                              "group relative p-2.5 border rounded-none text-left transition-all cursor-pointer bg-zinc-950/70 hover:bg-zinc-900/90",
                              isSelected
                                ? "border-lime-400 ring-1 ring-lime-400/50 bg-lime-400/5"
                                : "border-white/10 hover:border-zinc-500"
                            )}
                          >
                            <div className="size-14 mx-auto rounded-none overflow-hidden border border-white/10 bg-zinc-900 mb-2">
                              <div
                                className="w-full h-full"
                                dangerouslySetInnerHTML={{ __html: pfp.svgContent }}
                              />
                            </div>
                            <div className="flex items-center justify-between gap-1">
                              <strong className="text-xs font-medium text-white block truncate">
                                {pfp.name}
                              </strong>
                              {isSelected && (
                                <Check size={12} className="text-lime-400 shrink-0" />
                              )}
                            </div>
                            <span className="text-[10px] text-zinc-500 block truncate">
                              {pfp.category}
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
          {/* TAB 2: ACCOUNT (Clean SANS-SERIF Layout)                          */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {activeTab === "account" && (
            <div className="rounded-none border border-white/10 bg-zinc-900/30 p-6 sm:p-8 backdrop-blur-md shadow-xl space-y-8">
              <div className="border-b border-white/10 pb-4">
                <h2 className="text-2xl font-semibold text-white tracking-tight">
                  Account settings
                </h2>
                <p className="text-sm text-zinc-400 mt-1">
                  Manage your handle, institutional verification credentials, and data exports.
                </p>
              </div>

              {/* Change Username / Handle */}
              <div className="space-y-3 max-w-lg">
                <Label htmlFor="acc-handle" className="text-sm font-medium text-zinc-200 block">
                  Change username / handle
                </Label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500 font-mono">
                      @
                    </span>
                    <Input
                      id="acc-handle"
                      value={handleInput}
                      onChange={(e) => setHandleInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                      className={cn(
                        "font-mono text-sm pl-8 bg-zinc-950 border-white/15 text-white rounded-none focus-visible:border-lime-400",
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
                    className="bg-lime-400 text-black hover:bg-lime-300 font-sans text-sm font-semibold rounded-none px-4 shrink-0"
                  >
                    Change handle
                  </Button>
                </div>
                <div className="flex items-center h-4 text-xs">
                  {!isHandleChanged && <span className="text-zinc-500">current handle</span>}
                  {isHandleChanged && handleStatus === "checking" && (
                    <span className="text-lime-400 flex items-center gap-1 font-mono">
                      <Loader2 className="animate-spin size-3" /> checking availability...
                    </span>
                  )}
                  {isHandleChanged && handleStatus === "available" && (
                    <span className="text-emerald-400 flex items-center gap-1 font-medium">
                      <Check size={12} /> available
                    </span>
                  )}
                  {isHandleChanged && handleStatus === "taken" && (
                    <span className="text-rose-400 flex items-center gap-1 font-medium">
                      <X size={12} /> handle is taken
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Changing your username will redirect your public profile link (<code>/u/{member.handle}</code>).
                </p>
              </div>

              {/* Institutional Registration Locks */}
              <div className="border-t border-white/10 pt-6 space-y-4">
                <h3 className="text-sm font-semibold text-white">
                  Institutional Identifiers
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
                  <div>
                    <Label className="text-xs font-medium text-zinc-400">Enrollment PRN</Label>
                    <Input
                      value={member.prn || "—"}
                      readOnly
                      disabled
                      className="font-mono text-xs bg-zinc-950/50 text-zinc-400 cursor-not-allowed border-white/15 rounded-none mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-zinc-400">Registered Institutional Email</Label>
                    <Input
                      value={member.email || "—"}
                      readOnly
                      disabled
                      className="font-mono text-xs bg-zinc-950/50 text-zinc-400 cursor-not-allowed border-white/15 rounded-none mt-1"
                    />
                  </div>
                </div>
              </div>

              {/* Export Account Data */}
              <div className="border-t border-white/10 pt-6 space-y-3">
                <h3 className="text-sm font-semibold text-white">
                  Export account data
                </h3>
                <p className="text-xs text-zinc-400 max-w-md leading-relaxed">
                  Export all your personal profile records, contest participation ledger, rating milestones, and preferences as JSON.
                </p>
                <Button
                  type="button"
                  onClick={handleExportData}
                  variant="outline"
                  className="font-sans text-xs font-medium border-white/15 rounded-none text-zinc-200 hover:text-white bg-zinc-950 cursor-pointer"
                >
                  <Download size={13} className="mr-1.5" /> Start export
                </Button>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* TAB 3: CONTEST & WORKSPACE PREFERENCES (Clean SANS Layout)       */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {activeTab === "workspace" && (
            <div className="rounded-none border border-white/10 bg-zinc-900/30 p-6 sm:p-8 backdrop-blur-md shadow-xl space-y-8">
              <div className="border-b border-white/10 pb-4">
                <h2 className="text-2xl font-semibold text-white tracking-tight">
                  Contest & Workspace Preferences
                </h2>
                <p className="text-sm text-zinc-400 mt-1">
                  Configure your code editor defaults, compiler language, and arena telemetry sound effects.
                </p>
              </div>

              {/* Default Judge Language */}
              <div className="space-y-1.5 max-w-md">
                <Label className="text-sm font-medium text-zinc-200">
                  Default Judge Language
                </Label>
                <Select value={defaultJudgeLang} onValueChange={(val) => setDefaultJudgeLang(val)}>
                  <SelectTrigger className="font-sans text-sm bg-zinc-950 border-white/15 text-white rounded-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-white/15 text-white rounded-none font-sans text-sm">
                    <SelectItem value="C++20 (GCC 13.2)">C++20 (GCC 13.2 with -O3)</SelectItem>
                    <SelectItem value="Python 3.12 (CPython)">Python 3.12 (CPython)</SelectItem>
                    <SelectItem value="Java 21 (OpenJDK)">Java 21 (OpenJDK)</SelectItem>
                    <SelectItem value="Rust 1.78">Rust 1.78 (2021 Edition)</SelectItem>
                    <SelectItem value="Go 1.22">Go 1.22</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-zinc-400">
                  Pre-selected when launching into proctored battles and problem archive.
                </p>
              </div>

              {/* Editor Keybindings */}
              <div className="space-y-1.5 max-w-md">
                <Label className="text-sm font-medium text-zinc-200">
                  Editor Keybindings
                </Label>
                <Select value={editorKeybindings} onValueChange={(val) => setEditorKeybindings(val)}>
                  <SelectTrigger className="font-sans text-sm bg-zinc-950 border-white/15 text-white rounded-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-white/15 text-white rounded-none font-sans text-sm">
                    <SelectItem value="standard">Standard (VS Code default)</SelectItem>
                    <SelectItem value="vim">Vim Mode</SelectItem>
                    <SelectItem value="emacs">Emacs Mode</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Audio feedback & telemetry */}
              <div className="border-t border-white/10 pt-6 space-y-4 max-w-xl">
                <h3 className="text-sm font-semibold text-white">
                  Auditory Telemetry
                </h3>
                <div className="divide-y divide-white/5">
                  <div className="py-3 flex items-center justify-between gap-4">
                    <div>
                      <strong className="text-sm font-medium text-white block">Verdict Chime</strong>
                      <span className="text-xs text-zinc-400 block mt-0.5">
                        Audio chime on Accepted or Rejected test execution.
                      </span>
                    </div>
                    <Switch checked={soundVerdict} onCheckedChange={(val) => setSoundVerdict(val)} />
                  </div>
                  <div className="py-3 flex items-center justify-between gap-4">
                    <div>
                      <strong className="text-sm font-medium text-white block">Timer Warning Pulse</strong>
                      <span className="text-xs text-zinc-400 block mt-0.5">
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
                  className="bg-lime-400 text-black hover:bg-lime-300 font-sans text-sm font-semibold rounded-none px-5 py-2"
                >
                  Save workspace preferences
                </Button>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* TAB 4: SECURITY & SESSIONS (Clean SANS Layout)                   */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {activeTab === "security" && (
            <div className="rounded-none border border-white/10 bg-zinc-900/30 p-6 sm:p-8 backdrop-blur-md shadow-xl space-y-8">
              <div className="border-b border-white/10 pb-4">
                <h2 className="text-2xl font-semibold text-white tracking-tight">
                  Authentication & Sessions
                </h2>
                <p className="text-sm text-zinc-400 mt-1">
                  Manage connected single sign-on credentials, notification delivery, and active terminal sessions.
                </p>
              </div>

              {/* Connected Accounts */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-white">
                  Connected Single Sign-On
                </h3>
                <div className="p-4 bg-zinc-950 border border-white/15 flex items-center justify-between gap-4 max-w-xl">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-none bg-zinc-900 border border-white/15 flex items-center justify-center font-bold text-xs text-white">
                      G
                    </div>
                    <div>
                      <strong className="text-sm font-medium text-white block">Google Workspace SSO</strong>
                      <span className="text-xs text-zinc-400">{member.email}</span>
                    </div>
                  </div>
                  <Badge variant="outline" className="font-sans text-xs text-emerald-400 border-emerald-500/40 bg-emerald-950/20 rounded-none">
                    CONNECTED
                  </Badge>
                </div>
              </div>

              {/* Notification Preferences */}
              <div className="border-t border-white/10 pt-6 space-y-4 max-w-xl">
                <h3 className="text-sm font-semibold text-white">
                  Notification Delivery
                </h3>
                <div className="divide-y divide-white/5">
                  <div className="py-3 flex items-center justify-between gap-4">
                    <div>
                      <strong className="text-sm font-medium text-white block">Contest Announcements</strong>
                      <span className="text-xs text-zinc-400 block mt-0.5">
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
                      <strong className="text-sm font-medium text-white block">Rating & Standings Updates</strong>
                      <span className="text-xs text-zinc-400 block mt-0.5">
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
                <h3 className="text-sm font-semibold text-white">
                  Active Terminal Session
                </h3>
                <div className="flex items-start justify-between gap-4 p-4 bg-zinc-950 border border-white/15">
                  <div className="flex items-start gap-3">
                    <Laptop className="size-5 text-lime-400 mt-0.5" />
                    <div>
                      <strong className="text-sm font-medium text-white block">
                        {typeof window !== "undefined" ? window.navigator.platform || "Workstation Session" : "Workstation Session"}
                      </strong>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        Stateless HMAC-SHA256 JWT · Stored in Local Session Storage
                      </p>
                      <span className="inline-flex items-center gap-1.5 mt-2 text-xs text-emerald-400 font-medium">
                        <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        ACTIVE NOW
                      </span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="font-sans text-xs font-medium border-white/15 rounded-none text-zinc-300 hover:text-white"
                    onClick={() => logout()}
                  >
                    <LogOut size={13} className="mr-1.5" /> Log Out
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* TAB 5: DANGER ZONE (Clean SANS Layout)                            */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {activeTab === "danger" && (
            <div className="rounded-none border border-rose-500/30 bg-rose-950/10 p-6 sm:p-8 backdrop-blur-md shadow-xl space-y-6">
              <div className="flex items-start gap-3 border-b border-rose-500/20 pb-4">
                <AlertTriangle className="size-6 text-rose-500 shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-lg font-semibold text-rose-200">
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
                  <strong className="text-xs text-rose-200 block font-medium">Irrevocable purge action</strong>
                  <span className="text-xs text-rose-300/70">
                    Requires explicit confirmation of your handle (@{member.handle || "user"}).
                  </span>
                </div>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      className="font-sans text-xs font-medium rounded-none bg-rose-600 hover:bg-rose-700 text-white shadow-md cursor-pointer"
                    >
                      <Trash2 size={14} className="mr-1.5" /> Delete Account
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="border-rose-500/50 bg-zinc-950 text-white rounded-none font-sans">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-base font-semibold text-rose-400 flex items-center gap-2">
                        <ShieldAlert className="size-5 text-rose-500" />
                        Confirm Account Deletion
                      </AlertDialogTitle>
                      <AlertDialogDescription className="text-xs text-zinc-400 leading-relaxed space-y-2">
                        <p>
                          This will permanently delete <strong className="text-white">@{member.handle}</strong> and all associated records.
                        </p>
                        <p>
                          To confirm, please type your handle <code className="text-lime-400 bg-zinc-900 px-1.5 py-0.5 rounded-none border border-white/10 font-mono">{member.handle}</code> below:
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
                        className="font-sans text-xs rounded-none border-white/15"
                      >
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        disabled={deleteConfirmText.trim().toLowerCase() !== member.handle?.toLowerCase() || isDeleting}
                        onClick={handleDeleteAccount}
                        className="font-sans text-xs rounded-none bg-rose-600 hover:bg-rose-700 text-white font-medium disabled:opacity-50"
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
      <footer className="pt-10 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
        <div>
          © 2026 Chaos Computer Club India — Medi-Caps Chapter. All rights reserved.
        </div>
        <div className="flex items-center gap-5 flex-wrap">
          <Link to="/portal" className="hover:text-zinc-300 transition-colors">Portal</Link>
          <Link to="/portal/contests" className="hover:text-zinc-300 transition-colors">Contests</Link>
          <Link to="/portal/leaderboard" className="hover:text-zinc-300 transition-colors">Leaderboard</Link>
          <Link to="/portal/verify" className="hover:text-zinc-300 transition-colors">Cryptographic Proofs</Link>
          <a
            href="https://github.com/chaoscomputerclub"
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
