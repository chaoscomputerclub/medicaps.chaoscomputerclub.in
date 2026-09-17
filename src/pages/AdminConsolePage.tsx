/**
 * Chaos Computer Club India — Medi-Caps Chapter
 * Faculty Proctor & Organizer Admin Command Center
 * Dedicated Air-Gapped Lab Gate Scanner, Workstation Allocation & Contest Operations
 */

import { useState, useEffect, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  CheckCircle2,
  Clock,
  Cpu,
  Layers,
  Lock,
  LogOut,
  MapPin,
  Play,
  QrCode,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  Trophy,
  UserCheck,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { contestApi } from "@/features/contest/api";
import { invalidateSwrCache } from "@/lib/cache/swrCache";

export function AdminConsolePage() {
  const [searchParams] = useSearchParams();
  const { member } = useAppSelector((s) => s.auth);

  const [activeTab, setActiveTab] = useState<"gate_scanner" | "attendees" | "operations">("gate_scanner");

  // Selected contest for roster and operations
  const [contests, setContests] = useState<any[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string>("weekly-contest-1");
  const [isLoadingContests, setIsLoadingContests] = useState(false);

  // Scanner states
  const [qrInput, setQrInput] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);

  // Attendees roster state
  const [attendees, setAttendees] = useState<any[]>([]);
  const [isLoadingAttendees, setIsLoadingAttendees] = useState(false);
  const [attendeeFilter, setAttendeeFilter] = useState<"all" | "checked_in" | "issued">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Operation action states
  const [isActionPending, setIsActionPending] = useState(false);

  // Check role: Must be core member or dev bypass
  const isAuthorized = Boolean(
    member?.is_core_member ||
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  );

  // Load contests list
  const loadContests = useCallback(async () => {
    setIsLoadingContests(true);
    try {
      const list = await contestApi.list(true);
      setContests(list);
      if (list.length > 0) {
        const liveOrFirst = list.find((c: any) => c.status === "live") || list[0];
        setSelectedSlug(liveOrFirst.slug);
      }
    } catch {
      // Fallback default
    } finally {
      setIsLoadingContests(false);
    }
  }, []);

  // Load attendees for selected contest
  const loadAttendees = useCallback(async (slug: string) => {
    if (!slug) return;
    setIsLoadingAttendees(true);
    try {
      const data = await contestApi.attendees(slug);
      setAttendees(data || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load contest attendees.");
      setAttendees([]);
    } finally {
      setIsLoadingAttendees(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthorized) {
      loadContests();
    }
  }, [isAuthorized, loadContests]);

  useEffect(() => {
    if (selectedSlug) {
      loadAttendees(selectedSlug);
    }
  }, [selectedSlug, loadAttendees]);

  // Handle URL query pass code param
  useEffect(() => {
    const passQuery = searchParams.get("pass");
    if (passQuery) {
      setQrInput(passQuery);
      handleVerifyGatePass(passQuery);
    }
  }, [searchParams]);

  // Proctor verify pass
  const handleVerifyGatePass = async (codeToVerify?: string) => {
    const target = (codeToVerify || qrInput).trim();
    if (!target) {
      toast.error("Please enter or scan a candidate QR pass code.");
      return;
    }

    setIsVerifying(true);
    try {
      const res = await contestApi.verifyProctorPass({
        pass_code_or_qr: target,
        contest_slug: selectedSlug,
      });
      setScanResult(res);
      if (res.valid) {
        if (res.status === "already_checked_in") {
          toast.info(`Candidate already checked in at seat ${res.seat_number}`);
        } else {
          toast.success(`Verified! Seat ${res.seat_number} allocated to ${res.candidate_name}`);
        }
        if (selectedSlug) {
          loadAttendees(selectedSlug);
        }
      } else {
        toast.error(res.message || "Invalid pass presented.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to verify gate pass");
      setScanResult({
        valid: false,
        status: "error",
        message: err.message || "Verification service unreachable.",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  // Lifecycle status trigger
  const handleStatusChange = async (newStatus: "upcoming" | "live" | "finished") => {
    setIsActionPending(true);
    try {
      const token = localStorage.getItem("ccc_token") || "";
      const res = await fetch(`/api/contests/dynamic/change-status?slug=${encodeURIComponent(selectedSlug)}&status=${newStatus}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to change status");
      toast.success(data.message || `Contest status changed to ${newStatus.toUpperCase()}`);
      invalidateSwrCache("contests:*");
      loadContests();
    } catch (err: any) {
      toast.error(err.message || "Operation failed");
    } finally {
      setIsActionPending(false);
    }
  };

  // Arena clock reset
  const handleResetTimer = async (minutes: number) => {
    setIsActionPending(true);
    try {
      const token = localStorage.getItem("ccc_token") || "";
      const res = await fetch(`/api/contests/${encodeURIComponent(selectedSlug)}/reset-timer?seconds=${minutes * 60}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to reset timer");
      toast.success(`Contest clock set to ${minutes} minutes remaining.`);
    } catch (err: any) {
      toast.error(err.message || "Failed to reset timer");
    } finally {
      setIsActionPending(false);
    }
  };

  // Top 30 auto-qualify
  const handleQualifyTop30 = async () => {
    setIsActionPending(true);
    try {
      const res = await contestApi.qualifyTop30(selectedSlug);
      toast.success(`Top 30 Qualifiers Confirmed! (${res.qualified_count} passes issued)`);
      loadAttendees(selectedSlug);
    } catch (err: any) {
      toast.error(err.message || "Failed to qualify top 30");
    } finally {
      setIsActionPending(false);
    }
  };

  // If user is not an organizer / faculty proctor, show access barrier
  if (!isAuthorized) {
    return (
      <div className="flex min-h-[80vh] w-full flex-col items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6 border border-red-500/30 bg-[var(--surface)] p-8 text-center shadow-2xl relative overflow-hidden">
          <div className="pointer-events-none absolute -right-16 -top-16 size-40 rounded-full bg-red-500/10 blur-3xl" />
          <div className="mx-auto flex size-16 items-center justify-center border border-red-500/40 bg-red-500/10">
            <ShieldAlert className="size-8 text-red-400" />
          </div>
          <div className="space-y-2">
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-red-400">
              Access Restricted · Chapter Organizers Only
            </span>
            <h1 className="text-xl font-black uppercase tracking-tight text-white font-mono">
              Faculty Proctor Console
            </h1>
            <p className="text-xs text-[var(--muted)] font-mono leading-relaxed">
              This terminal is strictly restricted to Faculty Chief Proctors (Dr. Ratnesh Litoriya, Prof. Amit Shrivastava) and Core Chapter Administrators for physical lab gate operations.
            </p>
          </div>
          <Button asChild className="rounded-none bg-[var(--accent)] font-mono text-xs font-bold uppercase text-black hover:bg-[var(--accent)]/90">
            <Link to="/portal">
              <ArrowLeft className="mr-1.5 size-4" /> Return to Cadet Portal
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const selectedContest = contests.find((c) => c.slug === selectedSlug);
  const checkedInCount = attendees.filter((a) => a.check_in_status === "checked_in").length;
  const totalAttendees = attendees.length;

  const filteredAttendees = attendees.filter((a) => {
    if (attendeeFilter === "checked_in" && a.check_in_status !== "checked_in") return false;
    if (attendeeFilter === "issued" && a.check_in_status === "checked_in") return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = a.full_name?.toLowerCase().includes(q);
      const matchHandle = a.handle?.toLowerCase().includes(q);
      const matchSeat = a.seat_number?.toLowerCase().includes(q);
      const matchPass = a.pass_code?.toLowerCase().includes(q);
      return matchName || matchHandle || matchSeat || matchPass;
    }
    return true;
  });

  return (
    <div className="page-wrap max-w-6xl mx-auto p-6 space-y-6">
      {/* ── HEADER ── */}
      <header className="flex flex-col justify-between gap-4 border-b border-[var(--line)] pb-6 md:flex-row md:items-end">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex size-2 rounded-full bg-red-500 animate-pulse" />
            <p className="font-mono text-xs uppercase tracking-widest text-red-400 font-bold">
              Chaos Computer Club · Faculty Proctor Console
            </p>
          </div>
          <h1 className="text-2xl sm:text-3xl font-mono font-black text-white uppercase tracking-tight">
            Air-Gapped Lab Gate & Operations
          </h1>
          <p className="text-xs text-[var(--muted)] font-mono mt-1">
            Chief Proctors: Dr. Ratnesh Litoriya · Prof. Amit Shrivastava · Workstation Gate Control
          </p>
        </div>

        {/* Quick selector */}
        <div className="flex items-center gap-2">
          <div className="border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 font-mono text-xs">
            <span className="text-[var(--muted)] uppercase text-[10px] block">Active Edition</span>
            <select
              value={selectedSlug}
              onChange={(e) => setSelectedSlug(e.target.value)}
              className="bg-transparent font-bold text-white outline-none cursor-pointer"
            >
              {contests.map((c) => (
                <option key={c.slug} value={c.slug} className="bg-neutral-900 text-white">
                  {c.title} ({c.status.toUpperCase()})
                </option>
              ))}
            </select>
          </div>
          <Button
            onClick={() => {
              loadContests();
              if (selectedSlug) loadAttendees(selectedSlug);
            }}
            variant="outline"
            size="sm"
            className="rounded-none font-mono text-xs h-10 px-3"
          >
            <RefreshCw className="size-3.5" />
          </Button>
        </div>
      </header>

      {/* ── KPI BAR ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
        <div className="border border-[var(--line)] bg-[var(--surface)] p-3">
          <p className="text-[9px] uppercase tracking-widest text-[var(--muted)]">Contest Status</p>
          <p className="text-sm font-black uppercase text-[var(--accent)] mt-0.5">
            {selectedContest?.status || "UPCOMING"}
          </p>
        </div>
        <div className="border border-[var(--line)] bg-[var(--surface)] p-3">
          <p className="text-[9px] uppercase tracking-widest text-[var(--muted)]">Gate Attendance</p>
          <p className="text-sm font-black text-emerald-400 mt-0.5">
            {checkedInCount} / {totalAttendees || 30} Finalists
          </p>
        </div>
        <div className="border border-[var(--line)] bg-[var(--surface)] p-3">
          <p className="text-[9px] uppercase tracking-widest text-[var(--muted)]">Lab Capacity</p>
          <p className="text-sm font-black text-white mt-0.5">
            {selectedContest?.seat_capacity || 30} Workstations
          </p>
        </div>
        <div className="border border-[var(--line)] bg-[var(--surface)] p-3">
          <p className="text-[9px] uppercase tracking-widest text-[var(--muted)]">Venue</p>
          <p className="text-xs font-bold text-white mt-0.5 truncate">
            {selectedContest?.venue || "Campus Computing Complex"}
          </p>
        </div>
      </div>

      {/* ── TABS ── */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-6">
        <TabsList className="bg-[#141414] border border-[#262626] p-1 rounded-none grid grid-cols-3 max-w-xl">
          <TabsTrigger
            value="gate_scanner"
            className="rounded-none font-mono text-xs uppercase data-[state=active]:bg-[var(--accent)] data-[state=active]:text-black font-bold tracking-wider"
          >
            <QrCode className="size-3.5 mr-2" />
            Gate Scanner
          </TabsTrigger>
          <TabsTrigger
            value="attendees"
            className="rounded-none font-mono text-xs uppercase data-[state=active]:bg-[var(--accent)] data-[state=active]:text-black font-bold tracking-wider"
          >
            <Users className="size-3.5 mr-2" />
            Workstation Roster ({checkedInCount}/{totalAttendees})
          </TabsTrigger>
          <TabsTrigger
            value="operations"
            className="rounded-none font-mono text-xs uppercase data-[state=active]:bg-[var(--accent)] data-[state=active]:text-black font-bold tracking-wider"
          >
            <Layers className="size-3.5 mr-2" />
            Contest Controls
          </TabsTrigger>
        </TabsList>

        {/* ── TAB 1: GATE SCANNER ── */}
        <TabsContent value="gate_scanner" className="space-y-6">
          <Card className="rounded-none border border-[#262626] bg-[#0d0d0d]">
            <CardHeader className="border-b border-[#1f1f1f] pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="font-mono text-base uppercase text-white tracking-wider flex items-center gap-2">
                    <QrCode className="size-5 text-[var(--accent)]" />
                    Air-Gapped Lab Entry QR Scanner
                  </CardTitle>
                  <p className="font-mono text-xs text-[var(--muted)] mt-1">
                    Scan candidate pass from camera or laser scanner to allocate workstation and grant arena access.
                  </p>
                </div>
                <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 font-mono text-[10px] uppercase rounded-none">
                  ● Scanner Ready
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              {/* Input Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleVerifyGatePass();
                }}
                className="space-y-3"
              >
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type="text"
                      placeholder="Scan QR payload or enter pass code (e.g. CCC-PASS-87B14A)..."
                      value={qrInput}
                      onChange={(e) => setQrInput(e.target.value)}
                      className="font-mono text-sm bg-black border-[#333] h-12 rounded-none px-4 focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
                      autoFocus
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={isVerifying || !qrInput.trim()}
                    className="h-12 px-6 rounded-none bg-[var(--accent)] text-black font-mono text-xs font-black uppercase tracking-wider hover:bg-[var(--accent)]/90"
                  >
                    {isVerifying ? <RefreshCw className="size-4 animate-spin" /> : "Verify & Admit"}
                  </Button>
                </div>
              </form>

              {/* Scan Result Hero Display */}
              {scanResult && (
                <div
                  className={`border p-6 relative overflow-hidden transition-all duration-300 font-mono ${
                    scanResult.valid && scanResult.status !== "already_checked_in"
                      ? "border-emerald-500/50 bg-emerald-950/20"
                      : scanResult.status === "already_checked_in"
                      ? "border-cyan-500/50 bg-cyan-950/20"
                      : "border-red-500/50 bg-red-950/20"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] pb-4 mb-4">
                    <div className="flex items-center gap-3">
                      {scanResult.valid ? (
                        <CheckCircle2 className="size-6 text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle className="size-6 text-red-400 shrink-0" />
                      )}
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">
                          Gate Decision Verdict
                        </span>
                        <h3 className="text-lg font-black uppercase text-white">
                          {scanResult.status === "verified"
                            ? "ADMISSION GRANTED · WORKSTATION ALLOCATED"
                            : scanResult.status === "already_checked_in"
                            ? "ALREADY CHECKED IN · WORKSTATION CONFIRMED"
                            : "ADMISSION REJECTED"}
                        </h3>
                      </div>
                    </div>
                    <Badge
                      className={`rounded-none font-mono text-xs uppercase font-bold px-3 py-1 ${
                        scanResult.valid ? "bg-emerald-500 text-black" : "bg-red-500 text-white"
                      }`}
                    >
                      {scanResult.status.toUpperCase()}
                    </Badge>
                  </div>

                  {scanResult.valid && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div className="border border-[var(--line)] bg-black/40 p-3">
                        <p className="text-[9px] uppercase tracking-widest text-[var(--muted)]">Cadet Name</p>
                        <p className="font-bold text-white mt-0.5">{scanResult.candidate_name}</p>
                      </div>
                      <div className="border border-[var(--line)] bg-black/40 p-3">
                        <p className="text-[9px] uppercase tracking-widest text-[var(--muted)]">Handle</p>
                        <p className="font-bold text-[var(--accent)] mt-0.5">@{scanResult.handle}</p>
                      </div>
                      <div className="border border-emerald-500/40 bg-emerald-950/40 p-3 col-span-2">
                        <p className="text-[9px] uppercase tracking-widest text-emerald-400 font-black">
                          Assigned Workstation Seat
                        </p>
                        <p className="text-xl font-black text-emerald-300 mt-0.5">
                          {scanResult.seat_number || "LAB-04-WS-01"}
                        </p>
                      </div>
                      <div className="border border-[var(--line)] bg-black/40 p-3">
                        <p className="text-[9px] uppercase tracking-widest text-[var(--muted)]">Screening Rank</p>
                        <p className="font-bold text-white mt-0.5">
                          #{scanResult.qualification_rank || 1} ({scanResult.screening_score ?? 0} pts)
                        </p>
                      </div>
                      <div className="border border-[var(--line)] bg-black/40 p-3">
                        <p className="text-[9px] uppercase tracking-widest text-[var(--muted)]">Department / Batch</p>
                        <p className="font-bold text-white mt-0.5">
                          {scanResult.department || "CSE"} · {scanResult.batch || "2023-27"}
                        </p>
                      </div>
                      <div className="border border-[var(--line)] bg-black/40 p-3 col-span-2">
                        <p className="text-[9px] uppercase tracking-widest text-[var(--muted)]">Proctor Verified By</p>
                        <p className="font-bold text-white mt-0.5 truncate">
                          {scanResult.checked_in_by || "Dr. Ratnesh Litoriya (Chief Proctor)"}
                        </p>
                      </div>
                    </div>
                  )}

                  {!scanResult.valid && (
                    <p className="text-xs text-red-300 font-mono mt-2">{scanResult.message}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB 2: WORKSTATION & ATTENDEE ROSTER ── */}
        <TabsContent value="attendees" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border border-[var(--line)] bg-[var(--surface)] p-4">
            <div className="flex items-center gap-2">
              <div className="relative w-64">
                <Search className="absolute left-3 top-2.5 size-3.5 text-[var(--muted)]" />
                <Input
                  type="text"
                  placeholder="Filter by name, seat, handle..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 rounded-none font-mono text-xs bg-black border-[#333]"
                />
              </div>

              <div className="flex gap-1 font-mono text-xs">
                {(["all", "checked_in", "issued"] as const).map((f) => (
                  <Button
                    key={f}
                    onClick={() => setAttendeeFilter(f)}
                    variant={attendeeFilter === f ? "default" : "outline"}
                    size="sm"
                    className="rounded-none font-mono text-[11px] uppercase h-9"
                  >
                    {f === "all" ? "All" : f === "checked_in" ? "Checked In" : "Awaiting Scan"}
                  </Button>
                ))}
              </div>
            </div>

            <Button
              onClick={() => selectedSlug && loadAttendees(selectedSlug)}
              variant="outline"
              size="sm"
              className="rounded-none font-mono text-xs h-9"
            >
              <RefreshCw className="mr-1.5 size-3.5" /> Refresh Roster
            </Button>
          </div>

          {/* Roster Table */}
          <div className="border border-[var(--line)] bg-[var(--surface)] overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="border-b border-[var(--line)] bg-[var(--surface-2)] text-[var(--muted)] uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-3">Rank</th>
                  <th className="p-3">Cadet</th>
                  <th className="p-3">Assigned Seat</th>
                  <th className="p-3">Screening Score</th>
                  <th className="p-3">Pass Code</th>
                  <th className="p-3">Gate Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {isLoadingAttendees ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-[var(--muted)]">
                      Loading attendee roster...
                    </td>
                  </tr>
                ) : filteredAttendees.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-[var(--muted)]">
                      No finalists found for this filter.
                    </td>
                  </tr>
                ) : (
                  filteredAttendees.map((a, idx) => {
                    const isCheckedIn = a.check_in_status === "checked_in";
                    return (
                      <tr key={a.pass_code || idx} className="hover:bg-white/[0.02]">
                        <td className="p-3 font-bold text-white">#{a.rank || idx + 1}</td>
                        <td className="p-3">
                          <p className="font-bold text-white">{a.full_name}</p>
                          <p className="text-[10px] text-[var(--accent)]">@{a.handle}</p>
                        </td>
                        <td className="p-3 font-black text-emerald-400">{a.seat_number}</td>
                        <td className="p-3 text-white font-bold">{a.screening_score} pts</td>
                        <td className="p-3 text-[var(--muted)] text-[11px]">{a.pass_code}</td>
                        <td className="p-3">
                          <span
                            className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase border ${
                              isCheckedIn
                                ? "text-emerald-400 border-emerald-500/40 bg-emerald-950/20"
                                : "text-amber-400 border-amber-500/40 bg-amber-950/20"
                            }`}
                          >
                            ● {isCheckedIn ? "CHECKED IN" : "AWAITING SCAN"}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          {!isCheckedIn ? (
                            <Button
                              onClick={() => {
                                setQrInput(a.pass_code);
                                setActiveTab("gate_scanner");
                                handleVerifyGatePass(a.pass_code);
                              }}
                              size="sm"
                              className="rounded-none bg-[var(--accent)] text-black font-mono text-[10px] font-bold uppercase h-7 px-2.5 hover:bg-[var(--accent)]/90"
                            >
                              Admit
                            </Button>
                          ) : (
                            <span className="text-[10px] text-[var(--muted)]">Admitted</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* ── TAB 3: CONTEST OPERATIONS ── */}
        <TabsContent value="operations" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono">
            {/* Lifecycle Status Switcher */}
            <Card className="rounded-none border border-[#262626] bg-[#0d0d0d]">
              <CardHeader className="border-b border-[#1f1f1f] pb-3">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                  <Play className="size-4 text-[var(--accent)]" />
                  Contest Status Switcher
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <p className="text-xs text-[var(--muted)] leading-relaxed">
                  Current Status: <strong>{selectedContest?.status?.toUpperCase()}</strong>. Transition the contest through its official lifecycle:
                </p>
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={() => handleStatusChange("live")}
                    disabled={isActionPending || selectedContest?.status === "live"}
                    className="rounded-none bg-emerald-500 text-black font-mono text-xs font-bold uppercase hover:bg-emerald-400 justify-start"
                  >
                    <Play className="mr-2 size-4" /> Start Round 2 Live Contest
                  </Button>
                  <Button
                    onClick={() => handleStatusChange("finished")}
                    disabled={isActionPending || selectedContest?.status === "finished"}
                    className="rounded-none bg-red-600 text-white font-mono text-xs font-bold uppercase hover:bg-red-500 justify-start"
                  >
                    <Trophy className="mr-2 size-4" /> Finish Contest & Apply Ratings
                  </Button>
                  <Button
                    onClick={() => handleStatusChange("upcoming")}
                    disabled={isActionPending || selectedContest?.status === "upcoming"}
                    variant="outline"
                    className="rounded-none font-mono text-xs uppercase justify-start"
                  >
                    <Clock className="mr-2 size-4" /> Reset to Upcoming
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Arena Timer Controls */}
            <Card className="rounded-none border border-[#262626] bg-[#0d0d0d]">
              <CardHeader className="border-b border-[#1f1f1f] pb-3">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                  <Clock className="size-4 text-[var(--accent)]" />
                  Arena Clock Override
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <p className="text-xs text-[var(--muted)] leading-relaxed">
                  Override remaining time on the live arena countdown timer across all connected lab workstations:
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={() => handleResetTimer(30)}
                    disabled={isActionPending}
                    variant="outline"
                    className="rounded-none font-mono text-xs uppercase"
                  >
                    Set 30 Mins
                  </Button>
                  <Button
                    onClick={() => handleResetTimer(60)}
                    disabled={isActionPending}
                    variant="outline"
                    className="rounded-none font-mono text-xs uppercase"
                  >
                    Set 60 Mins
                  </Button>
                  <Button
                    onClick={() => handleResetTimer(90)}
                    disabled={isActionPending}
                    variant="outline"
                    className="rounded-none font-mono text-xs uppercase"
                  >
                    Set 90 Mins (Standard)
                  </Button>
                  <Button
                    onClick={() => handleResetTimer(120)}
                    disabled={isActionPending}
                    variant="outline"
                    className="rounded-none font-mono text-xs uppercase"
                  >
                    Set 120 Mins
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Top 30 Trigger */}
            <Card className="rounded-none border border-[#262626] bg-[#0d0d0d] md:col-span-2">
              <CardHeader className="border-b border-[#1f1f1f] pb-3">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                  <Award className="size-4 text-[var(--accent)]" />
                  Screening Assessment Finalist Cutoff
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-white font-bold">
                    Evaluate & Confirm Top 30 Assessment Qualifiers
                  </p>
                  <p className="text-[11px] text-[var(--muted)] mt-0.5">
                    Evaluates candidate screening submissions, ranks by score and penalty time, allocates physical seats Lab-04-WS-01 to WS-30, and generates cryptographic QR gate passes.
                  </p>
                </div>
                <Button
                  onClick={handleQualifyTop30}
                  disabled={isActionPending}
                  className="rounded-none bg-[var(--accent)] text-black font-mono text-xs font-bold uppercase shrink-0 hover:bg-[var(--accent)]/90"
                >
                  <CheckCircle2 className="mr-1.5 size-4" /> Trigger Top 30 Cutoff
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
