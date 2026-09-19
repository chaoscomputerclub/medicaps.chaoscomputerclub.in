import { useState, useMemo } from "react";
import {
  Users,
  Search,
  CheckCircle2,
  Clock,
  Download,
  Zap,
  RefreshCw,
  UserCheck,
  Award,
  FileText,
  Copy,
  Check,
  Plus,
  Sparkles,
  X,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { triggerWebhookGateScan } from "@/lib/realtime";
import { adminContestApi } from "@admin/api/adminContestApi";

interface AttendeesPanelProps {
  attendees: any[];
  isLoading: boolean;
  selectedContestSlug: string;
  proctorName: string;
  onRefresh: () => void;
}

export function AttendeesPanel({
  attendees,
  isLoading,
  selectedContestSlug,
  proctorName,
  onRefresh,
}: AttendeesPanelProps) {
  const [filter, setFilter] = useState<"all" | "checked_in" | "qualified" | "pending">("all");
  const [search, setSearch] = useState("");
  const [checkingInId, setCheckingInId] = useState<string | null>(null);
  const [selectedCadet, setSelectedCadet] = useState<any | null>(null);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [registerIdentifier, setRegisterIdentifier] = useState("");
  const [isSubmittingRegister, setIsSubmittingRegister] = useState(false);
  const [isSeedingDemo, setIsSeedingDemo] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    toast.success(`Copied ${label} to clipboard`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const stats = useMemo(() => {
    const total = attendees.length;
    const checkedIn = attendees.filter((a) => a.check_in_status === "checked_in").length;
    const qualified = attendees.filter(
      (a) =>
        Boolean(a.is_top_30_qualified) ||
        a.check_in_status === "issued" ||
        (a.seat_number && a.seat_number !== "UNASSIGNED")
    ).length;
    const pending = total - checkedIn;
    const rate = total > 0 ? Math.round((checkedIn / total) * 100) : 0;
    return { total, checkedIn, qualified, pending, rate };
  }, [attendees]);

  const filteredAttendees = useMemo(() => {
    return attendees.filter((a) => {
      // Filter tab
      if (filter === "checked_in" && a.check_in_status !== "checked_in") return false;
      if (
        filter === "qualified" &&
        !Boolean(a.is_top_30_qualified) &&
        a.check_in_status === "issued" &&
        (!a.seat_number || a.seat_number === "UNASSIGNED")
      ) {
        return false;
      }
      if (
        filter === "pending" &&
        (a.check_in_status === "checked_in" ||
          (Boolean(a.is_top_30_qualified) && a.seat_number && a.seat_number !== "UNASSIGNED"))
      ) {
        return false;
      }

      // Search query
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = (a.member_name || a.full_name || "").toLowerCase().includes(q);
        const matchHandle = (a.handle || "").toLowerCase().includes(q);
        const matchSeat = (a.seat_number || "").toLowerCase().includes(q);
        const matchPass = (a.pass_code || "").toLowerCase().includes(q);
        const matchPrn = (a.prn || a.enrollment_number || "").toLowerCase().includes(q);
        const matchEmail = (a.email || "").toLowerCase().includes(q);
        const matchDept = (a.department || "").toLowerCase().includes(q);
        if (!matchName && !matchHandle && !matchSeat && !matchPass && !matchPrn && !matchEmail && !matchDept) {
          return false;
        }
      }
      return true;
    });
  }, [attendees, filter, search]);

  const handleManualCheckIn = async (attendee: any) => {
    const identifier = attendee.pass_code && attendee.pass_code !== "—"
      ? attendee.pass_code
      : attendee.handle || attendee.prn || attendee.email;

    setCheckingInId(attendee.pass_code || attendee.handle || attendee.id);
    try {
      const res = await triggerWebhookGateScan(
        identifier,
        proctorName,
        selectedContestSlug
      );
      if (res.valid) {
        toast.success(
          `Admitted ${attendee.member_name || attendee.full_name || attendee.handle} to workstation ${
            res.seat_number || attendee.seat_number || "LAB-04"
          }`
        );
        onRefresh();
        if (selectedCadet && (selectedCadet.handle === attendee.handle || selectedCadet.pass_code === attendee.pass_code)) {
          setSelectedCadet({
            ...selectedCadet,
            check_in_status: "checked_in",
            seat_number: res.seat_number || selectedCadet.seat_number,
            checked_in_at: new Date().toISOString(),
            checked_in_by: proctorName,
          });
        }
      } else {
        toast.error(`Check-in failed: ${res.message || res.reason || "Invalid pass credentials"}`);
      }
    } catch (err: any) {
      toast.error(err.message || "Manual check-in error.");
    } finally {
      setCheckingInId(null);
    }
  };

  const handleRegisterCadet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerIdentifier.trim()) {
      toast.error("Please enter cadet handle, PRN, or email.");
      return;
    }
    setIsSubmittingRegister(true);
    try {
      const res = await adminContestApi.registerParticipant(selectedContestSlug, registerIdentifier.trim());
      toast.success(res.message || "Participant successfully registered!");
      setRegisterIdentifier("");
      setIsRegisterModalOpen(false);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to register participant.");
    } finally {
      setIsSubmittingRegister(false);
    }
  };

  const handleSeedDemo = async () => {
    setIsSeedingDemo(true);
    try {
      const res = await adminContestApi.seedDemoParticipants(selectedContestSlug);
      toast.success(res.message || "Seeded demo Medi-Caps participants!");
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to seed demo participants.");
    } finally {
      setIsSeedingDemo(false);
    }
  };

  const handleExportCsv = () => {
    if (attendees.length === 0) {
      toast.error("No attendees to export.");
      return;
    }
    const headers = [
      "Rank",
      "Seat Number",
      "Pass Code",
      "Full Name",
      "Handle",
      "Enrollment PRN",
      "Email",
      "Department",
      "Batch",
      "Screening Score",
      "Qualified Finalist",
      "Check-in Status",
      "Checked In At",
      "Checked In By",
      "Registered At",
    ];
    const rows = attendees.map((a) => [
      a.rank ?? "—",
      a.seat_number || "UNASSIGNED",
      a.pass_code || "—",
      `"${a.member_name || a.full_name || ""}"`,
      `"@${a.handle || ""}"`,
      a.prn || a.enrollment_number || "—",
      a.email || "—",
      a.department || "CSE",
      a.batch || "2023-27",
      a.screening_score ?? 0,
      a.is_top_30_qualified ? "YES" : "NO",
      a.check_in_status || "registered",
      a.checked_in_at ? `"${a.checked_in_at}"` : "N/A",
      a.checked_in_by ? `"${a.checked_in_by}"` : "N/A",
      a.registered_at ? `"${a.registered_at}"` : "N/A",
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ccc_${selectedContestSlug}_cadet_roster.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Attendee roster exported to CSV.");
  };

  return (
    <div className="space-y-5 font-mono">
      {/* ─── TELEMETRY SUMMARY CARDS ───────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Registered */}
        <div className="p-3.5 border border-white/[0.08] bg-[#111111]">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span className="flex items-center gap-1.5 uppercase font-bold text-[11px] tracking-wider">
              <Users className="w-3.5 h-3.5 text-lime-400" />
              Total Registered
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">PORTAL</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-white tabular-nums">
              {stats.total}
            </span>
            <span className="text-[10px] text-zinc-400 uppercase font-mono">
              Cadets Enrolled
            </span>
          </div>
          <div className="mt-1 text-[10px] text-zinc-500 truncate">
            Registered for {selectedContestSlug}
          </div>
        </div>

        {/* Top 30 Qualified */}
        <div className="p-3.5 border border-white/[0.08] bg-[#111111]">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span className="flex items-center gap-1.5 uppercase font-bold text-[11px] tracking-wider">
              <Award className="w-3.5 h-3.5 text-amber-400" />
              Finalists Qualified
            </span>
            <span className="text-[10px] text-amber-400/80 font-mono">TOP 30</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-amber-400 tabular-nums">
              {stats.qualified}
            </span>
            <span className="text-[10px] text-zinc-400 uppercase font-mono">
              Passes Issued
            </span>
          </div>
          <div className="mt-1 text-[10px] text-zinc-500 truncate">
            Phase 1 Screening Cutoff met
          </div>
        </div>

        {/* Turnstile Admitted */}
        <div className="p-3.5 border border-white/[0.08] bg-[#111111]">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span className="flex items-center gap-1.5 uppercase font-bold text-[11px] tracking-wider">
              <CheckCircle2 className="w-3.5 h-3.5 text-lime-400" />
              Lab Turnstiles
            </span>
            <span className="text-[10px] text-lime-400 font-mono font-bold tabular-nums">
              {stats.rate}%
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-lime-400 tabular-nums">
              {stats.checkedIn}
              <span className="text-xs font-normal text-zinc-500 ml-1">/ {stats.total || 30}</span>
            </span>
            <span className="text-[10px] text-zinc-400 uppercase font-mono">
              Workstations Seated
            </span>
          </div>
          <div className="mt-2 w-full bg-zinc-900 h-1 border border-white/5 overflow-hidden">
            <div
              className="bg-lime-400 h-full transition-all duration-300"
              style={{ width: `${Math.min(100, stats.rate)}%` }}
            />
          </div>
        </div>

        {/* Pending Verification */}
        <div className="p-3.5 border border-white/[0.08] bg-[#111111]">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span className="flex items-center gap-1.5 uppercase font-bold text-[11px] tracking-wider">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              Pending Gate Scan
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">LAB 04</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-white tabular-nums">
              {stats.pending}
            </span>
            <span className="text-[10px] text-zinc-400 uppercase font-mono">
              Awaiting Entrance
            </span>
          </div>
          <div className="mt-1 text-[10px] text-zinc-500 truncate">
            Ready for camera or code verify
          </div>
        </div>
      </div>

      {/* ─── MAIN ROSTER CARD ──────────────────────────────────── */}
      <Card className="bg-[#111111] border border-white/[0.08] rounded-none">
        <CardHeader className="border-b border-white/[0.08] py-3 px-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={`px-2.5 py-1 text-xs font-mono font-bold uppercase rounded-none cursor-pointer transition-colors ${
                  filter === "all"
                    ? "bg-lime-400 text-black shadow-[0_0_8px_rgba(204,255,0,0.3)]"
                    : "text-zinc-400 hover:text-white bg-zinc-900 border border-white/10"
                }`}
              >
                All Registered ({stats.total})
              </button>
              <button
                type="button"
                onClick={() => setFilter("checked_in")}
                className={`px-2.5 py-1 text-xs font-mono font-bold uppercase rounded-none cursor-pointer transition-colors ${
                  filter === "checked_in"
                    ? "bg-lime-400 text-black shadow-[0_0_8px_rgba(204,255,0,0.3)]"
                    : "text-zinc-400 hover:text-white bg-zinc-900 border border-white/10"
                }`}
              >
                Admitted ({stats.checkedIn})
              </button>
              <button
                type="button"
                onClick={() => setFilter("qualified")}
                className={`px-2.5 py-1 text-xs font-mono font-bold uppercase rounded-none cursor-pointer transition-colors ${
                  filter === "qualified"
                    ? "bg-lime-400 text-black shadow-[0_0_8px_rgba(204,255,0,0.3)]"
                    : "text-zinc-400 hover:text-white bg-zinc-900 border border-white/10"
                }`}
              >
                Top 30 Qualifiers ({stats.qualified})
              </button>
              <button
                type="button"
                onClick={() => setFilter("pending")}
                className={`px-2.5 py-1 text-xs font-mono font-bold uppercase rounded-none cursor-pointer transition-colors ${
                  filter === "pending"
                    ? "bg-lime-400 text-black shadow-[0_0_8px_rgba(204,255,0,0.3)]"
                    : "text-zinc-400 hover:text-white bg-zinc-900 border border-white/10"
                }`}
              >
                Pending Clearance ({stats.pending})
              </button>
            </div>

            {/* Actions Bar */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-2.5" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, PRN, handle, seat..."
                  className="pl-8 bg-black border-white/15 text-xs font-mono text-white rounded-none h-8 w-44 sm:w-64 focus-visible:ring-2 focus-visible:ring-lime-400"
                />
              </div>

              {/* Register Cadet Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsRegisterModalOpen(true)}
                className="h-8 px-2.5 border-white/15 bg-zinc-900 text-zinc-200 hover:text-white hover:border-lime-400 font-mono text-xs rounded-none cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 sm:mr-1 text-lime-400" />
                <span className="hidden sm:inline">Register Cadet</span>
              </Button>

              {/* Seed Demo Button (Visible when roster has few or 0 participants) */}
              {attendees.length < 5 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSeedDemo}
                  disabled={isSeedingDemo}
                  className="h-8 px-2.5 border-amber-400/30 bg-amber-950/20 text-amber-300 hover:bg-amber-400/20 font-mono text-xs rounded-none cursor-pointer"
                >
                  <Sparkles className={`w-3.5 h-3.5 sm:mr-1 text-amber-400 ${isSeedingDemo ? "animate-spin" : ""}`} />
                  <span className="hidden sm:inline">Seed Test Data</span>
                </Button>
              )}

              {/* Export CSV */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCsv}
                className="h-8 px-2.5 border-white/15 bg-zinc-900 text-zinc-300 hover:text-white font-mono text-xs rounded-none cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 sm:mr-1 text-lime-400" />
                <span className="hidden sm:inline">CSV</span>
              </Button>

              {/* Sync */}
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                disabled={isLoading}
                className="h-8 px-2.5 border-white/15 bg-zinc-900 text-zinc-300 hover:text-white font-mono text-xs rounded-none cursor-pointer"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 sm:mr-1 text-lime-400 ${
                    isLoading ? "animate-spin" : ""
                  }`}
                />
                <span className="hidden sm:inline">Sync</span>
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-black font-mono text-xs border-b border-white/10">
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-zinc-400 font-mono uppercase tracking-wider text-[11px] w-32">
                  Workstation & Rank
                </TableHead>
                <TableHead className="text-zinc-400 font-mono uppercase tracking-wider text-[11px]">
                  Cadet Dossier & Academic Info
                </TableHead>
                <TableHead className="text-zinc-400 font-mono uppercase tracking-wider text-[11px] w-48">
                  Screening & Qualification
                </TableHead>
                <TableHead className="text-zinc-400 font-mono uppercase tracking-wider text-[11px] w-36">
                  Pass Code
                </TableHead>
                <TableHead className="text-zinc-400 font-mono uppercase tracking-wider text-[11px] w-32">
                  Gate Clearance
                </TableHead>
                <TableHead className="text-zinc-400 font-mono uppercase tracking-wider text-[11px] text-right w-44">
                  Actions & Inspection
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="font-mono text-xs divide-y divide-white/5">
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-16 text-zinc-400 font-mono">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-lime-400" />
                      <span>Reading encrypted cadet manifests & portal registrations...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredAttendees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-16 text-zinc-400 font-mono">
                    <div className="space-y-2">
                      <p className="text-zinc-300 font-bold">No cadets match the active filter criteria.</p>
                      <p className="text-zinc-500 text-xs max-w-md mx-auto">
                        Students who register on the portal or receive passes for {selectedContestSlug} appear here automatically.
                      </p>
                      {attendees.length === 0 && (
                        <div className="pt-2">
                          <Button
                            size="sm"
                            onClick={handleSeedDemo}
                            disabled={isSeedingDemo}
                            className="bg-lime-400 text-black hover:bg-lime-300 font-bold text-xs rounded-none cursor-pointer"
                          >
                            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                            Populate Demo Registrations (10 Cadets)
                          </Button>
                        </div>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredAttendees.map((a, idx) => {
                  const isCheckedIn = a.check_in_status === "checked_in";
                  const isQualified = Boolean(a.is_top_30_qualified) || a.check_in_status === "issued";
                  const rankDisplay = a.rank ? `#${a.rank}` : "—";
                  const prn = a.prn || a.enrollment_number || "—";
                  const email = a.email || "—";

                  return (
                    <TableRow
                      key={a.id || a.pass_code || a.handle || idx}
                      className="border-white/5 hover:bg-zinc-900/50 transition-colors cursor-pointer"
                      onClick={(e) => {
                        // Don't open modal if clicking a button
                        if ((e.target as HTMLElement).closest("button")) return;
                        setSelectedCadet(a);
                      }}
                    >
                      {/* Workstation Seat & Rank */}
                      <TableCell className="py-3.5 font-bold">
                        <div className="flex flex-col gap-1">
                          <div
                            className={`px-2 py-1 text-xs font-mono font-extrabold tracking-wider border text-center rounded-none ${
                              isCheckedIn
                                ? "bg-lime-400/10 border-lime-400/40 text-lime-400 shadow-[0_0_6px_rgba(204,255,0,0.15)]"
                                : isQualified
                                ? "bg-amber-400/10 border-amber-400/30 text-amber-300"
                                : "bg-zinc-900/80 border-white/10 text-zinc-500"
                            }`}
                          >
                            {a.seat_number && a.seat_number !== "UNASSIGNED" ? a.seat_number : "STANDBY"}
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-zinc-500 px-0.5">
                            <span>RANK:</span>
                            <span className="text-zinc-300 font-bold">{rankDisplay}</span>
                          </div>
                        </div>
                      </TableCell>

                      {/* Cadet Identity & Academic Info */}
                      <TableCell className="py-3.5">
                        <div className="flex items-start gap-2.5">
                          <div className="w-8 h-8 rounded-none bg-zinc-900 border border-white/10 flex items-center justify-center text-xs font-bold text-lime-400 shrink-0 uppercase">
                            {(a.member_name || a.full_name || a.handle || "C").slice(0, 2)}
                          </div>
                          <div className="min-w-0">
                            <div className="text-white font-bold tracking-wide truncate flex items-center gap-2">
                              <span>{a.member_name || a.full_name || a.handle}</span>
                              {prn !== "—" && (
                                <span className="px-1.5 py-0.2 bg-zinc-900 border border-white/10 text-[10px] text-zinc-400 font-mono tracking-wider font-normal">
                                  {prn}
                                </span>
                              )}
                            </div>
                            <div className="text-zinc-400 text-[11px] flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-lime-400/90 font-bold">@{a.handle}</span>
                              <span>•</span>
                              <span className="text-zinc-300">{a.department || "CSE"}</span>
                              <span>•</span>
                              <span className="text-zinc-500">{a.batch || "2023-27"}</span>
                              {email !== "—" && (
                                <>
                                  <span>•</span>
                                  <span className="text-zinc-500 truncate max-w-[180px]">{email}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>

                      {/* Screening Assessment & Qualification */}
                      <TableCell className="py-3.5">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-zinc-400">Score:</span>
                            <span className="text-xs font-bold font-mono text-white tabular-nums">
                              {a.screening_score !== null && a.screening_score !== undefined
                                ? `${Number(a.screening_score).toFixed(1)} / 100`
                                : "Not Taken"}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {isQualified ? (
                              <Badge className="bg-lime-400/10 text-lime-400 border-lime-400/30 text-[9px] font-mono font-bold uppercase rounded-none tracking-widest px-1.5 py-0">
                                TOP 30 QUALIFIER
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="bg-zinc-900 text-zinc-400 border-white/10 text-[9px] font-mono uppercase rounded-none tracking-wider px-1.5 py-0"
                              >
                                REGISTERED
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      {/* Pass Code */}
                      <TableCell className="text-zinc-400 text-[11px] font-mono py-3.5">
                        {a.pass_code && a.pass_code !== "—" ? (
                          <div className="flex items-center gap-1">
                            <span className="px-2 py-0.5 bg-black border border-white/10 text-zinc-300 select-all text-[11px] truncate max-w-[120px]">
                              {a.pass_code}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(a.pass_code, "Pass Code");
                              }}
                              className="p-1 hover:text-white text-zinc-500 cursor-pointer"
                              title="Copy Pass Code"
                            >
                              {copiedField === "Pass Code" ? (
                                <Check className="w-3 h-3 text-lime-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-zinc-600 text-xs">Pending Pass</span>
                        )}
                      </TableCell>

                      {/* Gate Clearance Status */}
                      <TableCell className="py-3.5">
                        {isCheckedIn ? (
                          <Badge className="bg-lime-400/15 text-lime-400 border-lime-400/40 text-[10px] font-mono font-bold uppercase rounded-none tracking-wider px-2 py-0.5 flex items-center gap-1 w-fit">
                            <CheckCircle2 className="w-3 h-3" />
                            ADMITTED
                          </Badge>
                        ) : isQualified ? (
                          <Badge
                            variant="outline"
                            className="bg-amber-400/10 text-amber-400 border-amber-400/30 text-[10px] font-mono font-bold uppercase rounded-none tracking-wider px-2 py-0.5 flex items-center gap-1 w-fit"
                          >
                            <Clock className="w-3 h-3" />
                            AWAITING SCAN
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-zinc-900 text-zinc-400 border-white/10 text-[10px] font-mono uppercase rounded-none tracking-wider px-2 py-0.5 w-fit"
                          >
                            REGISTERED
                          </Badge>
                        )}
                      </TableCell>

                      {/* Actions & Dossier */}
                      <TableCell className="text-right py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View Dossier Button */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedCadet(a);
                            }}
                            className="h-8 px-2.5 text-xs font-mono border-white/15 bg-zinc-900 text-zinc-300 hover:text-white hover:border-lime-400 rounded-none cursor-pointer"
                            title="View Full Cadet Dossier"
                          >
                            <FileText className="w-3.5 h-3.5 sm:mr-1 text-cyan-400" />
                            <span className="hidden sm:inline">Dossier</span>
                          </Button>

                          {/* Quick Admit Button */}
                          {!isCheckedIn ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={checkingInId === (a.pass_code || a.handle || a.id)}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleManualCheckIn(a);
                              }}
                              className="h-8 px-2.5 text-xs font-mono font-bold uppercase tracking-wider bg-zinc-900 border-white/15 text-zinc-200 hover:text-black hover:bg-lime-400 hover:border-lime-400 rounded-none cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-lime-400"
                            >
                              <Zap className="w-3.5 h-3.5 sm:mr-1 text-amber-400" />
                              <span className="hidden sm:inline">Admit</span>
                            </Button>
                          ) : (
                            <div className="flex flex-col items-end">
                              <span className="text-[11px] text-lime-400 font-mono font-bold tabular-nums">
                                {a.checked_in_at
                                  ? new Date(a.checked_in_at).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                      second: "2-digit",
                                    })
                                  : "Admitted"}
                              </span>
                              <span className="text-[9px] text-zinc-500 font-mono uppercase">
                                Verified
                              </span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ─── CADET DOSSIER MODAL ───────────────────────────────── */}
      {selectedCadet && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111111] border border-white/20 w-full max-w-2xl max-h-[90vh] overflow-y-auto font-mono shadow-[0_0_30px_rgba(0,0,0,0.8)]">
            {/* Header */}
            <div className="border-b border-white/10 p-4 flex items-center justify-between bg-black/60 sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-lime-400" />
                <span className="text-xs font-bold uppercase tracking-widest text-lime-400">
                  CADET DOSSIER // VERIFIED PORTAL RECORD
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCadet(null)}
                className="text-zinc-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Profile Overview */}
            <div className="p-6 space-y-6">
              <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-zinc-900 border-2 border-lime-400 flex items-center justify-center text-lg font-black text-lime-400 shadow-[0_0_10px_rgba(204,255,0,0.2)]">
                    {(selectedCadet.member_name || selectedCadet.full_name || selectedCadet.handle || "C").slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white tracking-tight">
                      {selectedCadet.member_name || selectedCadet.full_name || selectedCadet.handle}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-zinc-400 mt-0.5">
                      <span className="text-lime-400 font-bold">@{selectedCadet.handle}</span>
                      <span>•</span>
                      <span>{selectedCadet.department || "CSE"}</span>
                      <span>•</span>
                      <span>Rating: {selectedCadet.rating ?? 1200}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  {selectedCadet.check_in_status === "checked_in" ? (
                    <Badge className="bg-lime-400 text-black border-lime-400 font-bold text-xs uppercase px-2.5 py-1">
                      GATE ADMITTED
                    </Badge>
                  ) : selectedCadet.is_top_30_qualified ? (
                    <Badge className="bg-amber-400/20 text-amber-300 border-amber-400 font-bold text-xs uppercase px-2.5 py-1">
                      TOP 30 FINALIST
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-zinc-300 border-white/20 text-xs uppercase px-2.5 py-1">
                      REGISTERED CADET
                    </Badge>
                  )}
                </div>
              </div>

              {/* 3 Information Grid Blocks */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Block 1: Academic & University Records */}
                <div className="p-4 border border-white/10 bg-black/40 space-y-2.5">
                  <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-lime-400" />
                    University Academic Record
                  </span>
                  <div className="space-y-1.5 text-xs pt-1">
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-500">Enrollment (PRN):</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-white select-all">
                          {selectedCadet.prn || selectedCadet.enrollment_number || "—"}
                        </span>
                        {(selectedCadet.prn || selectedCadet.enrollment_number) && (
                          <button
                            type="button"
                            onClick={() =>
                              copyToClipboard(selectedCadet.prn || selectedCadet.enrollment_number, "PRN")
                            }
                            className="text-zinc-500 hover:text-white"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-500">University Email:</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-zinc-300 select-all truncate max-w-[180px]">
                          {selectedCadet.email || "—"}
                        </span>
                        {selectedCadet.email && (
                          <button
                            type="button"
                            onClick={() => copyToClipboard(selectedCadet.email, "Email")}
                            className="text-zinc-500 hover:text-white"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-500">Department:</span>
                      <span className="text-zinc-300">{selectedCadet.department || "CSE"}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-500">Academic Batch:</span>
                      <span className="text-zinc-300">{selectedCadet.batch || "2023-27"}</span>
                    </div>
                  </div>
                </div>

                {/* Block 2: Contest & Screening Status */}
                <div className="p-4 border border-white/10 bg-black/40 space-y-2.5">
                  <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-amber-400" />
                    Screening & Qualification
                  </span>
                  <div className="space-y-1.5 text-xs pt-1">
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-500">Contest Session:</span>
                      <span className="text-white font-bold">{selectedContestSlug}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-500">Screening Score:</span>
                      <span className="text-lime-400 font-bold tabular-nums">
                        {selectedCadet.screening_score !== null && selectedCadet.screening_score !== undefined
                          ? `${Number(selectedCadet.screening_score).toFixed(1)} / 100`
                          : "Pending / 0.0"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-500">Screening Rank:</span>
                      <span className="text-white font-bold">
                        {selectedCadet.rank ? `#${selectedCadet.rank}` : "Unranked"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-500">Registration Time:</span>
                      <span className="text-zinc-400 text-[11px]">
                        {selectedCadet.registered_at
                          ? new Date(selectedCadet.registered_at).toLocaleString()
                          : "Confirmed"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Block 3: Lab Workstation & Gate Credentials (Full width) */}
                <div className="md:col-span-2 p-4 border border-white/10 bg-black/40 space-y-3">
                  <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-lime-400" />
                    Physical Lab Clearance & Credentials
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
                    <div className="p-2.5 bg-zinc-900/60 border border-white/10">
                      <span className="text-[10px] text-zinc-500 uppercase block">Workstation Seat</span>
                      <span className="text-sm font-bold text-white mt-1 block">
                        {selectedCadet.seat_number && selectedCadet.seat_number !== "UNASSIGNED"
                          ? selectedCadet.seat_number
                          : "Unassigned (Auto at gate)"}
                      </span>
                    </div>
                    <div className="p-2.5 bg-zinc-900/60 border border-white/10">
                      <span className="text-[10px] text-zinc-500 uppercase block">Campus Pass Code</span>
                      <span className="text-xs font-mono text-lime-400 select-all mt-1 block truncate">
                        {selectedCadet.pass_code && selectedCadet.pass_code !== "—"
                          ? selectedCadet.pass_code
                          : "Pending Generation"}
                      </span>
                    </div>
                    <div className="p-2.5 bg-zinc-900/60 border border-white/10">
                      <span className="text-[10px] text-zinc-500 uppercase block">Turnstile Status</span>
                      <span className="text-xs font-bold mt-1 block">
                        {selectedCadet.check_in_status === "checked_in" ? (
                          <span className="text-lime-400">ADMITTED</span>
                        ) : (
                          <span className="text-amber-400">AWAITING SCAN</span>
                        )}
                      </span>
                    </div>
                  </div>

                  {selectedCadet.checked_in_at && (
                    <div className="text-[11px] text-zinc-400 pt-1 border-t border-white/5 flex items-center justify-between">
                      <span>Admitted at: {new Date(selectedCadet.checked_in_at).toLocaleString()}</span>
                      <span>Proctor: {selectedCadet.checked_in_by || "Hardware Gate"}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-white/10">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    copyToClipboard(JSON.stringify(selectedCadet, null, 2), "Dossier JSON")
                  }
                  className="h-8 text-xs font-mono border-white/15 bg-zinc-900 text-zinc-300 hover:text-white rounded-none cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5 mr-1 text-cyan-400" />
                  Copy Dossier JSON
                </Button>

                <div className="flex items-center gap-2">
                  {selectedCadet.check_in_status !== "checked_in" && (
                    <Button
                      size="sm"
                      onClick={() => handleManualCheckIn(selectedCadet)}
                      disabled={checkingInId === (selectedCadet.pass_code || selectedCadet.handle || selectedCadet.id)}
                      className="h-8 text-xs font-mono font-bold uppercase tracking-wider bg-lime-400 text-black hover:bg-lime-300 rounded-none cursor-pointer"
                    >
                      <Zap className="w-3.5 h-3.5 mr-1" />
                      Admit Cadet to Lab
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedCadet(null)}
                    className="h-8 text-xs font-mono border-white/15 bg-zinc-900 text-zinc-400 hover:text-white rounded-none cursor-pointer"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── REGISTER CADET MODAL ──────────────────────────────── */}
      {isRegisterModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111111] border border-white/20 w-full max-w-md font-mono shadow-2xl">
            <div className="border-b border-white/10 p-4 flex items-center justify-between bg-black/60">
              <span className="text-xs font-bold uppercase tracking-widest text-lime-400 flex items-center gap-1.5">
                <Plus className="w-4 h-4" />
                Register Cadet for Contest
              </span>
              <button
                type="button"
                onClick={() => setIsRegisterModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRegisterCadet} className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-300 uppercase">
                  Cadet Identifier (Handle, PRN, or Email):
                </label>
                <Input
                  value={registerIdentifier}
                  onChange={(e) => setRegisterIdentifier(e.target.value)}
                  placeholder="e.g. en23cs301927 or santusht"
                  className="bg-black border-white/20 text-xs font-mono text-white rounded-none h-9 focus-visible:ring-2 focus-visible:ring-lime-400"
                  autoFocus
                />
                <span className="text-[10px] text-zinc-500">
                  Target Contest: {selectedContestSlug}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsRegisterModalOpen(false)}
                  className="h-8 text-xs font-mono border-white/15 bg-zinc-900 text-zinc-400 hover:text-white rounded-none cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmittingRegister || !registerIdentifier.trim()}
                  className="h-8 text-xs font-mono font-bold uppercase bg-lime-400 text-black hover:bg-lime-300 rounded-none cursor-pointer"
                >
                  {isSubmittingRegister ? "Registering..." : "Confirm Registration"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
