/**
 * Chaos Computer Club India — Medi-Caps Chapter
 * medicaps.chaoscomputerclub.in
 *
 * Settings Page — Profile Configuration, Security & Account Lifecycle.
 * Follows high-end SaaS settings patterns (persistent sub-nav, inline saves,
 * real-time availability check, danger zone with confirmation dialog).
 */

import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useTransition } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Award,
  Check,
  CheckCircle2,
  ExternalLink,
  Github,
  Globe,
  Info,
  Key,
  Laptop,
  Linkedin,
  Loader2,
  Lock,
  LogOut,
  Mail,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { isAuthenticated, logout, type Member } from "@/lib/auth";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  checkHandleThunk,
  deleteAccountThunk,
  fetchCurrentUserThunk,
  setHandleStatus,
  updateProfileThunk,
} from "@/store/slices/authSlice";
import { invalidateFullProfileCache } from "@/organization/data/queries";
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

export const Route = createFileRoute("/portal/settings")({
  beforeLoad: () => {
    if (typeof window !== "undefined" && !isAuthenticated()) {
      throw redirect({ to: "/auth" });
    }
  },
  head: () => ({
    meta: [
      { title: "Account & Identity Settings — CCC Medi-Caps" },
      {
        name: "description",
        content: "Manage your competitive identity, parameters, connected accounts, and preferences.",
      },
      { property: "og:title", content: "Settings — CCC Medi-Caps" },
      {
        property: "og:description",
        content: "Member account preferences and security configuration.",
      },
    ],
  }),
  component: SettingsPage,
});

const PRESET_EMBLEMS = [
  { id: "volt", label: "Volt", icon: "⚡", bg: "bg-lime-500/10", border: "border-lime-500/40", text: "text-lime-400" },
  { id: "binary", label: "Binary", icon: "👾", bg: "bg-cyan-500/10", border: "border-cyan-500/40", text: "text-cyan-400" },
  { id: "quantum", label: "Quantum", icon: "⚛️", bg: "bg-purple-500/10", border: "border-purple-500/40", text: "text-purple-400" },
  { id: "matrix", label: "Matrix", icon: "💻", bg: "bg-emerald-500/10", border: "border-emerald-500/40", text: "text-emerald-400" },
  { id: "grandmaster", label: "Grandmaster", icon: "🏆", bg: "bg-amber-500/10", border: "border-amber-500/40", text: "text-amber-400" },
  { id: "cipher", label: "Cipher", icon: "🛡️", bg: "bg-rose-500/10", border: "border-rose-500/40", text: "text-rose-400" },
];

type SettingsTab = "profile" | "account" | "danger";

function SettingsPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const member = useAppSelector((state) => state.auth.member);
  const handleStatus = useAppSelector((state) => state.auth.handleStatus);

  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");

  // Local form state
  const [fullName, setFullName] = useState("");
  const [handleInput, setHandleInput] = useState("");
  const [bio, setBio] = useState("");
  const [department, setDepartment] = useState("CSE");
  const [batch, setBatch] = useState("2023-27");
  const [github, setGithub] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  // Inline save feedback states: key -> "idle" | "saving" | "saved" | "error"
  const [saveStatus, setSaveStatus] = useState<Record<string, "idle" | "saving" | "saved" | "error">>({});
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Notification toggles (persisted in local state / localStorage)
  const [notifContests, setNotifContests] = useState(true);
  const [notifRatings, setNotifRatings] = useState(true);
  const [notifBulletins, setNotifBulletins] = useState(false);

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

  const handleSaveField = async (field: string, value: any) => {
    if (!member) return;
    setFieldStatus(field, "saving");
    try {
      const payload: Record<string, any> = {};
      payload[field] = value;
      await dispatch(updateProfileThunk(payload)).unwrap();
      invalidateFullProfileCache();
      queryClient.invalidateQueries({ queryKey: ["portal", "full-profile"] });
      queryClient.invalidateQueries({ queryKey: ["portal", "leaderboard"] });
      setFieldStatus(field, "saved");
    } catch (err: any) {
      setFieldStatus(field, "error");
      toast.error(err || `Failed to update ${field}.`);
    }
  };

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
      invalidateFullProfileCache();
      queryClient.invalidateQueries({ queryKey: ["portal", "full-profile"] });
      queryClient.invalidateQueries({ queryKey: ["portal", "leaderboard"] });
      setFieldStatus("handle", "saved");
      toast.success("Handle updated successfully.");
    } catch (err: any) {
      setFieldStatus("handle", "error");
      toast.error(err || "Failed to update handle.");
    }
  };

  const handleDeleteAccount = async () => {
    if (!member) return;
    setIsDeleting(true);
    try {
      await dispatch(deleteAccountThunk()).unwrap();
      toast.success("Account permanently deleted.");
      window.location.href = "/auth";
    } catch (err: any) {
      setIsDeleting(false);
      toast.error(err || "Failed to delete account.");
    }
  };

  const isHandleChanged = Boolean(member && handleInput.trim().toLowerCase() !== member.handle?.toLowerCase());

  return (
    <div className="settings-container">
      {/* Page Header */}
      <div className="section-heading">
        <div>
          <p className="kicker">MEMBER CONFIGURATION & SECURITY</p>
          <h2>SETTINGS</h2>
        </div>
      </div>

      <div className="settings-grid">
        {/* Left Sub-navigation */}
        <nav className="settings-subnav" aria-label="Settings navigation">
          <button
            type="button"
            className={cn("settings-nav-btn", activeTab === "profile" && "active")}
            onClick={() => setActiveTab("profile")}
          >
            <UserRound size={15} />
            <span>Profile</span>
          </button>
          <button
            type="button"
            className={cn("settings-nav-btn", activeTab === "account" && "active")}
            onClick={() => setActiveTab("account")}
          >
            <ShieldCheck size={15} />
            <span>Account & Security</span>
          </button>
          <button
            type="button"
            className={cn("settings-nav-btn text-rose-400 hover:text-rose-300", activeTab === "danger" && "active border-rose-500/40 text-rose-300")}
            onClick={() => setActiveTab("danger")}
          >
            <AlertTriangle size={15} />
            <span>Danger Zone</span>
          </button>
        </nav>

        {/* Right Settings Panel */}
        <div className="settings-panel">
          {/* TAB 1: PROFILE SETTINGS */}
          {activeTab === "profile" && (
            <div className="space-y-6 animate-in fade-in-50 duration-200">
              {/* Identity Parameters */}
              <div className="settings-card">
                <div className="settings-card-header">
                  <h3 className="settings-card-title">Competitive Identity</h3>
                  <p className="settings-card-desc">
                    Your public identifier, handle alias, and institutional attribution shown on leaderboards.
                  </p>
                </div>

                {/* Full Name */}
                <div className="settings-field">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="s-fullname" className="font-mono text-[0.6875rem] uppercase text-muted-foreground">
                      Full Name
                    </Label>
                    {saveStatus["full_name"] === "saving" && (
                      <span className="save-badge text-accent/80"><Loader2 className="spin size-3" /> saving...</span>
                    )}
                    {saveStatus["full_name"] === "saved" && (
                      <span className="save-badge"><Check size={12} /> Saved ✓</span>
                    )}
                  </div>
                  <div className="settings-field-row">
                    <Input
                      id="s-fullname"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveField("full_name", fullName.trim());
                      }}
                      className="font-mono text-sm h-10"
                      placeholder="Ada Lovelace"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="font-mono text-xs uppercase h-10 px-4 rounded-none cursor-pointer"
                      disabled={saveStatus["full_name"] === "saving" || fullName.trim() === member?.full_name}
                      onClick={() => handleSaveField("full_name", fullName.trim())}
                    >
                      Save
                    </Button>
                  </div>
                </div>

                {/* Username / Handle */}
                <div className="settings-field">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="s-handle" className="font-mono text-[0.6875rem] uppercase text-muted-foreground">
                      Handle / Alias
                    </Label>
                    <div className="flex items-center h-4">
                      {!isHandleChanged && (
                        <span className="text-[0.6875rem] text-muted-foreground font-mono">current handle</span>
                      )}
                      {isHandleChanged && handleStatus === "checking" && (
                        <span className="save-badge text-accent/80"><Loader2 className="spin size-3" /> checking...</span>
                      )}
                      {isHandleChanged && handleStatus === "available" && (
                        <span className="save-badge text-emerald-400"><Check size={12} /> available</span>
                      )}
                      {isHandleChanged && handleStatus === "taken" && (
                        <span className="save-badge text-rose-400"><X size={12} /> handle taken</span>
                      )}
                      {saveStatus["handle"] === "saved" && (
                        <span className="save-badge"><Check size={12} /> Saved ✓</span>
                      )}
                    </div>
                  </div>
                  <div className="settings-field-row">
                    <div className="relative flex-1">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-muted-foreground">
                        @
                      </span>
                      <Input
                        id="s-handle"
                        value={handleInput}
                        onChange={(e) => setHandleInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && isHandleChanged && handleStatus === "available") {
                            void handleSaveHandle();
                          }
                        }}
                        className={cn(
                          "font-mono text-sm h-10 pl-8",
                          isHandleChanged && handleStatus === "available" && "border-emerald-500/60",
                          isHandleChanged && handleStatus === "taken" && "border-rose-500/60 text-rose-200",
                        )}
                        placeholder="ada_core"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="font-mono text-xs uppercase h-10 px-4 rounded-none cursor-pointer"
                      disabled={
                        !isHandleChanged ||
                        handleInput.trim().length < 3 ||
                        handleStatus !== "available" ||
                        saveStatus["handle"] === "saving"
                      }
                      onClick={handleSaveHandle}
                    >
                      {saveStatus["handle"] === "saving" ? <Loader2 className="spin size-3" /> : "Save"}
                    </Button>
                  </div>
                  <p className="text-[0.6875rem] font-mono text-muted-foreground">
                    Changing your handle updates your scoreboard display name and public URL.
                  </p>
                </div>

                {/* Bio */}
                <div className="settings-field">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="s-bio" className="font-mono text-[0.6875rem] uppercase text-muted-foreground">
                      Bio / Tagline
                    </Label>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[0.6875rem] text-muted-foreground">{bio.length}/500</span>
                      {saveStatus["bio"] === "saving" && (
                        <span className="save-badge text-accent/80"><Loader2 className="spin size-3" /> saving...</span>
                      )}
                      {saveStatus["bio"] === "saved" && (
                        <span className="save-badge"><Check size={12} /> Saved ✓</span>
                      )}
                    </div>
                  </div>
                  <Textarea
                    id="s-bio"
                    value={bio}
                    maxLength={500}
                    onChange={(e) => setBio(e.target.value)}
                    rows={3}
                    placeholder="Competitive programmer, cyber enthusiast, CSE undergraduate..."
                    className="font-mono text-xs resize-none"
                  />
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="font-mono text-xs uppercase h-8 px-3 rounded-none cursor-pointer"
                      disabled={saveStatus["bio"] === "saving" || bio.trim() === (member?.bio || "")}
                      onClick={() => handleSaveField("bio", bio.trim())}
                    >
                      Save Bio
                    </Button>
                  </div>
                </div>
              </div>

              {/* Academic & Emblem Parameters */}
              <div className="settings-card">
                <div className="settings-card-header">
                  <h3 className="settings-card-title">Academic & Cyber Visuals</h3>
                  <p className="settings-card-desc">
                    Your institutional affiliation, graduation cohort, and customized emblem.
                  </p>
                </div>

                {/* Department & Batch */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="settings-field">
                    <div className="flex items-center justify-between">
                      <Label className="font-mono text-[0.6875rem] uppercase text-muted-foreground">
                        Department
                      </Label>
                      {saveStatus["department"] === "saved" && (
                        <span className="save-badge"><Check size={12} /> Saved ✓</span>
                      )}
                    </div>
                    <Select
                      value={department}
                      onValueChange={(val) => {
                        setDepartment(val);
                        void handleSaveField("department", val);
                      }}
                    >
                      <SelectTrigger className="font-mono text-xs h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CSE">CSE (Computer Science & Engineering)</SelectItem>
                        <SelectItem value="IT">IT (Information Technology)</SelectItem>
                        <SelectItem value="AIDS">AIDS (AI & Data Science)</SelectItem>
                        <SelectItem value="Cyber Security">Cyber Security</SelectItem>
                        <SelectItem value="ECE">ECE (Electronics & Comm.)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="settings-field">
                    <div className="flex items-center justify-between">
                      <Label className="font-mono text-[0.6875rem] uppercase text-muted-foreground">
                        Graduation Batch
                      </Label>
                      {saveStatus["batch"] === "saved" && (
                        <span className="save-badge"><Check size={12} /> Saved ✓</span>
                      )}
                    </div>
                    <Select
                      value={batch}
                      onValueChange={(val) => {
                        setBatch(val);
                        void handleSaveField("batch", val);
                      }}
                    >
                      <SelectTrigger className="font-mono text-xs h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2022-26">2022–2026</SelectItem>
                        <SelectItem value="2023-27">2023–2027</SelectItem>
                        <SelectItem value="2024-28">2024–2028</SelectItem>
                        <SelectItem value="2025-29">2025–2029</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Preset Emblem Selector */}
                <div className="settings-field">
                  <div className="flex items-center justify-between">
                    <Label className="font-mono text-[0.6875rem] uppercase text-muted-foreground">
                      Cyber Profile Emblem
                    </Label>
                    {saveStatus["avatar_url"] === "saved" && (
                      <span className="save-badge"><Check size={12} /> Saved ✓</span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5 pt-1">
                    {PRESET_EMBLEMS.map((emblem) => {
                      const isSelected = avatarUrl === emblem.id;
                      return (
                        <button
                          key={emblem.id}
                          type="button"
                          onClick={() => {
                            setAvatarUrl(emblem.id);
                            void handleSaveField("avatar_url", emblem.id);
                          }}
                          className={cn(
                            "flex flex-col items-center justify-center p-3 border rounded-[1px] transition-all cursor-pointer text-center",
                            isSelected
                              ? cn(emblem.border, emblem.bg, "ring-1 ring-accent")
                              : "border-[var(--line)] bg-[var(--surface-2)] hover:border-zinc-500"
                          )}
                        >
                          <span className="text-xl mb-1">{emblem.icon}</span>
                          <span className={cn("font-mono text-[0.625rem] uppercase font-bold", isSelected ? emblem.text : "text-muted-foreground")}>
                            {emblem.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Immutable Institutional Identifiers */}
                <div className="pt-2 border-t border-[var(--line)] space-y-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                    <Lock size={13} className="text-zinc-500 shrink-0" />
                    <span>Locked Institutional Registrations</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="font-mono text-[0.625rem] uppercase text-muted-foreground/70">
                        Medi-Caps Enrollment PRN
                      </Label>
                      <Input
                        value={member?.prn || "—"}
                        readOnly
                        disabled
                        className="font-mono text-xs h-9 bg-zinc-950/40 text-muted-foreground cursor-not-allowed border-zinc-800"
                      />
                    </div>
                    <div>
                      <Label className="font-mono text-[0.625rem] uppercase text-muted-foreground/70">
                        Institutional Email Address
                      </Label>
                      <Input
                        value={member?.email || ""}
                        readOnly
                        disabled
                        className="font-mono text-xs h-9 bg-zinc-950/40 text-muted-foreground cursor-not-allowed border-zinc-800"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Developer & Social Links */}
              <div className="settings-card">
                <div className="settings-card-header">
                  <h3 className="settings-card-title">Developer & Social Links</h3>
                  <p className="settings-card-desc">
                    Connect your GitHub and LinkedIn to display on your campus member badge.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* GitHub */}
                  <div className="settings-field">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="s-github" className="font-mono text-[0.6875rem] uppercase text-muted-foreground flex items-center gap-1.5">
                        <Github size={13} /> GitHub Handle
                      </Label>
                      {saveStatus["github_username"] === "saved" && (
                        <span className="save-badge"><Check size={12} /> Saved ✓</span>
                      )}
                    </div>
                    <div className="settings-field-row">
                      <div className="relative flex-1">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-muted-foreground">
                          @
                        </span>
                        <Input
                          id="s-github"
                          value={github}
                          onChange={(e) => setGithub(e.target.value.replace(/^@/, ""))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveField("github_username", github.trim());
                          }}
                          placeholder="octocat"
                          className="font-mono text-xs h-10 pl-8"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="font-mono text-xs uppercase h-10 px-3 rounded-none cursor-pointer"
                        disabled={saveStatus["github_username"] === "saving" || github.trim() === (member?.github_username || "")}
                        onClick={() => handleSaveField("github_username", github.trim())}
                      >
                        Save
                      </Button>
                    </div>
                  </div>

                  {/* LinkedIn */}
                  <div className="settings-field">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="s-linkedin" className="font-mono text-[0.6875rem] uppercase text-muted-foreground flex items-center gap-1.5">
                        <Linkedin size={13} /> LinkedIn Profile
                      </Label>
                      {saveStatus["linkedin_url"] === "saved" && (
                        <span className="save-badge"><Check size={12} /> Saved ✓</span>
                      )}
                    </div>
                    <div className="settings-field-row">
                      <Input
                        id="s-linkedin"
                        value={linkedin}
                        onChange={(e) => setLinkedin(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveField("linkedin_url", linkedin.trim());
                        }}
                        placeholder="https://linkedin.com/in/username"
                        className="font-mono text-xs h-10"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="font-mono text-xs uppercase h-10 px-3 rounded-none cursor-pointer"
                        disabled={saveStatus["linkedin_url"] === "saving" || linkedin.trim() === (member?.linkedin_url || "")}
                        onClick={() => handleSaveField("linkedin_url", linkedin.trim())}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ACCOUNT & SECURITY */}
          {activeTab === "account" && (
            <div className="space-y-6 animate-in fade-in-50 duration-200">
              {/* Connected Accounts */}
              <div className="settings-card">
                <div className="settings-card-header">
                  <h3 className="settings-card-title">Connected Accounts</h3>
                  <p className="settings-card-desc">
                    Authentication providers linked to your Medi-Caps portal credential.
                  </p>
                </div>

                <div className="divide-y divide-[var(--line)]">
                  {/* Google SSO */}
                  <div className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="size-9 bg-zinc-900 border border-zinc-700 flex items-center justify-center">
                        <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true">
                          <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z" />
                          <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.36 24 12 24z" />
                          <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.15z" />
                          <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
                        </svg>
                      </div>
                      <div>
                        <strong className="font-mono text-xs block text-foreground">Google Workspace SSO</strong>
                        <span className="font-mono text-[0.6875rem] text-muted-foreground">{member?.email}</span>
                      </div>
                    </div>
                    <Badge variant="outline" className="font-mono text-[0.625rem] text-emerald-400 border-emerald-500/40 bg-emerald-950/20">
                      CONNECTED
                    </Badge>
                  </div>

                  {/* GitHub */}
                  <div className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="size-9 bg-zinc-900 border border-zinc-700 flex items-center justify-center">
                        <Github className="size-4 text-zinc-300" />
                      </div>
                      <div>
                        <strong className="font-mono text-xs block text-foreground">GitHub Profile</strong>
                        <span className="font-mono text-[0.6875rem] text-muted-foreground">
                          {member?.github_username ? `@${member.github_username}` : "Not linked yet"}
                        </span>
                      </div>
                    </div>
                    {member?.github_username ? (
                      <Badge variant="outline" className="font-mono text-[0.625rem] text-accent border-accent/40 bg-accent/10">
                        LINKED
                      </Badge>
                    ) : (
                      <span className="font-mono text-[0.625rem] text-muted-foreground">Optional</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Notification Preferences */}
              <div className="settings-card">
                <div className="settings-card-header">
                  <h3 className="settings-card-title">Notification Preferences</h3>
                  <p className="settings-card-desc">
                    Control institutional advisories delivered to your registered @medicaps.ac.in mailbox.
                  </p>
                </div>

                <div className="divide-y divide-[var(--line)]">
                  <div className="py-3 flex items-center justify-between gap-4">
                    <div>
                      <strong className="font-mono text-xs block text-foreground">Contest Announcements</strong>
                      <span className="text-[0.6875rem] text-muted-foreground block mt-0.5">
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
                      <strong className="font-mono text-xs block text-foreground">Rating & Standings Updates</strong>
                      <span className="text-[0.6875rem] text-muted-foreground block mt-0.5">
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

                  <div className="py-3 flex items-center justify-between gap-4">
                    <div>
                      <strong className="font-mono text-xs block text-foreground">Club Technical Bulletins</strong>
                      <span className="text-[0.6875rem] text-muted-foreground block mt-0.5">
                        Security bulletins, open source projects, and chapter advisories.
                      </span>
                    </div>
                    <Switch
                      checked={notifBulletins}
                      onCheckedChange={(val) => {
                        setNotifBulletins(val);
                        toast.success(`Bulletins ${val ? "enabled" : "disabled"}`);
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Active Session & Device */}
              <div className="settings-card">
                <div className="settings-card-header">
                  <h3 className="settings-card-title">Active Session & Security</h3>
                  <p className="settings-card-desc">
                    Current terminal device authorization and cryptographic token parameters.
                  </p>
                </div>

                <div className="flex items-start justify-between gap-4 p-3 bg-[var(--surface-2)] border border-[var(--line)]">
                  <div className="flex items-start gap-3">
                    <Laptop className="size-5 text-accent mt-0.5" />
                    <div>
                      <strong className="font-mono text-xs block text-foreground">
                        {typeof window !== "undefined" ? window.navigator.platform || "Workstation Session" : "Workstation Session"}
                      </strong>
                      <p className="font-mono text-[0.6875rem] text-muted-foreground mt-0.5">
                        Stateless HMAC-SHA256 JWT · Stored in Local Session Storage
                      </p>
                      <span className="inline-flex items-center gap-1.5 mt-2 font-mono text-[0.625rem] text-emerald-400">
                        <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        ACTIVE NOW
                      </span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="font-mono text-xs uppercase h-8 px-3 rounded-none text-muted-foreground hover:text-foreground cursor-pointer"
                    onClick={() => {
                      logout();
                    }}
                  >
                    <LogOut size={13} className="mr-1.5" /> Log Out
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DANGER ZONE */}
          {activeTab === "danger" && (
            <div className="space-y-6 animate-in fade-in-50 duration-200">
              <div className="settings-danger-card">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="size-5 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-rose-300">
                      Permanent Account Purge
                    </h3>
                    <p className="text-xs text-rose-200/80 leading-relaxed mt-1">
                      Deleting your account is permanent and irreversible. Your competitive rating record,
                      campus pass cryptographic certificates, leaderboard standings, and follow relationships
                      will be immediately erased from the institutional database.
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-rose-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <strong className="font-mono text-xs text-rose-200 block">Irrevocable action</strong>
                    <span className="font-mono text-[0.6875rem] text-rose-300/70">
                      Requires explicit confirmation of your member handle (@{member?.handle || "user"}).
                    </span>
                  </div>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        className="font-mono text-xs uppercase tracking-wider h-10 px-4 rounded-none cursor-pointer bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-[0_0_15px_rgba(225,29,72,0.3)]"
                      >
                        <Trash2 size={14} className="mr-1.5" /> Delete Account
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="border-rose-500/50 bg-zinc-950 text-foreground">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="font-mono uppercase text-rose-400 flex items-center gap-2">
                          <ShieldAlert className="size-5 text-rose-500" />
                          Confirm Account Deletion
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-xs text-zinc-400 leading-relaxed space-y-2">
                          <p>
                            This will permanently delete <strong className="text-white">@{member?.handle}</strong> and all associated competitive programming records from the Medi-Caps node.
                          </p>
                          <p>
                            To confirm, please type your handle <code className="text-accent bg-zinc-900 px-1 py-0.5 border border-zinc-800">{member?.handle}</code> below:
                          </p>
                        </AlertDialogDescription>
                      </AlertDialogHeader>

                      <div className="my-2">
                        <Input
                          value={deleteConfirmText}
                          onChange={(e) => setDeleteConfirmText(e.target.value)}
                          placeholder={member?.handle || "handle"}
                          className="font-mono text-sm h-10 border-rose-500/40 focus-visible:ring-rose-500"
                        />
                      </div>

                      <AlertDialogFooter>
                        <AlertDialogCancel
                          onClick={() => setDeleteConfirmText("")}
                          className="font-mono text-xs uppercase rounded-none"
                        >
                          Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                          disabled={deleteConfirmText.trim().toLowerCase() !== member?.handle?.toLowerCase() || isDeleting}
                          onClick={handleDeleteAccount}
                          className="font-mono text-xs uppercase rounded-none bg-rose-600 hover:bg-rose-700 text-white font-semibold disabled:opacity-50"
                        >
                          {isDeleting ? <Loader2 className="spin size-4" /> : "Permanently Delete"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
