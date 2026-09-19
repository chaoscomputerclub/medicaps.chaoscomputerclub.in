import { useState, useEffect, useMemo } from "react";
import {
  Play,
  RotateCcw,
  Clock,
  Award,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Cpu,
  Zap,
  RefreshCw,
  Lock,
  Hourglass,
  Calendar,
  Users,
  Activity,
  Terminal,
  ChevronRight,
  Server,
  Database,
  Radio,
  FileCode2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { triggerWebhookContestEvent } from "@/lib/realtime";
import { contestApi } from "@/features/contest/api";

interface ContestOperationsPanelProps {
  contests: any[];
  selectedContest: any;
  onContestUpdated: () => void;
  attendees?: any[];
}

export function ContestOperationsPanel({
  contests,
  selectedContest,
  onContestUpdated,
  attendees = [],
}: ContestOperationsPanelProps) {
  const [isActionPending, setIsActionPending] = useState(false);
  const [customTimerMinutes, setCustomTimerMinutes] = useState(90);
  const [confirmConclude, setConfirmConclude] = useState(false);
  const [confirmStart, setConfirmStart] = useState(false);

  // Operational Audit Log (in-memory terminal feed)
  const [auditLogs, setAuditLogs] = useState<
    Array<{ id: string; time: string; action: string; actor: string; type: "info" | "success" | "warn" | "error" }>
  >([
    {
      id: "log-init-1",
      time: new Date().toLocaleTimeString(),
      action: "Command Center initialized for contest session.",
      actor: "SYSTEM",
      type: "info",
    },
    {
      id: "log-init-2",
      time: new Date().toLocaleTimeString(),
      action: "Air-gapped CodeBox judge cluster heartbeat verified.",
      actor: "DAEMON",
      type: "success",
    },
  ]);

  const appendLog = (action: string, actor: string = "PROCTOR", type: "info" | "success" | "warn" | "error" = "info") => {
    setAuditLogs((prev) => [
      {
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        time: new Date().toLocaleTimeString(),
        action,
        actor,
        type,
      },
      ...prev.slice(0, 49),
    ]);
  };

  const slug = selectedContest?.slug || "weekly-contest-1";
  const status = selectedContest?.status || "upcoming";
  const seatCapacity = selectedContest?.seat_capacity || 60;
  const checkedInCount = attendees.filter((a) => a.check_in_status === "checked_in").length;
  const occupancyRate = Math.round((checkedInCount / (attendees.length || seatCapacity || 1)) * 100);

  const handleTriggerAction = async (
    action: "start_live" | "finish" | "reset_timer" | "qualify_top30",
    minutes?: number
  ) => {
    setIsActionPending(true);
    try {
      if (action === "qualify_top30") {
        appendLog(`Initiating Top 30 Finalist evaluation and digital pass generation...`, "PROCTOR", "warn");
        const res = await contestApi.qualifyTop30(slug);
        toast.success(
          `Top 30 Finalists Evaluated & Passes Issued (${res.qualified_count} cadets qualified).`
        );
        appendLog(`Top 30 Finalists qualified successfully (${res.qualified_count} passes issued).`, "PROCTOR", "success");
      } else if (action === "start_live") {
        const res = await triggerWebhookContestEvent(slug, action, minutes || customTimerMinutes);
        toast.success(res.message || `Live contest officially activated.`);
        appendLog(`Contest state transitioned to LIVE ARENA. Submissions unlocked.`, "PROCTOR", "success");
      } else if (action === "finish") {
        const res = await triggerWebhookContestEvent(slug, action, minutes || customTimerMinutes);
        toast.success(res.message || `Contest concluded and arena locked.`);
        appendLog(`Contest officially concluded. Submissions locked.`, "PROCTOR", "warn");
      } else if (action === "reset_timer") {
        const targetMins = minutes || customTimerMinutes;
        const res = await triggerWebhookContestEvent(slug, action, targetMins);
        toast.success(res.message || `Arena timer synchronized to ${targetMins} minutes.`);
        appendLog(`Arena master clock adjusted to ${targetMins} minutes.`, "PROCTOR", "info");
      }
      onContestUpdated();
    } catch (err: any) {
      toast.error(err.message || `Failed to execute action '${action}'.`);
      appendLog(`Action failure: ${err.message || action}`, "SYSTEM", "error");
    } finally {
      setIsActionPending(false);
      setConfirmConclude(false);
      setConfirmStart(false);
    }
  };

  const getStatusBadge = (st: string) => {
    switch (st) {
      case "live":
        return (
          <Badge className="bg-lime-400 text-black border-lime-400 text-xs font-mono font-extrabold uppercase tracking-widest px-3 py-1 shadow-[0_0_12px_rgba(204,255,0,0.3)]">
            <span className="w-2 h-2 bg-black animate-ping inline-block mr-1.5" />
            LIVE ARENA ACTIVE
          </Badge>
        );
      case "finished":
        return (
          <Badge className="bg-zinc-900 text-zinc-300 border-white/20 text-xs font-mono font-bold uppercase tracking-widest px-3 py-1">
            CONCLUDED & LOCKED
          </Badge>
        );
      default:
        return (
          <Badge className="bg-cyan-950/60 text-cyan-300 border-cyan-400/40 text-xs font-mono font-bold uppercase tracking-widest px-3 py-1">
            <Clock className="w-3 h-3 inline mr-1 text-cyan-400" />
            UPCOMING / SCHEDULED
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6 font-mono">
      {/* ─── 1. MISSION CONTROL HERO DISPLAY ─────────────────────────────────── */}
      <div className="admin-card p-6 border border-white/10 bg-[#09090d]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Contest & Clock Summary */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs text-lime-400 font-bold uppercase tracking-widest">
                [ TOURNAMENT MISSION CONTROL ]
              </span>
              {getStatusBadge(status)}
              <span className="text-xs text-zinc-400 border-l border-white/10 pl-3">
                Edition #{selectedContest?.edition ?? 1} · {selectedContest?.division?.toUpperCase() || "OPEN DIVISION"}
              </span>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">
                {selectedContest?.title || "CCC Weekly Contest"}
              </h2>
              <p className="text-xs text-zinc-400 mt-1 max-w-2xl leading-relaxed">
                {selectedContest?.venue || "Medi-Caps Main Lab 04"} · LAN Subnet: 10.0.4.0/24 · Air-Gapped CodeBox Cluster
              </p>
            </div>

            {/* Quick Action Trigger Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              {status !== "live" ? (
                !confirmStart ? (
                  <Button
                    onClick={() => setConfirmStart(true)}
                    disabled={isActionPending}
                    className="bg-lime-400 hover:bg-lime-300 text-black font-bold text-xs uppercase tracking-wider h-10 px-5 shadow-[0_0_15px_rgba(204,255,0,0.25)] cursor-pointer"
                  >
                    <Play className="w-4 h-4 mr-2 fill-current" />
                    Start Live Contest
                  </Button>
                ) : (
                  <div className="flex items-center gap-2 bg-black border border-lime-400/50 p-1.5">
                    <span className="text-xs text-lime-400 font-bold px-2">Launch Contest Now?</span>
                    <Button
                      size="sm"
                      onClick={() => handleTriggerAction("start_live")}
                      disabled={isActionPending}
                      className="bg-lime-400 text-black hover:bg-lime-300 font-bold text-xs h-8 px-3"
                    >
                      Confirm Launch
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setConfirmStart(false)}
                      className="border-white/15 text-zinc-400 hover:text-white text-xs h-8 px-2"
                    >
                      Cancel
                    </Button>
                  </div>
                )
              ) : (
                !confirmConclude ? (
                  <Button
                    onClick={() => setConfirmConclude(true)}
                    disabled={isActionPending}
                    variant="outline"
                    className="border-rose-500/40 bg-zinc-950 text-rose-300 hover:bg-rose-500/20 font-bold text-xs uppercase tracking-wider h-10 px-5 cursor-pointer"
                  >
                    <Lock className="w-4 h-4 mr-2 text-rose-400" />
                    Conclude & Lock Arena
                  </Button>
                ) : (
                  <div className="flex items-center gap-2 bg-black border border-rose-500/50 p-1.5">
                    <span className="text-xs text-rose-400 font-bold px-2">Freeze all submissions?</span>
                    <Button
                      size="sm"
                      onClick={() => handleTriggerAction("finish")}
                      disabled={isActionPending}
                      className="bg-rose-600 text-white hover:bg-rose-500 font-bold text-xs h-8 px-3"
                    >
                      Confirm Lock
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setConfirmConclude(false)}
                      className="border-white/15 text-zinc-400 hover:text-white text-xs h-8 px-2"
                    >
                      Cancel
                    </Button>
                  </div>
                )
              )}

              <Button
                variant="outline"
                onClick={() => handleTriggerAction("qualify_top30")}
                disabled={isActionPending}
                className="border-white/15 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-200 hover:text-white text-xs uppercase font-bold tracking-wider h-10 px-4 cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 mr-2 text-amber-400" />
                Qualify Top 30 Finalists
              </Button>
            </div>
          </div>

          {/* Master Arena Clock Controls */}
          <div className="lg:col-span-5 bg-black/80 border border-white/10 p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-xs text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                Arena Countdown Clock
              </span>
              <span className="text-[10px] text-cyan-400 bg-cyan-950/60 border border-cyan-400/30 px-2 py-0.5 uppercase tracking-widest">
                {status === "live" ? "ACTIVE COUNTDOWN" : "PRE-MATCH"}
              </span>
            </div>

            <div className="flex items-baseline justify-between py-1">
              <span className="text-3xl sm:text-4xl font-black text-white tracking-widest tabular-nums font-mono">
                {status === "live" ? "01:28:44" : "01:30:00"}
              </span>
              <span className="text-xs text-zinc-500 uppercase">HH:MM:SS</span>
            </div>

            {/* Quick Timer Adjustments */}
            <div className="space-y-2 pt-1 border-t border-white/10">
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { label: "Set 90m", mins: 90 },
                  { label: "Set 60m", mins: 60 },
                  { label: "+15m", mins: 15 },
                  { label: "+30m", mins: 30 },
                ].map((btn) => (
                  <button
                    key={btn.label}
                    type="button"
                    onClick={() => handleTriggerAction("reset_timer", btn.mins)}
                    disabled={isActionPending}
                    className="py-1.5 text-[11px] font-mono text-zinc-300 bg-zinc-900 border border-white/10 hover:border-lime-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {btn.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Input
                  type="number"
                  min="1"
                  max="300"
                  value={customTimerMinutes}
                  onChange={(e) => setCustomTimerMinutes(Number(e.target.value) || 90)}
                  className="h-8 bg-black border-white/15 text-xs text-white tabular-nums"
                  placeholder="Minutes"
                />
                <Button
                  size="sm"
                  onClick={() => handleTriggerAction("reset_timer", customTimerMinutes)}
                  disabled={isActionPending}
                  className="h-8 bg-zinc-900 border border-white/15 hover:bg-lime-400 hover:text-black text-zinc-200 text-xs font-bold uppercase px-3"
                >
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Set Clock
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── 2. FOUR HIGH-DENSITY COCKPIT TELEMETRY CARDS ───────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Workstation & Turnstile Seating */}
        <div className="admin-card p-4 space-y-3 bg-[#09090d]">
          <div className="flex items-center justify-between text-xs border-b border-white/10 pb-2">
            <span className="text-zinc-400 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-lime-400" />
              TURNSTILE SEATING
            </span>
            <span className="text-lime-400 font-bold tabular-nums">{occupancyRate}%</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-white tabular-nums">
              {checkedInCount}{" "}
              <span className="text-sm font-normal text-zinc-500">
                / {attendees.length || seatCapacity}
              </span>
            </span>
            <span className="text-[10px] text-zinc-400 uppercase">Admitted Cadets</span>
          </div>
          <div className="w-full bg-zinc-900 h-1.5 overflow-hidden border border-white/5">
            <div
              className="bg-lime-400 h-full transition-all duration-300"
              style={{ width: `${Math.min(100, occupancyRate)}%` }}
            />
          </div>
          <p className="text-[10px] text-zinc-500">
            {attendees.length - checkedInCount} qualified candidates pending gate clearance.
          </p>
        </div>

        {/* Card 2: Phase 1 Qualification Engine */}
        <div className="admin-card p-4 space-y-3 bg-[#09090d]">
          <div className="flex items-center justify-between text-xs border-b border-white/10 pb-2">
            <span className="text-zinc-400 flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-amber-400" />
              TOP 30 ROSTER
            </span>
            <span className="text-[10px] bg-amber-400/10 text-amber-300 border border-amber-400/30 px-1.5 py-0.5">
              {attendees.length > 0 ? "QUALIFIED" : "STANDBY"}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-white tabular-nums">
              {attendees.length}{" "}
              <span className="text-sm font-normal text-zinc-500">/ 30 Seats</span>
            </span>
            <span className="text-[10px] text-zinc-400 uppercase">Passes Generated</span>
          </div>
          <p className="text-[10px] text-zinc-400 leading-normal">
            Automated ranking cutoff applied across all Phase 1 online screening submissions.
          </p>
          <div className="text-[10px] text-zinc-500">
            Pass Code Standard: <code className="text-zinc-300">CCC-PASS:W1-XX</code>
          </div>
        </div>

        {/* Card 3: CodeBox Judge Engine Telemetry */}
        <div className="admin-card p-4 space-y-3 bg-[#09090d]">
          <div className="flex items-center justify-between text-xs border-b border-white/10 pb-2">
            <span className="text-zinc-400 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              CODEBOX JUDGE
            </span>
            <span className="text-emerald-400 font-bold text-[10px] flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-400 inline-block animate-pulse" />
              OPERATIONAL
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-white tabular-nums">
              0.42 <span className="text-sm font-normal text-zinc-500">ms</span>
            </span>
            <span className="text-[10px] text-zinc-400 uppercase">Avg Exec Latency</span>
          </div>
          <div className="text-[10px] text-zinc-400 space-y-1">
            <div className="flex justify-between">
              <span>Sandbox Isolation:</span>
              <span className="text-zinc-200">cgroup v2 / seccomp</span>
            </div>
            <div className="flex justify-between">
              <span>Languages Supported:</span>
              <span className="text-zinc-200">C++17, Py3, Java, JS</span>
            </div>
          </div>
        </div>

        {/* Card 4: Anti-Cheat & Security */}
        <div className="admin-card p-4 space-y-3 bg-[#09090d]">
          <div className="flex items-center justify-between text-xs border-b border-white/10 pb-2">
            <span className="text-zinc-400 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-lime-400" />
              AIR-GAP SECURITY
            </span>
            <span className="text-emerald-400 font-bold text-[10px]">ENFORCED</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-emerald-400 tabular-nums">
              ZERO <span className="text-sm font-normal text-zinc-500">Breaches</span>
            </span>
            <span className="text-[10px] text-zinc-400 uppercase">Network State</span>
          </div>
          <div className="text-[10px] text-zinc-400 space-y-1">
            <div className="flex justify-between">
              <span>WAN Outbound:</span>
              <span className="text-emerald-400">Blocked (Air-Gapped)</span>
            </div>
            <div className="flex justify-between">
              <span>Proctor Watchdog:</span>
              <span className="text-zinc-200">Continuous 10s Ping</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── 3. TOURNAMENT PROGRESSION PIPELINE & AUDIT LOG ────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Tournament Progression Stepper (6 Cols) */}
        <div className="lg:col-span-6 admin-card p-5 space-y-4 bg-[#09090d]">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-lime-400" />
              Tournament Progression Lifecycle
            </span>
            <span className="text-[10px] text-zinc-400 font-mono">STEP-BY-STEP EXECUTION</span>
          </div>

          <div className="space-y-3">
            {[
              {
                step: 1,
                title: "Phase 1: Online Screening Round",
                desc: "Remote automated proctoring challenge in browser arena.",
                status: selectedContest?.has_assessment ? "COMPLETED" : "NOT ATTACHED",
                isDone: true,
              },
              {
                step: 2,
                title: "Phase 2: Finalist Qualification",
                desc: "Top 30 scoring cadets promoted and issued workstation passes.",
                status: attendees.length > 0 ? "QUALIFIED" : "PENDING",
                isDone: attendees.length > 0,
              },
              {
                step: 3,
                title: "Phase 3: Turnstile Check-In & Seating",
                desc: "Optical camera verification at Lab 04 security gate.",
                status: checkedInCount > 0 ? `${checkedInCount}/30 SEATED` : "WAITING",
                isDone: checkedInCount > 0,
              },
              {
                step: 4,
                title: "Phase 4: Air-Gapped Tournament Final",
                desc: "Live 90-minute on-premise competitive programming final.",
                status: status === "live" ? "IN PROGRESS" : status === "finished" ? "CONCLUDED" : "STANDBY",
                isDone: status === "finished",
              },
              {
                step: 5,
                title: "Phase 5: Scoreboard Freeze & Awards",
                desc: "Audit testcase integrity and publish official champion rankings.",
                status: status === "finished" ? "READY" : "LOCKED",
                isDone: false,
              },
            ].map((item) => (
              <div
                key={item.step}
                className="flex items-start gap-3 p-3 bg-black/60 border border-white/5 hover:border-white/15 transition-colors"
              >
                <div
                  className={`w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0 ${
                    item.isDone
                      ? "bg-lime-400 text-black shadow-[0_0_8px_rgba(204,255,0,0.4)]"
                      : "bg-zinc-800 text-zinc-400 border border-white/10"
                  }`}
                >
                  {item.step}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-zinc-200 truncate">{item.title}</span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 border ${
                        item.isDone
                          ? "bg-lime-400/10 border-lime-400/40 text-lime-400"
                          : "bg-zinc-900 border-white/10 text-zinc-500"
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Real-time Operational Audit Stream (6 Cols) */}
        <div className="lg:col-span-6 admin-card p-5 space-y-4 bg-[#09090d]">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Terminal className="w-4 h-4 text-cyan-400" />
              Proctor Operational Audit Log
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">LIVE DISPATCH TERMINAL</span>
          </div>

          <div className="bg-black border border-white/10 p-3 h-[320px] overflow-y-auto space-y-2 text-xs">
            {auditLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-2 font-mono leading-relaxed">
                <span className="text-[10px] text-zinc-500 tabular-nums shrink-0 pt-0.5">
                  [{log.time}]
                </span>
                <span
                  className={`text-[10px] font-bold uppercase shrink-0 px-1 py-0.2 ${
                    log.type === "success"
                      ? "bg-emerald-950 text-emerald-400 border border-emerald-500/30"
                      : log.type === "warn"
                      ? "bg-amber-950 text-amber-300 border border-amber-500/30"
                      : log.type === "error"
                      ? "bg-rose-950 text-rose-300 border border-rose-500/30"
                      : "bg-zinc-900 text-zinc-400 border border-white/10"
                  }`}
                >
                  {log.actor}
                </span>
                <span
                  className={`text-[11px] ${
                    log.type === "success"
                      ? "text-zinc-200"
                      : log.type === "warn"
                      ? "text-amber-200"
                      : log.type === "error"
                      ? "text-rose-300"
                      : "text-zinc-400"
                  }`}
                >
                  {log.action}
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-1 border-t border-white/5">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Server className="w-3 h-3 text-emerald-400" /> Host: 143.198.38.205
              </span>
              <span className="flex items-center gap-1">
                <Database className="w-3 h-3 text-cyan-400" /> SQLite WAL Synced
              </span>
            </div>
            <button
              onClick={() => appendLog("Manual diagnostic probe executed by proctor.", "PROCTOR", "info")}
              className="text-zinc-400 hover:text-lime-400 underline cursor-pointer"
            >
              Test Diagnostics
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
