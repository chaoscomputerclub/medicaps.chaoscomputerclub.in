/**
 * Chaos Computer Club India — Medi-Caps Chapter
 * Settings Page — Profile Configuration, Security & Account Lifecycle.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Check,
  Github,
  Laptop,
  Linkedin,
  Loader2,
  Lock,
  LogOut,
  ShieldAlert,
  ShieldCheck,
  Trash2,
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

const PRESET_EMBLEMS = [
  { id: "volt", label: "Volt", icon: "⚡", bg: "bg-lime-500/10", border: "border-lime-500/40", text: "text-lime-400" },
  { id: "binary", label: "Binary", icon: "👾", bg: "bg-cyan-500/10", border: "border-cyan-500/40", text: "text-cyan-400" },
  { id: "quantum", label: "Quantum", icon: "⚛️", bg: "bg-purple-500/10", border: "border-purple-500/40", text: "text-purple-400" },
  { id: "matrix", label: "Matrix", icon: "💻", bg: "bg-emerald-500/10", border: "border-emerald-500/40", text: "text-emerald-400" },
  { id: "grandmaster", label: "Grandmaster", icon: "🏆", bg: "bg-amber-500/10", border: "border-amber-500/40", text: "text-amber-400" },
  { id: "cipher", label: "Cipher", icon: "🛡️", bg: "bg-rose-500/10", border: "border-rose-500/40", text: "text-rose-400" },
];

type SettingsTab = "profile" | "account" | "danger";

export function SettingsPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
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

  // Inline save feedback states
  const [saveStatus, setSaveStatus] = useState<Record<string, "idle" | "saving" | "saved" | "error">>({});
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Notification toggles
  const [notifContests, setNotifContests] = useState(true);
  const [notifRatings, setNotifRatings] = useState(true);
  const [notifBulletins, setNotifBulletins] = useState(false);

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
      dispatch(fetchCurrentUserThunk());
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
      dispatch(fetchCurrentUserThunk());
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
    <div className="page-wrap space-y-6">
      {/* Page Header */}
      <div className="section-heading">
        <div>
          <p className="kicker">MEMBER CONFIGURATION & SECURITY</p>
          <h2>SETTINGS</h2>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Left Sub-navigation */}
        <nav className="flex flex-row md:flex-col gap-2 overflow-x-auto" aria-label="Settings navigation">
          <button
            type="button"
            className={cn(
              "flex items-center gap-2 px-4 py-3 font-mono text-xs uppercase tracking-wider text-left border rounded-none transition-colors",
              activeTab === "profile"
                ? "bg-[var(--accent)] text-black border-[var(--accent)] font-bold"
                : "border-[#292929] bg-[#0d0d0d] text-neutral-400 hover:text-white hover:border-neutral-700"
            )}
            onClick={() => setActiveTab("profile")}
          >
            <UserRound size={15} />
            <span>Profile</span>
          </button>
          <button
            type="button"
            className={cn(
              "flex items-center gap-2 px-4 py-3 font-mono text-xs uppercase tracking-wider text-left border rounded-none transition-colors",
              activeTab === "account"
                ? "bg-[var(--accent)] text-black border-[var(--accent)] font-bold"
                : "border-[#292929] bg-[#0d0d0d] text-neutral-400 hover:text-white hover:border-neutral-700"
            )}
            onClick={() => setActiveTab("account")}
          >
            <ShieldCheck size={15} />
            <span>Account & Security</span>
          </button>
          <button
            type="button"
            className={cn(
              "flex items-center gap-2 px-4 py-3 font-mono text-xs uppercase tracking-wider text-left border rounded-none transition-colors",
              activeTab === "danger"
                ? "bg-rose-950 text-rose-300 border-rose-500 font-bold"
                : "border-[#292929] bg-[#0d0d0d] text-rose-400 hover:border-rose-800"
            )}
            onClick={() => setActiveTab("danger")}
          >
            <AlertTriangle size={15} />
            <span>Danger Zone</span>
          </button>
        </nav>

        {/* Right Settings Panel */}
        <div className="md:col-span-3 space-y-6">
          {/* TAB 1: PROFILE SETTINGS */}
          {activeTab === "profile" && (
            <div className="space-y-6">
              {/* Identity Parameters */}
              <div className="border border-[#292929] bg-[#0d0d0d] p-6 space-y-5">
                <div>
                  <h3 className="text-base font-mono font-bold text-white uppercase">Competitive Identity</h3>
                  <p className="text-xs text-neutral-400 mt-1">
                    Your public identifier, handle alias, and institutional attribution shown on leaderboards.
                  </p>
                </div>

                {/* Full Name */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="s-fullname" className="font-mono text-xs uppercase text-neutral-400">
                      Full Name
                    </Label>
                    {saveStatus["full_name"] === "saving" && (
                      <span className="font-mono text-[10px] text-[var(--accent)] flex items-center gap-1">
                        <Loader2 className="animate-spin w-3 h-3" /> saving...
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
                      className="font-mono text-sm bg-black border-[#292929] text-white rounded-none"
                      placeholder="Ada Lovelace"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="font-mono text-xs uppercase border-[#292929] rounded-none shrink-0"
                      disabled={saveStatus["full_name"] === "saving" || fullName.trim() === member?.full_name}
                      onClick={() => handleSaveField("full_name", fullName.trim())}
                    >
                      Save
                    </Button>
                  </div>
                </div>

                {/* Username / Handle */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="s-handle" className="font-mono text-xs uppercase text-neutral-400">
                      Handle / Alias
                    </Label>
                    <div className="flex items-center h-4 font-mono text-[10px]">
                      {!isHandleChanged && (
                        <span className="text-neutral-500">current handle</span>
                      )}
                      {isHandleChanged && handleStatus === "checking" && (
                        <span className="text-[var(--accent)] flex items-center gap-1">
                          <Loader2 className="animate-spin w-3 h-3" /> checking...
                        </span>
                      )}
                      {isHandleChanged && handleStatus === "available" && (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <Check size={12} /> available
                        </span>
                      )}
                      {isHandleChanged && handleStatus === "taken" && (
                        <span className="text-rose-400 flex items-center gap-1">
                          <X size={12} /> handle taken
                        </span>
                      )}
                      {saveStatus["handle"] === "saved" && (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <Check size={12} /> Saved ✓
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-neutral-500">
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
                          "font-mono text-sm pl-8 bg-black border-[#292929] text-white rounded-none",
                          isHandleChanged && handleStatus === "available" && "border-emerald-500/60",
                          isHandleChanged && handleStatus === "taken" && "border-rose-500/60 text-rose-200"
                        )}
                        placeholder="ada_core"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="font-mono text-xs uppercase border-[#292929] rounded-none shrink-0"
                      disabled={
                        !isHandleChanged ||
                        handleInput.trim().length < 3 ||
                        handleStatus !== "available" ||
                        saveStatus["handle"] === "saving"
                      }
                      onClick={handleSaveHandle}
                    >
                      {saveStatus["handle"] === "saving" ? <Loader2 className="animate-spin w-3 h-3" /> : "Save"}
                    </Button>
                  </div>
                </div>

                {/* Bio */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="s-bio" className="font-mono text-xs uppercase text-neutral-400">
                      Bio / Tagline
                    </Label>
                    <span className="font-mono text-[10px] text-neutral-500">{bio.length}/500</span>
                  </div>
                  <Textarea
                    id="s-bio"
                    value={bio}
                    maxLength={500}
                    onChange={(e) => setBio(e.target.value)}
                    rows={3}
                    placeholder="Competitive programmer, CSE undergraduate..."
                    className="font-mono text-xs resize-none bg-black border-[#292929] text-white rounded-none"
                  />
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="font-mono text-xs uppercase border-[#292929] rounded-none"
                      disabled={saveStatus["bio"] === "saving" || bio.trim() === (member?.bio || "")}
                      onClick={() => handleSaveField("bio", bio.trim())}
                    >
                      Save Bio
                    </Button>
                  </div>
                </div>
              </div>

              {/* Academic & Emblem */}
              <div className="border border-[#292929] bg-[#0d0d0d] p-6 space-y-5">
                <div>
                  <h3 className="text-base font-mono font-bold text-white uppercase">Academic & Cyber Visuals</h3>
                  <p className="text-xs text-neutral-400 mt-1">
                    Your institutional affiliation, graduation cohort, and customized emblem.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-mono text-xs uppercase text-neutral-400">Department</Label>
                    <Select
                      value={department}
                      onValueChange={(val) => {
                        setDepartment(val);
                        void handleSaveField("department", val);
                      }}
                    >
                      <SelectTrigger className="font-mono text-xs bg-black border-[#292929] text-white rounded-none">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-neutral-900 border-[#292929] text-white rounded-none">
                        <SelectItem value="CSE">CSE (Computer Science & Engineering)</SelectItem>
                        <SelectItem value="IT">IT (Information Technology)</SelectItem>
                        <SelectItem value="AIDS">AIDS (AI & Data Science)</SelectItem>
                        <SelectItem value="Cyber Security">Cyber Security</SelectItem>
                        <SelectItem value="ECE">ECE (Electronics & Comm.)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="font-mono text-xs uppercase text-neutral-400">Graduation Batch</Label>
                    <Select
                      value={batch}
                      onValueChange={(val) => {
                        setBatch(val);
                        void handleSaveField("batch", val);
                      }}
                    >
                      <SelectTrigger className="font-mono text-xs bg-black border-[#292929] text-white rounded-none">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-neutral-900 border-[#292929] text-white rounded-none">
                        <SelectItem value="2022-26">2022–2026</SelectItem>
                        <SelectItem value="2023-27">2023–2027</SelectItem>
                        <SelectItem value="2024-28">2024–2028</SelectItem>
                        <SelectItem value="2025-29">2025–2029</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Preset Emblem Selector */}
                <div className="space-y-2">
                  <Label className="font-mono text-xs uppercase text-neutral-400">Cyber Profile Emblem</Label>
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
                            "flex flex-col items-center justify-center p-3 border rounded-none transition-all cursor-pointer text-center",
                            isSelected
                              ? cn(emblem.border, emblem.bg, "ring-1 ring-[var(--accent)]")
                              : "border-[#292929] bg-neutral-950 hover:border-neutral-600"
                          )}
                        >
                          <span className="text-xl mb-1">{emblem.icon}</span>
                          <span className={cn("font-mono text-[10px] uppercase font-bold", isSelected ? emblem.text : "text-neutral-400")}>
                            {emblem.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Immutable Identifiers */}
                <div className="pt-4 border-t border-[#292929] space-y-3">
                  <div className="flex items-center gap-2 text-xs text-neutral-400 font-mono">
                    <Lock size={13} className="text-neutral-500" />
                    <span>Locked Institutional Registrations</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="font-mono text-[10px] uppercase text-neutral-500">
                        Enrollment PRN
                      </Label>
                      <Input
                        value={member?.prn || "—"}
                        readOnly
                        disabled
                        className="font-mono text-xs bg-black/40 text-neutral-500 cursor-not-allowed border-[#292929] rounded-none mt-1"
                      />
                    </div>
                    <div>
                      <Label className="font-mono text-[10px] uppercase text-neutral-500">
                        Institutional Email Address
                      </Label>
                      <Input
                        value={member?.email || ""}
                        readOnly
                        disabled
                        className="font-mono text-xs bg-black/40 text-neutral-500 cursor-not-allowed border-[#292929] rounded-none mt-1"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Developer & Social Links */}
              <div className="border border-[#292929] bg-[#0d0d0d] p-6 space-y-5">
                <div>
                  <h3 className="text-base font-mono font-bold text-white uppercase">Developer & Social Links</h3>
                  <p className="text-xs text-neutral-400 mt-1">
                    Connect your GitHub and LinkedIn to display on your campus member badge.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* GitHub */}
                  <div className="space-y-2">
                    <Label htmlFor="s-github" className="font-mono text-xs uppercase text-neutral-400 flex items-center gap-1.5">
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
                        className="font-mono text-xs bg-black border-[#292929] text-white rounded-none"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="font-mono text-xs uppercase border-[#292929] rounded-none shrink-0"
                        disabled={saveStatus["github_username"] === "saving" || github.trim() === (member?.github_username || "")}
                        onClick={() => handleSaveField("github_username", github.trim())}
                      >
                        Save
                      </Button>
                    </div>
                  </div>

                  {/* LinkedIn */}
                  <div className="space-y-2">
                    <Label htmlFor="s-linkedin" className="font-mono text-xs uppercase text-neutral-400 flex items-center gap-1.5">
                      <Linkedin size={13} /> LinkedIn Profile
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
                        className="font-mono text-xs bg-black border-[#292929] text-white rounded-none"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="font-mono text-xs uppercase border-[#292929] rounded-none shrink-0"
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
            <div className="space-y-6">
              {/* Connected Accounts */}
              <div className="border border-[#292929] bg-[#0d0d0d] p-6 space-y-4">
                <div>
                  <h3 className="text-base font-mono font-bold text-white uppercase">Connected Accounts</h3>
                  <p className="text-xs text-neutral-400 mt-1">
                    Authentication providers linked to your Medi-Caps portal credential.
                  </p>
                </div>

                <div className="divide-y divide-[#292929]">
                  <div className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-neutral-900 border border-[#292929] flex items-center justify-center font-bold text-xs text-white">
                        G
                      </div>
                      <div>
                        <strong className="font-mono text-xs block text-white">Google Workspace SSO</strong>
                        <span className="font-mono text-[10px] text-neutral-400">{member?.email}</span>
                      </div>
                    </div>
                    <Badge variant="outline" className="font-mono text-[10px] text-emerald-400 border-emerald-500/40 bg-emerald-950/20 rounded-none">
                      CONNECTED
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Notification Preferences */}
              <div className="border border-[#292929] bg-[#0d0d0d] p-6 space-y-4">
                <div>
                  <h3 className="text-base font-mono font-bold text-white uppercase">Notification Preferences</h3>
                  <p className="text-xs text-neutral-400 mt-1">
                    Control institutional advisories delivered to your registered mailbox.
                  </p>
                </div>

                <div className="divide-y divide-[#292929]">
                  <div className="py-3 flex items-center justify-between gap-4">
                    <div>
                      <strong className="font-mono text-xs block text-white">Contest Announcements</strong>
                      <span className="text-[10px] text-neutral-400 block mt-0.5">
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
                      <span className="text-[10px] text-neutral-400 block mt-0.5">
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

              {/* Active Session */}
              <div className="border border-[#292929] bg-[#0d0d0d] p-6 space-y-4">
                <div>
                  <h3 className="text-base font-mono font-bold text-white uppercase">Active Session & Security</h3>
                  <p className="text-xs text-neutral-400 mt-1">
                    Current terminal device authorization and cryptographic token parameters.
                  </p>
                </div>

                <div className="flex items-start justify-between gap-4 p-4 bg-black border border-[#292929]">
                  <div className="flex items-start gap-3">
                    <Laptop className="w-5 h-5 text-[var(--accent)] mt-0.5" />
                    <div>
                      <strong className="font-mono text-xs block text-white">
                        {typeof window !== "undefined" ? window.navigator.platform || "Workstation Session" : "Workstation Session"}
                      </strong>
                      <p className="font-mono text-[10px] text-neutral-400 mt-0.5">
                        Stateless HMAC-SHA256 JWT · Stored in Local Session Storage
                      </p>
                      <span className="inline-flex items-center gap-1.5 mt-2 font-mono text-[10px] text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        ACTIVE NOW
                      </span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="font-mono text-xs uppercase border-[#292929] rounded-none text-neutral-400 hover:text-white"
                    onClick={() => logout()}
                  >
                    <LogOut size={13} className="mr-1.5" /> Log Out
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DANGER ZONE */}
          {activeTab === "danger" && (
            <div className="border border-rose-500/40 bg-rose-950/10 p-6 space-y-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-rose-300">
                    Permanent Account Purge
                  </h3>
                  <p className="text-xs text-rose-200/80 leading-relaxed mt-1">
                    Deleting your account is permanent and irreversible. Your competitive rating record,
                    campus pass cryptographic certificates, and leaderboard standings will be permanently erased.
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-rose-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <strong className="font-mono text-xs text-rose-200 block">Irrevocable action</strong>
                  <span className="font-mono text-[10px] text-rose-300/70">
                    Requires explicit confirmation of your handle (@{member?.handle || "user"}).
                  </span>
                </div>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      className="font-mono text-xs uppercase tracking-wider rounded-none bg-rose-600 hover:bg-rose-700 text-white font-semibold"
                    >
                      <Trash2 size={14} className="mr-1.5" /> Delete Account
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="border-rose-500/50 bg-neutral-950 text-white rounded-none">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="font-mono uppercase text-rose-400 flex items-center gap-2">
                        <ShieldAlert className="w-5 h-5 text-rose-500" />
                        Confirm Account Deletion
                      </AlertDialogTitle>
                      <AlertDialogDescription className="text-xs text-neutral-400 leading-relaxed space-y-2">
                        <p>
                          This will permanently delete <strong className="text-white">@{member?.handle}</strong> and all associated records.
                        </p>
                        <p>
                          To confirm, please type your handle <code className="text-[var(--accent)] bg-black px-1 py-0.5 border border-neutral-800">{member?.handle}</code> below:
                        </p>
                      </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="my-2">
                      <Input
                        value={deleteConfirmText}
                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                        placeholder={member?.handle || "handle"}
                        className="font-mono text-sm bg-black border-rose-500/40 text-white rounded-none focus-visible:ring-rose-500"
                      />
                    </div>

                    <AlertDialogFooter>
                      <AlertDialogCancel
                        onClick={() => setDeleteConfirmText("")}
                        className="font-mono text-xs uppercase rounded-none border-[#292929]"
                      >
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        disabled={deleteConfirmText.trim().toLowerCase() !== member?.handle?.toLowerCase() || isDeleting}
                        onClick={handleDeleteAccount}
                        className="font-mono text-xs uppercase rounded-none bg-rose-600 hover:bg-rose-700 text-white font-semibold disabled:opacity-50"
                      >
                        {isDeleting ? <Loader2 className="animate-spin w-4 h-4" /> : "Permanently Delete"}
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
