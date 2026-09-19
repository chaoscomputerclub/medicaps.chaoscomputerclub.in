import { useState, useEffect, useCallback, useMemo } from "react";
import { Toaster, toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QrCode, Users, Layers, Radio, ShieldAlert, Monitor, CheckCircle2, AlertTriangle, ArrowUpRight } from "lucide-react";
import { AdminHeader } from "@admin/components/AdminHeader";
import { GateScannerPanel } from "@admin/components/GateScannerPanel";
import { AttendeesPanel } from "@admin/components/AttendeesPanel";
import { ContestOperationsPanel } from "@admin/components/ContestOperationsPanel";
import { WebhooksMonitorPanel } from "@admin/components/WebhooksMonitorPanel";
import { AdminLoginModal } from "@admin/components/AdminLoginModal";
import { useRealtimeEvents } from "@/lib/realtime";
import { contestApi } from "@/features/contest/api";
import "@admin/styles/admin.css";

export function AdminApp() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem("ccc_proctor_auth") === "true";
  });
  const [proctorName, setProctorName] = useState<string>(() => {
    return localStorage.getItem("ccc_proctor_name") || "Chief Proctor (CCC Core)";
  });

  const [activeTab, setActiveTab] = useState<string>("gate_scanner");
  const [contests, setContests] = useState<any[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string>("weekly-contest-1");
  const [isLoadingContests, setIsLoadingContests] = useState(false);

  const [attendees, setAttendees] = useState<any[]>([]);
  const [isLoadingAttendees, setIsLoadingAttendees] = useState(false);

  const [recentScans, setRecentScans] = useState<any[]>([]);
  const [eventsLog, setEventsLog] = useState<any[]>([]);
  const [isStreamConnected, setIsStreamConnected] = useState(true);

  // Load all contests
  const loadContests = useCallback(async () => {
    setIsLoadingContests(true);
    try {
      const list = await contestApi.list(true);
      setContests(list || []);
      if (list && list.length > 0) {
        const liveOrFirst = list.find((c: any) => c.status === "live") || list[0];
        setSelectedSlug(liveOrFirst.slug);
      }
    } catch {
      // Fallback
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
    } catch {
      setAttendees([]);
    } finally {
      setIsLoadingAttendees(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadContests();
    }
  }, [isAuthenticated, loadContests]);

  useEffect(() => {
    if (selectedSlug) {
      loadAttendees(selectedSlug);
    }
  }, [selectedSlug, loadAttendees]);

  // Real-time Push Stream (SSE) Integration
  useRealtimeEvents(selectedSlug, (event) => {
    setIsStreamConnected(true);
    setEventsLog((prev) => [event, ...prev.slice(0, 49)]);

    if (event.event === "pass_checked_in") {
      setRecentScans((prev) => [event.data, ...prev.slice(0, 19)]);
      loadAttendees(selectedSlug);
      const who = event.data?.candidate_name || event.data?.handle || "Cadet";
      const seat = event.data?.seat_number ? ` (${event.data.seat_number})` : "";
      toast.info(`Gate check-in verified: ${who}${seat}`);
    } else if (event.event === "contest_status_changed" || event.event === "top30_qualified") {
      loadContests();
      loadAttendees(selectedSlug);
    }
  });

  const handleAuthenticated = (name: string) => {
    setProctorName(name);
    setIsAuthenticated(true);
    localStorage.setItem("ccc_proctor_auth", "true");
    localStorage.setItem("ccc_proctor_name", name);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem("ccc_proctor_auth");
    toast.info("Proctor session exited.");
  };

  const handleRefreshAll = () => {
    loadContests();
    loadAttendees(selectedSlug);
    toast.success("Command Center data synchronized with server.");
  };

  const selectedContest = contests.find((c) => c.slug === selectedSlug) || contests[0];

  const checkedInCount = useMemo(() => {
    return attendees.filter((a) => a.check_in_status === "checked_in").length;
  }, [attendees]);

  const totalSeats = selectedContest?.seat_capacity || 60;
  const occupancyPercentage = Math.round((checkedInCount / (totalSeats || 60)) * 100);

  return (
    <div className="min-h-screen bg-black text-slate-100 font-mono admin-grid-bg">
      <Toaster position="top-right" richColors theme="dark" />

      {/* Proctor Authentication Guard */}
      {!isAuthenticated && <AdminLoginModal onAuthenticated={handleAuthenticated} />}

      {/* Main Command Center Frame */}
      {isAuthenticated && (
        <div className="flex flex-col min-h-screen">
          <AdminHeader
            proctorName={proctorName}
            isStreamConnected={isStreamConnected}
            onLogout={handleLogout}
            onRefreshAll={handleRefreshAll}
            isRefreshing={isLoadingContests || isLoadingAttendees}
          />

          <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 space-y-6">
            {/* ─── COCKPIT TELEMETRY BENTO GRID ──────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Target Contest Status */}
              <div className="p-4 bg-zinc-950 border border-white/10 rounded-none space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-400">
                    Active Tournament
                  </span>
                  <span className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-bold uppercase rounded-none border ${
                    selectedContest?.status === "live"
                      ? "border-emerald-500/40 bg-emerald-950/40 text-emerald-400 animate-pulse"
                      : "border-lime-400/40 bg-lime-400/10 text-lime-400"
                  }`}>
                    {selectedContest?.status?.toUpperCase() || "UPCOMING"}
                  </span>
                </div>
                <h2 className="text-sm font-bold text-white truncate" title={selectedContest?.title}>
                  {selectedContest?.title || "Weekly Contest 1"}
                </h2>
                <p className="text-[11px] text-zinc-400 truncate">
                  {selectedContest?.venue || "Main Computing Lab 04"}
                </p>
              </div>

              {/* Card 2: Workstation Lab Occupancy */}
              <div className="p-4 bg-zinc-950 border border-white/10 rounded-none space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-400">
                    Lab Workstations
                  </span>
                  <span className="text-xs font-bold text-lime-400 tabular-nums">
                    {occupancyPercentage}% Occupied
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-white tabular-nums">
                    {checkedInCount}
                  </span>
                  <span className="text-xs text-zinc-400 tabular-nums">
                    / {totalSeats} seats allocated
                  </span>
                </div>
                {/* Progress bar */}
                <div className="w-full h-1.5 bg-zinc-900 overflow-hidden">
                  <div
                    className="h-full bg-lime-400 transition-all duration-300"
                    style={{ width: `${Math.min(100, occupancyPercentage)}%` }}
                  />
                </div>
              </div>

              {/* Card 3: Gate Scans Verified */}
              <div className="p-4 bg-zinc-950 border border-white/10 rounded-none space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-400">
                    Gate Throughput
                  </span>
                  <span className="text-[10px] uppercase font-bold text-zinc-400">
                    Turnstile 01
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-white tabular-nums">
                    {recentScans.length}
                  </span>
                  <span className="text-xs text-zinc-400">
                    scans this session
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 truncate">
                  {recentScans[0]
                    ? `Latest: ${recentScans[0]?.candidate_name || recentScans[0]?.handle || "Cadet"}`
                    : "Ready for scan gun input"}
                </p>
              </div>

              {/* Card 4: Hardware Air-Gap Mode */}
              <div className="p-4 bg-zinc-950 border border-white/10 rounded-none space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-400">
                    Air-Gap Security
                  </span>
                  <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase text-emerald-400 border border-emerald-500/40 bg-emerald-950/30 px-1.5 py-0.5">
                    <CheckCircle2 className="w-2.5 h-2.5" /> SECURED
                  </span>
                </div>
                <div className="text-sm font-bold text-white">
                  Physical Lab Finals
                </div>
                <p className="text-[11px] text-zinc-400">
                  Zero remote testcase access. Verified on-premise.
                </p>
              </div>
            </div>

            {/* ─── CONTEST SWITCHER & CONTROLS ─────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-950 border border-white/10 p-3.5 rounded-none">
              <div className="flex items-center gap-3">
                <label htmlFor="admin-target-contest" className="text-xs text-zinc-400 uppercase font-bold tracking-wider shrink-0">
                  Target Contest:
                </label>
                <select
                  id="admin-target-contest"
                  value={selectedSlug}
                  onChange={(e) => setSelectedSlug(e.target.value)}
                  className="bg-black border border-white/15 text-xs font-mono text-white px-3 py-1.5 rounded-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 focus-visible:border-lime-400 cursor-pointer"
                >
                  {contests.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.title} ({c.status.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3 text-xs text-zinc-400">
                <span className="text-zinc-500 uppercase text-[10px]">Workstation Allocation:</span>
                <span className="text-lime-400 font-bold tabular-nums">
                  {checkedInCount} / {attendees.length || totalSeats} Finalists Checked In
                </span>
              </div>
            </div>

            {/* ─── TACTICAL NAVIGATION TABS ───────────────────────── */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="bg-zinc-950 border border-white/10 p-1 rounded-none flex flex-wrap gap-1 h-auto">
                <TabsTrigger
                  value="gate_scanner"
                  className="font-mono text-xs uppercase font-bold tracking-wider data-[state=active]:bg-lime-400 data-[state=active]:text-black text-zinc-400 hover:text-white rounded-none py-2 px-4 flex items-center gap-2 cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-lime-400"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  Gate QR Scanner
                </TabsTrigger>

                <TabsTrigger
                  value="attendees"
                  className="font-mono text-xs uppercase font-bold tracking-wider data-[state=active]:bg-lime-400 data-[state=active]:text-black text-zinc-400 hover:text-white rounded-none py-2 px-4 flex items-center gap-2 cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-lime-400"
                >
                  <Users className="w-3.5 h-3.5" />
                  Workstation Roster
                  <span className="ml-1 px-1.5 py-0.2 text-[10px] font-mono tabular-nums border border-current">
                    {attendees.length}
                  </span>
                </TabsTrigger>

                <TabsTrigger
                  value="operations"
                  className="font-mono text-xs uppercase font-bold tracking-wider data-[state=active]:bg-lime-400 data-[state=active]:text-black text-zinc-400 hover:text-white rounded-none py-2 px-4 flex items-center gap-2 cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-lime-400"
                >
                  <Layers className="w-3.5 h-3.5" />
                  Contest Operations
                </TabsTrigger>

                <TabsTrigger
                  value="webhooks"
                  className="font-mono text-xs uppercase font-bold tracking-wider data-[state=active]:bg-lime-400 data-[state=active]:text-black text-zinc-400 hover:text-white rounded-none py-2 px-4 flex items-center gap-2 cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-lime-400"
                >
                  <Radio className="w-3.5 h-3.5" />
                  Webhooks & Streams
                  <span className="ml-1 px-1.5 py-0.2 text-[10px] font-mono tabular-nums border border-current">
                    {eventsLog.length}
                  </span>
                </TabsTrigger>
              </TabsList>

              {/* 1. Gate Scanner */}
              <TabsContent value="gate_scanner" className="focus-visible:outline-none">
                <GateScannerPanel
                  selectedContestSlug={selectedSlug}
                  proctorName={proctorName}
                  recentScans={recentScans}
                  attendees={attendees}
                  onPassCheckedIn={() => loadAttendees(selectedSlug)}
                />
              </TabsContent>

              {/* 2. Attendees Roster */}
              <TabsContent value="attendees" className="focus-visible:outline-none">
                <AttendeesPanel
                  attendees={attendees}
                  isLoading={isLoadingAttendees}
                  selectedContestSlug={selectedSlug}
                  proctorName={proctorName}
                  onRefresh={() => loadAttendees(selectedSlug)}
                />
              </TabsContent>

              {/* 3. Contest Operations */}
              <TabsContent value="operations" className="focus-visible:outline-none">
                <ContestOperationsPanel
                  contests={contests}
                  selectedContest={selectedContest}
                  onContestUpdated={loadContests}
                />
              </TabsContent>

              {/* 4. Webhooks & Event Monitor */}
              <TabsContent value="webhooks" className="focus-visible:outline-none">
                <WebhooksMonitorPanel eventsLog={eventsLog} />
              </TabsContent>
            </Tabs>
          </main>
        </div>
      )}
    </div>
  );
}
