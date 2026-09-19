import { useState, useEffect, useCallback, useMemo } from "react";
import { Toaster, toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QrCode, Users, Layers, Radio, ShieldAlert, Monitor, CheckCircle2, AlertTriangle, ArrowUpRight, Trophy } from "lucide-react";
import { AdminHeader } from "@admin/components/AdminHeader";
import { GateScannerPanel } from "@admin/components/GateScannerPanel";
import { AttendeesPanel } from "@admin/components/AttendeesPanel";
import { ContestOperationsPanel } from "@admin/components/ContestOperationsPanel";
import { ContestManagerPanel } from "@admin/components/ContestManagerPanel";
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

  const handleAuthenticated = (name: string, key?: string) => {
    setProctorName(name);
    setIsAuthenticated(true);
    localStorage.setItem("ccc_proctor_auth", "true");
    localStorage.setItem("ccc_proctor_name", name);
    if (key) {
      localStorage.setItem("ccc_proctor_key", key);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem("ccc_proctor_auth");
    localStorage.removeItem("ccc_proctor_name");
    localStorage.removeItem("ccc_proctor_key");
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
    <div className="min-h-screen bg-[#0a0a0a] text-[#eaeaea] font-mono">
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

          <main className="flex-1 max-w-[1720px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-5">
            {/* ─── TACTICAL CONTEST CONTEXT & TELEMETRY STRIP ───────────────── */}
            <div className="p-3 border border-white/[0.08] bg-[#111111] flex flex-col md:flex-row md:items-center justify-between gap-4">
              {/* Contest Selector & Edition Badge */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">
                  ACTIVE CONTEST:
                </span>
                <div className="relative">
                  <select
                    id="admin-target-contest"
                    value={selectedSlug}
                    onChange={(e) => setSelectedSlug(e.target.value)}
                    className="bg-black border border-white/20 text-xs font-mono text-white pl-3 pr-8 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 cursor-pointer appearance-none"
                  >
                    {contests.map((c) => (
                      <option key={c.slug} value={c.slug}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                  <span className="absolute right-2.5 top-2 pointer-events-none text-zinc-400 text-xs">▼</span>
                </div>

                <span
                  className={`px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-widest border ${
                    selectedContest?.status === "live"
                      ? "border-lime-400/50 bg-lime-400/10 text-lime-400 shadow-[0_0_10px_rgba(204,255,0,0.2)]"
                      : "border-white/10 bg-zinc-900 text-zinc-400"
                  }`}
                >
                  {selectedContest?.status === "live" ? "● LIVE ARENA" : selectedContest?.status?.toUpperCase() || "UPCOMING"}
                </span>

                <span className="text-xs text-zinc-500 hidden sm:inline">
                  Edition #{selectedContest?.edition ?? 1} · {selectedContest?.venue || "Lab 04"}
                </span>
              </div>

              {/* Real-time Turnstile Stats Pill */}
              <div className="flex items-center gap-4 text-xs font-mono">
                <div className="flex items-center gap-2 bg-black/60 border border-white/10 px-3 py-1">
                  <span className="text-zinc-400 text-[11px]">ADMITTED:</span>
                  <span className="text-lime-400 font-bold tabular-nums text-sm">
                    {checkedInCount}
                  </span>
                  <span className="text-zinc-600">/</span>
                  <span className="text-zinc-300 tabular-nums">
                    {attendees.length || totalSeats}
                  </span>
                  <div className="w-12 bg-zinc-800 h-1 ml-1 overflow-hidden">
                    <div
                      className="bg-lime-400 h-full"
                      style={{ width: `${Math.min(100, Math.round((checkedInCount / (attendees.length || totalSeats || 1)) * 100))}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-1.5 bg-black/60 border border-white/10 px-3 py-1">
                  <span className="text-zinc-400 text-[11px]">TOTAL SCANS:</span>
                  <span className="text-white font-bold tabular-nums text-sm">
                    {recentScans.length}
                  </span>
                </div>
              </div>
            </div>

            {/* ─── TACTICAL NAVIGATION TABS ───────────────────────── */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList className="bg-[#111111] border border-white/[0.08] p-1 flex flex-wrap gap-1.5 h-auto">
                <TabsTrigger
                  value="gate_scanner"
                  className="font-mono text-xs uppercase font-bold tracking-wider data-[state=active]:bg-lime-400 data-[state=active]:text-black text-zinc-400 hover:text-white py-2 px-4 flex items-center gap-2 cursor-pointer transition-all focus-visible:ring-2 focus-visible:ring-lime-400 shadow-none data-[state=active]:shadow-[0_0_12px_rgba(204,255,0,0.25)]"
                >
                  <QrCode className="w-4 h-4" />
                  Scanner Console
                </TabsTrigger>

                <TabsTrigger
                  value="attendees"
                  className="font-mono text-xs uppercase font-bold tracking-wider data-[state=active]:bg-lime-400 data-[state=active]:text-black text-zinc-400 hover:text-white py-2 px-4 flex items-center gap-2 cursor-pointer transition-all focus-visible:ring-2 focus-visible:ring-lime-400 shadow-none data-[state=active]:shadow-[0_0_12px_rgba(204,255,0,0.25)]"
                >
                  <Users className="w-4 h-4" />
                  Roster ({attendees.length})
                </TabsTrigger>

                <TabsTrigger
                  value="operations"
                  className="font-mono text-xs uppercase font-bold tracking-wider data-[state=active]:bg-lime-400 data-[state=active]:text-black text-zinc-400 hover:text-white py-2 px-4 flex items-center gap-2 cursor-pointer transition-all focus-visible:ring-2 focus-visible:ring-lime-400 shadow-none data-[state=active]:shadow-[0_0_12px_rgba(204,255,0,0.25)]"
                >
                  <Layers className="w-4 h-4" />
                  Mission Control & Operations
                </TabsTrigger>

                <TabsTrigger
                  value="contests"
                  className="font-mono text-xs uppercase font-bold tracking-wider data-[state=active]:bg-lime-400 data-[state=active]:text-black text-zinc-400 hover:text-white py-2 px-4 flex items-center gap-2 cursor-pointer transition-all focus-visible:ring-2 focus-visible:ring-lime-400 shadow-none data-[state=active]:shadow-[0_0_12px_rgba(204,255,0,0.25)]"
                >
                  <Trophy className="w-4 h-4" />
                  Contest Manager
                </TabsTrigger>

                <TabsTrigger
                  value="webhooks"
                  className="font-mono text-xs uppercase font-bold tracking-wider data-[state=active]:bg-lime-400 data-[state=active]:text-black text-zinc-400 hover:text-white py-2 px-4 flex items-center gap-2 cursor-pointer transition-all focus-visible:ring-2 focus-visible:ring-lime-400 shadow-none data-[state=active]:shadow-[0_0_12px_rgba(204,255,0,0.25)]"
                >
                  <Radio className="w-4 h-4" />
                  Live Webhooks ({eventsLog.length})
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
                  attendees={attendees}
                />
              </TabsContent>

              {/* 4. Full Contest CRUD & Assessment/Question Manager */}
              <TabsContent value="contests" className="focus-visible:outline-none">
                <ContestManagerPanel onContestListChanged={loadContests} />
              </TabsContent>

              {/* 5. Webhooks & Event Monitor */}
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
