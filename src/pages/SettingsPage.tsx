/**
 * Chaos Computer Club India — Medi-Caps Chapter
 * Settings Page — Profile Configuration, Security & Account Lifecycle.
 * Restored previous 3-tab architecture with clean SANS-SERIF typography,
 * MinIO avatar upload, and empty initials fallback.
 */

import React, { useEffect, useState, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  Camera,
  Check,
  Download,
  ExternalLink,
  Github,
  Laptop,
  Linkedin,
  Loader2,
  Lock,
  LogOut,
  ShieldAlert,
  ShieldCheck,
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
import { PageHeader } from "@/organization/components/ui";
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
import { Badge } from "@/components/ui/badge";
import { SettingsSkeleton } from "@/organization/components/skeletons";

const DEPARTMENTS = [
  "CSE (Computer Science & Engineering)",
  "IT (Information Technology)",
  "AIDS (AI & Data Science)",
  "Cyber Security",
  "CSBS (Computer Science & Business)",
  "ECE (Electronics & Communication)",
  "Other",
];

const BATCHES = ["2022-26", "2023-27", "2024-28", "2025-29", "Alumni / Special"];

type SettingsTab = "profile" | "account" | "danger";

export function SettingsPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [searchParams, setSearchParams] = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const member = useAppSelector((state) => state.auth.member);
  const handleStatus = useAppSelector((state) => state.auth.handleStatus);

  // Tab navigation state (?tab=profile | account | danger)
  const currentTabParam = searchParams.get("tab") as SettingsTab;
  const activeTab: SettingsTab =
    currentTabParam && ["profile", "account", "danger"].includes(currentTabParam)
      ? currentTabParam
      : "profile";

  const setActiveTab = (tab: SettingsTab) => {
    setSearchParams({ tab });
  };

  // Local form state
  const [fullName, setFullName] = useState("");
  const [handleInput, setHandleInput] = useState("");
  const [bio, setBio] = useState("");
  const [department, setDepartment] = useState("CSE");
  const [batch, setBatch] = useState("2023-27");
  const [github, setGithub] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  // Loading & feedback states
  const [saveStatus, setSaveStatus] = useState<Record<string, "idle" | "saving" | "saved" | "error">>({});
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Notification toggles
  const [notifContests, setNotifContests] = useState(true);
  const [notifRatings, setNotifRatings] = useState(true);

  // Auth Guard
  useEffect(() => {
    if (!isAuthenticated()) {
      navigate("/auth", { replace: true });
    }
  }, [navigate]);

  // Sync member profile into form state
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
    }
  }, [member]);

  // Compute initials (Firstname initial + Lastname initial)
  const initials = fullName
    ? fullName
        .trim()
        .split(" ")
        .filter(Boolean)
        .map((w: string) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : (member?.handle?.slice(0, 2) || "CC").toUpperCase();

  // Debounced handle check for username changes
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

  const setFieldStatus = (field: string, status: "idle" | "saving" | "saved" | "error") => {
    setSaveStatus((prev) => ({ ...prev, [field]: status }));
    if (status === "saved") {
      setTimeout(() => {
        setSaveStatus((prev) => ({ ...prev, [field]: "idle" }));
      }, 2500);
    }
  };

  // Save single field helper
  const handleSaveField = async (field: string, value: any) => {
    if (!member) return;
    setFieldStatus(field, "saving");
    try {
      const payload: Record<string, any> = {};
      payload[field] = value;
      await dispatch(updateProfileThunk(payload)).unwrap();
      dispatch(fetchCurrentUserThunk());
      invalidateFullProfileCache();
      setFieldStatus(field, "saved");
      toast.success("Saved successfully.");
    } catch (err: any) {
      setFieldStatus(field, "error");
      toast.error(err || `Failed to update ${field}.`);
    }
  };

  // Save full profile
  const handleSaveAllProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!fullName.trim() || fullName.trim().length < 2) {
      toast.error("Full name must be at least 2 characters.");
      return;
    }

    setIsSavingAll(true);
    try {
      await dispatch(
        updateProfileThunk({
          full_name: fullName.trim(),
          department,
          batch,
          bio: bio.trim(),
          github_username: github.trim().replace(/^@/, ""),
          linkedin_url: linkedin.trim(),
          avatar_url: avatarUrl.trim(),
        })
      ).unwrap();

      dispatch(fetchCurrentUserThunk());
      invalidateFullProfileCache();
      toast.success("Profile saved successfully!");
    } catch (err: any) {
      toast.error(err || "Failed to update profile.");
    } finally {
      setIsSavingAll(false);
    }
  };

  // MinIO Photo Upload
  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = "";

    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file (PNG, JPG, WebP, GIF).");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File exceeds 10MB limit. Please choose a smaller image.");
      return;
    }

    setIsUploadingAvatar(true);
    const toastId = toast.loading("Uploading photo to MinIO storage...");

    try {
      const res = await uploadMedia(file, "avatars");
      setAvatarUrl(res.public_url);
      await dispatch(updateProfileThunk({ avatar_url: res.public_url })).unwrap();
      dispatch(fetchCurrentUserThunk());
      invalidateFullProfileCache();
      toast.success("Profile photo uploaded and saved!", { id: toastId });
    } catch (err: any) {
      toast.error(err.message || "Failed to upload image.", { id: toastId });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // Remove Photo -> Reverts to firstname + lastname initials placeholder
  const handleRemovePhoto = async () => {
    setAvatarUrl("");
    try {
      await dispatch(updateProfileThunk({ avatar_url: "" })).unwrap();
      dispatch(fetchCurrentUserThunk());
      invalidateFullProfileCache();
      toast.info("Photo removed. Initial placeholder is now active.");
    } catch (err: any) {
      toast.error(err || "Failed to remove photo.");
    }
  };

  // Save Handle Alias
  const handleSaveHandle = async () => {
    const clean = handleInput.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (!clean || clean.length < 3 || clean === member?.handle) return;
    if (handleStatus === "taken") {
      toast.error("This handle is already taken. Please pick another.");
      return;
    }
    setFieldStatus("handle", "saving");
    try {
      await dispatch(updateProfileThunk({ handle: clean })).unwrap();
      dispatch(fetchCurrentUserThunk());
      invalidateFullProfileCache();
      setFieldStatus("handle", "saved");
      toast.success("Handle updated successfully.");
    } catch (err: any) {
      setFieldStatus("handle", "error");
      toast.error(err?.message || "Failed to update handle.");
    }
  };

  // Export Account Data as JSON
  const handleExportData = () => {
    if (!member) return;
    const exportData = {
      timestamp: new Date().toISOString(),
      platform: "Chaos Computer Club India — Medi-Caps Chapter",
      cadet: {
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
        bio: member.bio,
        github_username: member.github_username,
        linkedin_url: member.linkedin_url,
      },
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = `ccc-medicaps-profile-${member.handle || "cadet"}.json`;
    a.click();
    URL.revokeObjectURL(downloadUrl);
    toast.success("Profile dossier exported as JSON.");
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

  if (!member) {
    return <SettingsSkeleton />;
  }

  return (
    <div className="font-sans max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 text-zinc-100">
      {/* ── RESTORED HEADER BANNER ────────────────────────────────────────── */}
      <PageHeader
        kicker="06 // Configuration"
        index="INDEX 6.0 · PREFS & SECURITY"
        badge={
          <span className="inline-flex items-center gap-1.5 rounded-none border border-lime-400/30 bg-lime-400/10 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-lime-400">
            Member Configuration & Security
          </span>
        }
        title="Settings"
        description="Manage your verified identity, campus attribution, account credentials, and workstation sessions."
        action={
          <Button
            asChild
            variant="outline"
            size="sm"
            className="font-sans text-xs text-zinc-300 hover:text-white border-white/15 bg-zinc-900/60 rounded-none cursor-pointer"
          >
            <Link to="/portal/profile">
              <span>View Public Profile</span>
              <ExternalLink size={12} className="ml-1.5 opacity-70" />
            </Link>
          </Button>
        }
      />

      {/* ── RESTORED PREVIOUS 3-TAB ARCHITECTURE ──────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
        {/* Left Sub-navigation Sidebar */}
        <nav className="flex flex-row md:flex-col gap-2 overflow-x-auto" aria-label="Settings navigation">
          <button
            type="button"
            className={cn(
              "flex items-center gap-2.5 px-4 py-3 font-sans text-xs uppercase tracking-wider text-left border rounded-none transition-all cursor-pointer",
              activeTab === "profile"
                ? "bg-lime-400 text-black border-lime-400 font-bold shadow-md shadow-lime-400/20"
                : "border-white/10 bg-zinc-900/60 text-zinc-400 hover:text-white hover:border-white/20"
            )}
            onClick={() => setActiveTab("profile")}
          >
            <UserRound size={15} />
            <span>Profile</span>
          </button>
          <button
            type="button"
            className={cn(
              "flex items-center gap-2.5 px-4 py-3 font-sans text-xs uppercase tracking-wider text-left border rounded-none transition-all cursor-pointer",
              activeTab === "account"
                ? "bg-lime-400 text-black border-lime-400 font-bold shadow-md shadow-lime-400/20"
                : "border-white/10 bg-zinc-900/60 text-zinc-400 hover:text-white hover:border-white/20"
            )}
            onClick={() => setActiveTab("account")}
          >
            <ShieldCheck size={15} />
            <span>Account & Security</span>
          </button>
          <button
            type="button"
            className={cn(
              "flex items-center gap-2.5 px-4 py-3 font-sans text-xs uppercase tracking-wider text-left border rounded-none transition-all cursor-pointer",
              activeTab === "danger"
                ? "bg-rose-950/80 text-rose-300 border-rose-500/60 font-bold shadow-md shadow-rose-950/40"
                : "border-white/10 bg-zinc-900/60 text-rose-400 hover:border-rose-800/60 hover:bg-rose-950/20"
            )}
            onClick={() => setActiveTab("danger")}
          >
            <AlertTriangle size={15} />
            <span>Danger Zone</span>
          </button>
        </nav>

        {/* Right Settings Panel */}
        <div className="md:col-span-3 space-y-6">
          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* TAB 1: PROFILE SETTINGS                                          */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {activeTab === "profile" && (
            <div className="space-y-6">
              {/* Profile Photo (MinIO Upload & Initials Fallback) */}
              <div className="rounded-none border border-white/10 bg-zinc-900/60 p-6 md:p-8 space-y-5 backdrop-blur-md shadow-xl">
                <div>
                  <h3 className="text-base font-sans font-bold text-white uppercase tracking-tight">
                    Profile Photo
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    Upload a custom photo stored securely in MinIO object storage, or display your name initials.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-5 p-4 bg-zinc-950 border border-white/10">
                  <Avatar className="size-20 rounded-none border border-white/15 bg-zinc-900 shrink-0 shadow-md">
                    {avatarUrl ? (
                      <AvatarImage src={avatarUrl} alt={fullName} className="object-cover" />
                    ) : null}
                    <AvatarFallback className="rounded-none bg-lime-400/10 text-lime-400 font-mono font-bold text-2xl flex items-center justify-center w-full h-full">
                      {initials}
                    </AvatarFallback>
                  </Avatar>

                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isUploadingAvatar}
                        onClick={() => fileInputRef.current?.click()}
                        className="font-sans text-xs font-medium border-white/15 bg-zinc-900 hover:bg-zinc-800 text-white rounded-none cursor-pointer"
                      >
                        {isUploadingAvatar ? (
                          <>
                            <Loader2 size={13} className="animate-spin mr-1.5" />
                            <span>Uploading to MinIO...</span>
                          </>
                        ) : (
                          <>
                            <Upload size={13} className="mr-1.5 text-lime-400" />
                            <span>Upload New Photo</span>
                          </>
                        )}
                      </Button>

                      {avatarUrl && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleRemovePhoto}
                          className="font-sans text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/20 rounded-none cursor-pointer"
                        >
                          <Trash2 size={13} className="mr-1" />
                          <span>Remove Photo</span>
                        </Button>
                      )}
                    </div>

                    <p className="text-xs text-zinc-400 leading-relaxed">
                      {avatarUrl ? (
                        <span className="text-emerald-400 flex items-center gap-1 font-mono text-[11px]">
                          <Check size={12} /> Custom photo active in MinIO storage.
                        </span>
                      ) : (
                        <span>
                          No photo uploaded. Showing empty placeholder with firstname and lastname initials:{" "}
                          <strong className="text-lime-400 font-mono">{initials}</strong>.
                        </span>
                      )}
                    </p>
                    <span className="text-[11px] text-zinc-500 block">
                      Supported formats: PNG, JPG, WebP, GIF (Max 10MB)
                    </span>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={handleAvatarFileChange}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Competitive Identity */}
              <div className="rounded-none border border-white/10 bg-zinc-900/60 p-6 md:p-8 space-y-5 backdrop-blur-md shadow-xl">
                <div>
                  <h3 className="text-base font-sans font-bold text-white uppercase tracking-tight">
                    Competitive Identity
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    Your public identifier and competitive bio displayed on leaderboard rankings and member dossiers.
                  </p>
                </div>

                {/* Full Name */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="s-fullname" className="font-sans text-xs font-semibold text-zinc-300">
                      Full Name <span className="text-lime-400">*</span>
                    </Label>
                    {saveStatus["full_name"] === "saving" && (
                      <span className="font-mono text-[10px] text-lime-400 flex items-center gap-1">
                        <Loader2 className="animate-spin size-3" /> saving...
                      </span>
                    )}
                    {saveStatus["full_name"] === "saved" && (
                      <span className="font-mono text-[10px] text-emerald-400 flex items-center gap-1">
                        <Check size={12} /> Saved ✓
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      id="s-fullname"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveField("full_name", fullName.trim());
                      }}
                      className="font-sans text-sm bg-zinc-950 border-white/15 text-white rounded-none focus-visible:border-lime-400"
                      placeholder="e.g. Ada Lovelace"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="font-sans text-xs uppercase border-white/15 rounded-none shrink-0"
                      disabled={saveStatus["full_name"] === "saving" || fullName.trim() === (member?.full_name || "")}
                      onClick={() => handleSaveField("full_name", fullName.trim())}
                    >
                      Save
                    </Button>
                  </div>
                </div>

                {/* Bio */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="s-bio" className="font-sans text-xs font-semibold text-zinc-300">
                      Bio / Competitive Focus
                    </Label>
                    <span className="text-[11px] text-zinc-500 tabular-nums">{bio.length}/500</span>
                  </div>
                  <Textarea
                    id="s-bio"
                    value={bio}
                    maxLength={500}
                    onChange={(e) => setBio(e.target.value)}
                    rows={3}
                    placeholder="Competitive programmer, learning graph algorithms, CSE undergraduate at Medi-Caps..."
                    className="font-sans text-xs resize-none bg-zinc-950 border-white/15 text-white rounded-none focus-visible:border-lime-400"
                  />
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="font-sans text-xs uppercase border-white/15 rounded-none"
                      disabled={saveStatus["bio"] === "saving" || bio.trim() === (member?.bio || "")}
                      onClick={() => handleSaveField("bio", bio.trim())}
                    >
                      Save Bio
                    </Button>
                  </div>
                </div>
              </div>

              {/* Academic Details */}
              <div className="rounded-none border border-white/10 bg-zinc-900/60 p-6 md:p-8 space-y-5 backdrop-blur-md shadow-xl">
                <div>
                  <h3 className="text-base font-sans font-bold text-white uppercase tracking-tight">
                    Academic Attribution
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    Your institutional department, branch, and graduation cohort.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-sans text-xs font-semibold text-zinc-300">
                      Department / Branch
                    </Label>
                    <Select
                      value={department}
                      onValueChange={(val) => {
                        setDepartment(val);
                        void handleSaveField("department", val);
                      }}
                    >
                      <SelectTrigger className="font-sans text-xs bg-zinc-950 border-white/15 text-white rounded-none">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-white/15 text-white rounded-none">
                        {DEPARTMENTS.map((d) => (
                          <SelectItem key={d} value={d.split(" ")[0]} className="font-sans text-xs">
                            {d}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="font-sans text-xs font-semibold text-zinc-300">
                      Graduation Batch
                    </Label>
                    <Select
                      value={batch}
                      onValueChange={(val) => {
                        setBatch(val);
                        void handleSaveField("batch", val);
                      }}
                    >
                      <SelectTrigger className="font-sans text-xs bg-zinc-950 border-white/15 text-white rounded-none">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-white/15 text-white rounded-none">
                        {BATCHES.map((b) => (
                          <SelectItem key={b} value={b} className="font-sans text-xs">
                            {b}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Locked Institutional Registrations */}
                <div className="pt-4 border-t border-white/10 space-y-3">
                  <div className="flex items-center gap-2 text-xs text-zinc-400 font-sans font-medium">
                    <Lock size={13} className="text-zinc-500" />
                    <span>Locked Institutional Registrations (Verified by Medi-Caps)</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="font-sans text-[10px] uppercase text-zinc-500">
                        Enrollment PRN
                      </Label>
                      <Input
                        value={member?.prn || "—"}
                        readOnly
                        disabled
                        className="font-mono text-xs bg-zinc-950/40 text-zinc-400 cursor-not-allowed border-white/10 rounded-none mt-1"
                      />
                    </div>
                    <div>
                      <Label className="font-sans text-[10px] uppercase text-zinc-500">
                        Institutional Email Address
                      </Label>
                      <Input
                        value={member?.email || ""}
                        readOnly
                        disabled
                        className="font-mono text-xs bg-zinc-950/40 text-zinc-400 cursor-not-allowed border-white/10 rounded-none mt-1"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Developer & Social Links */}
              <div className="rounded-none border border-white/10 bg-zinc-900/60 p-6 md:p-8 space-y-5 backdrop-blur-md shadow-xl">
                <div>
                  <h3 className="text-base font-sans font-bold text-white uppercase tracking-tight">
                    Developer & Social Links
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    Connect your GitHub and LinkedIn profiles to display on your verified cadet dossier.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* GitHub */}
                  <div className="space-y-2">
                    <Label htmlFor="s-github" className="font-sans text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                      <Github size={13} /> GitHub Handle
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="s-github"
                        value={github}
                        onChange={(e) => setGithub(e.target.value.replace(/^@/, ""))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveField("github_username", github.trim());
                        }}
                        placeholder="octocat"
                        className="font-sans text-xs bg-zinc-950 border-white/15 text-white rounded-none focus-visible:border-lime-400"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="font-sans text-xs uppercase border-white/15 rounded-none shrink-0"
                        disabled={saveStatus["github_username"] === "saving" || github.trim() === (member?.github_username || "")}
                        onClick={() => handleSaveField("github_username", github.trim())}
                      >
                        Save
                      </Button>
                    </div>
                  </div>

                  {/* LinkedIn */}
                  <div className="space-y-2">
                    <Label htmlFor="s-linkedin" className="font-sans text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                      <Linkedin size={13} className="text-cyan-400" /> LinkedIn Profile
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="s-linkedin"
                        value={linkedin}
                        onChange={(e) => setLinkedin(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveField("linkedin_url", linkedin.trim());
                        }}
                        placeholder="https://linkedin.com/in/username"
                        className="font-sans text-xs bg-zinc-950 border-white/15 text-white rounded-none focus-visible:border-lime-400"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="font-sans text-xs uppercase border-white/15 rounded-none shrink-0"
                        disabled={saveStatus["linkedin_url"] === "saving" || linkedin.trim() === (member?.linkedin_url || "")}
                        onClick={() => handleSaveField("linkedin_url", linkedin.trim())}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Master Save Button */}
              <div className="flex justify-end pt-2">
                <Button
                  type="button"
                  disabled={isSavingAll || isUploadingAvatar}
                  onClick={() => handleSaveAllProfile()}
                  className="font-sans px-6 py-2.5 bg-lime-400 text-black hover:bg-lime-300 font-bold text-xs uppercase tracking-wider rounded-none shadow-md shadow-lime-400/20 cursor-pointer flex items-center gap-2"
                >
                  {isSavingAll ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      <span>Save All Profile Changes</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* TAB 2: ACCOUNT & SECURITY                                        */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {activeTab === "account" && (
            <div className="space-y-6">
              {/* Username / Handle Alias */}
              <div className="rounded-none border border-white/10 bg-zinc-900/60 p-6 md:p-8 space-y-4 backdrop-blur-md shadow-xl">
                <div>
                  <h3 className="text-base font-sans font-bold text-white uppercase tracking-tight">
                    Username / Handle Alias
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    Your unique campus handle used in battle telemetry, arena submissions, and rankings.
                  </p>
                </div>

                <div className="space-y-2 max-w-md">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 font-mono">
                        @
                      </span>
                      <Input
                        id="acc-handle"
                        value={handleInput}
                        onChange={(e) => setHandleInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                        className={cn(
                          "font-mono text-xs pl-8 bg-zinc-950 border-white/15 text-white rounded-none focus-visible:border-lime-400",
                          isHandleChanged && handleStatus === "available" && "border-emerald-500/60",
                          isHandleChanged && handleStatus === "taken" && "border-rose-500/60 text-rose-200"
                        )}
                        placeholder="handle"
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      disabled={!isHandleChanged || handleInput.trim().length < 3 || handleStatus !== "available"}
                      onClick={handleSaveHandle}
                      className="bg-lime-400 text-black hover:bg-lime-300 font-semibold text-xs font-sans rounded-none px-4 shrink-0"
                    >
                      Change handle
                    </Button>
                  </div>
                  <div className="flex items-center h-4 text-xs">
                    {!isHandleChanged && <span className="text-zinc-500 text-[11px] font-sans">Current verified handle</span>}
                    {isHandleChanged && handleStatus === "checking" && (
                      <span className="text-lime-400 flex items-center gap-1 text-[11px] font-mono">
                        <Loader2 className="animate-spin size-3" /> checking availability...
                      </span>
                    )}
                    {isHandleChanged && handleStatus === "available" && (
                      <span className="text-emerald-400 flex items-center gap-1 text-[11px] font-sans font-medium">
                        <Check size={12} /> Handle is available
                      </span>
                    )}
                    {isHandleChanged && handleStatus === "taken" && (
                      <span className="text-rose-400 flex items-center gap-1 text-[11px] font-sans font-medium">
                        <X size={12} /> Handle is already taken
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Connected SSO Accounts */}
              <div className="rounded-none border border-white/10 bg-zinc-900/60 p-6 md:p-8 space-y-4 backdrop-blur-md shadow-xl">
                <div>
                  <h3 className="text-base font-sans font-bold text-white uppercase tracking-tight">
                    Connected Single Sign-On (SSO)
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    Institutional authentication provider linked to your Medi-Caps portal account.
                  </p>
                </div>

                <div className="divide-y divide-white/5">
                  <div className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-none bg-zinc-950 border border-white/15 flex items-center justify-center font-bold text-xs text-white">
                        G
                      </div>
                      <div>
                        <strong className="font-sans text-xs font-semibold text-white block">Google Workspace SSO</strong>
                        <span className="font-mono text-[11px] text-zinc-400">{member?.email}</span>
                      </div>
                    </div>
                    <Badge variant="outline" className="font-mono text-[10px] text-emerald-400 border-emerald-500/40 bg-emerald-950/20 rounded-none">
                      CONNECTED
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Notification Preferences */}
              <div className="rounded-none border border-white/10 bg-zinc-900/60 p-6 md:p-8 space-y-4 backdrop-blur-md shadow-xl">
                <div>
                  <h3 className="text-base font-sans font-bold text-white uppercase tracking-tight">
                    Notification Preferences
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    Control contest reminders and rating trajectory announcements sent to your registered email.
                  </p>
                </div>

                <div className="divide-y divide-white/5 font-sans">
                  <div className="py-3 flex items-center justify-between gap-4">
                    <div>
                      <strong className="text-xs font-medium text-white block">Contest Announcements</strong>
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
                      <strong className="text-xs font-medium text-white block">Rating & Standings Updates</strong>
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

              {/* Active Workstation Session */}
              <div className="rounded-none border border-white/10 bg-zinc-900/60 p-6 md:p-8 space-y-4 backdrop-blur-md shadow-xl">
                <div>
                  <h3 className="text-base font-sans font-bold text-white uppercase tracking-tight">
                    Active Session & Security
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    Current terminal device authorization and cryptographic session tokens.
                  </p>
                </div>

                <div className="flex items-start justify-between gap-4 p-4 rounded-none bg-zinc-950 border border-white/10">
                  <div className="flex items-start gap-3">
                    <Laptop className="size-5 text-lime-400 mt-0.5" />
                    <div>
                      <strong className="font-sans text-xs font-semibold text-white block">
                        {typeof window !== "undefined" ? window.navigator.platform || "Workstation Session" : "Workstation Session"}
                      </strong>
                      <p className="font-sans text-[11px] text-zinc-400 mt-0.5">
                        Stateless HMAC-SHA256 JWT Token · Active Now
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
                    className="font-sans text-xs uppercase border-white/15 rounded-none text-zinc-300 hover:text-white"
                    onClick={() => logout()}
                  >
                    <LogOut size={13} className="mr-1.5" /> Log Out
                  </Button>
                </div>
              </div>

              {/* Data Portability */}
              <div className="rounded-none border border-white/10 bg-zinc-900/60 p-6 md:p-8 space-y-4 backdrop-blur-md shadow-xl">
                <div>
                  <h3 className="text-base font-sans font-bold text-white uppercase tracking-tight">
                    Data Portability
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    Download your full contest history, rating trajectory, and profile records.
                  </p>
                </div>

                <Button
                  type="button"
                  onClick={handleExportData}
                  variant="outline"
                  size="sm"
                  className="font-sans text-xs border-white/15 rounded-none text-zinc-200 hover:text-white bg-zinc-950"
                >
                  <Download size={13} className="mr-1.5" /> Export Profile as JSON
                </Button>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════ */}
          {/* TAB 3: DANGER ZONE                                               */}
          {/* ═════════════════════════════════════════════════════════════════ */}
          {activeTab === "danger" && (
            <div className="rounded-none border border-rose-500/40 bg-rose-950/10 p-6 md:p-8 space-y-4 backdrop-blur-md shadow-xl">
              <div className="flex items-start gap-3">
                <AlertTriangle className="size-5 text-rose-500 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-sans text-base font-bold uppercase tracking-tight text-rose-300">
                    Permanent Account Purge
                  </h3>
                  <p className="text-xs text-rose-200/80 leading-relaxed mt-1">
                    Deleting your account is permanent and irreversible. Your competitive rating record,
                    contest submissions, and leaderboard standings will be permanently erased.
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-rose-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <strong className="font-sans text-xs text-rose-200 block">Irrevocable action</strong>
                  <span className="font-sans text-[11px] text-rose-300/70">
                    Requires explicit confirmation of your handle (@{member?.handle || "user"}).
                  </span>
                </div>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      className="font-sans text-xs font-semibold uppercase tracking-wider rounded-none bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-950/50 cursor-pointer"
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
                          This will permanently delete <strong className="text-white">@{member?.handle}</strong> and all associated records.
                        </p>
                        <p>
                          To confirm, please type your handle <code className="text-lime-400 bg-zinc-900 px-1.5 py-0.5 rounded-none border border-white/10 font-mono">{member?.handle}</code> below:
                        </p>
                      </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="my-2">
                      <Input
                        value={deleteConfirmText}
                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                        placeholder={member?.handle || "handle"}
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
                        disabled={deleteConfirmText.trim().toLowerCase() !== member?.handle?.toLowerCase() || isDeleting}
                        onClick={handleDeleteAccount}
                        className="font-sans text-xs rounded-none bg-rose-600 hover:bg-rose-700 text-white font-semibold disabled:opacity-50"
                      >
                        {isDeleting ? <Loader2 className="animate-spin size-4" /> : "Permanently Delete"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
