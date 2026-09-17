import { useState, useEffect, useCallback } from "react";
import { Toaster, toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QrCode, Users, Layers, Radio, ShieldAlert } from "lucide-react";
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
    return localStorage.getItem("ccc_proctor_name") || "Chief Proctor (Dr. Ratnesh Litoriya)";
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

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100 font-mono admin-grid-bg">
      <Toaster position="top-right" richColors />

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
            {/* Contest Switcher Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0a0a0a] border border-white/10 p-3 rounded-sm">
              <div className="flex items-center gap-3">
                <span className="text-xs text-zinc-400 uppercase font-bold">Target Contest:</span>
                <select
                  value={selectedSlug}
                  onChange={(e) => setSelectedSlug(e.target.value)}
                  className="bg-black border border-zinc-800 text-xs font-mono text-white px-3 py-1.5 rounded-none focus:border-red-500"
                >
                  {contests.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.title} ({c.status.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <span>Active Workstations:</span>
                <span className="text-emerald-400 font-bold font-mono">
                  {attendees.filter((a) => a.check_in_status === "checked_in").length} / {attendees.length || 30} Occupied
                </span>
              </div>
            </div>

            {/* Navigation Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="bg-zinc-950 border border-zinc-800 p-1 rounded-sm flex flex-wrap gap-1">
                <TabsTrigger
                  value="gate_scanner"
                  className="font-mono text-xs uppercase data-[state=active]:bg-red-600 data-[state=active]:text-white rounded-none py-2 px-4 flex items-center gap-2"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  Gate QR Scanner
                </TabsTrigger>

                <TabsTrigger
                  value="attendees"
                  className="font-mono text-xs uppercase data-[state=active]:bg-red-600 data-[state=active]:text-white rounded-none py-2 px-4 flex items-center gap-2"
                >
                  <Users className="w-3.5 h-3.5" />
                  Workstation Roster ({attendees.length})
                </TabsTrigger>

                <TabsTrigger
                  value="operations"
                  className="font-mono text-xs uppercase data-[state=active]:bg-red-600 data-[state=active]:text-white rounded-none py-2 px-4 flex items-center gap-2"
                >
                  <Layers className="w-3.5 h-3.5" />
                  Contest Operations
                </TabsTrigger>

                <TabsTrigger
                  value="webhooks"
                  className="font-mono text-xs uppercase data-[state=active]:bg-red-600 data-[state=active]:text-white rounded-none py-2 px-4 flex items-center gap-2"
                >
                  <Radio className="w-3.5 h-3.5" />
                  Webhooks & Streams ({eventsLog.length})
                </TabsTrigger>
              </TabsList>

              {/* 1. Gate Scanner */}
              <TabsContent value="gate_scanner" className="focus-visible:outline-none">
                <GateScannerPanel
                  selectedContestSlug={selectedSlug}
                  proctorName={proctorName}
                  recentScans={recentScans}
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
