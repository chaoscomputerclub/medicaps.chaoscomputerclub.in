import { useState } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { triggerWebhookContestEvent } from "@/lib/realtime";
import { contestApi } from "@/features/contest/api";

interface ContestOperationsPanelProps {
  contests: any[];
  selectedContest: any;
  onContestUpdated: () => void;
}

export function ContestOperationsPanel({
  contests,
  selectedContest,
  onContestUpdated,
}: ContestOperationsPanelProps) {
  const [isActionPending, setIsActionPending] = useState(false);
  const [customTimerMinutes, setCustomTimerMinutes] = useState(90);
  const [confirmConclude, setConfirmConclude] = useState(false);

  const slug = selectedContest?.slug || "weekly-contest-1";

  const handleTriggerAction = async (
    action: "start_live" | "finish" | "reset_timer" | "qualify_top30",
    minutes?: number
  ) => {
    setIsActionPending(true);
    try {
      if (action === "qualify_top30") {
        const res = await contestApi.qualifyTop30(slug);
        toast.success(
          `Top 30 Finalists Evaluated & Passes Issued (${res.qualified_count} cadets qualified).`
        );
      } else {
        const res = await triggerWebhookContestEvent(slug, action, minutes || customTimerMinutes);
        toast.success(res.message || `Action '${action}' executed successfully.`);
      }
      onContestUpdated();
    } catch (err: any) {
      toast.error(err.message || `Failed to execute action '${action}'.`);
    } finally {
      setIsActionPending(false);
      setConfirmConclude(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "live":
        return (
          <Badge className="bg-lime-400/10 text-lime-400 border-lime-400/40 text-xs font-mono font-extrabold uppercase rounded-none tracking-widest px-2.5 py-1">
            <span className="w-2 h-2 rounded-none bg-lime-400 animate-ping inline-block mr-1.5" />
            LIVE ARENA
          </Badge>
        );
      case "finished":
        return (
          <Badge className="bg-zinc-900 text-zinc-400 border-white/10 text-xs font-mono font-bold uppercase rounded-none tracking-widest px-2.5 py-1">
            CONCLUDED & LOCKED
          </Badge>
        );
      default:
        return (
          <Badge className="bg-cyan-400/10 text-cyan-400 border-cyan-400/40 text-xs font-mono font-bold uppercase rounded-none tracking-widest px-2.5 py-1">
            UPCOMING / SCHEDULED
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6 font-mono">
      {/* Contest Status Header Card */}
      <Card className="bg-zinc-950 border border-white/10 rounded-none shadow-2xl">
        <CardHeader className="border-b border-white/10 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-none bg-lime-400/10 border border-lime-400/30 flex items-center justify-center text-lime-400">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <CardTitle className="font-mono text-base tracking-wide uppercase text-white font-extrabold">
                    {selectedContest?.title || "Weekly Contest 1"}
                  </CardTitle>
                  <CardDescription className="font-mono text-xs text-zinc-400 mt-0.5">
                    Contest Identifier:{" "}
                    <span className="text-lime-400 font-bold">{slug}</span> · Format:{" "}
                    <span className="text-zinc-300">
                      {selectedContest?.type || "Standard (Two-Phase Physical Final)"}
                    </span>
                  </CardDescription>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {getStatusBadge(selectedContest?.status || "upcoming")}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-3 bg-black border border-white/10 rounded-none space-y-1">
            <span className="text-[10px] text-zinc-400 uppercase tracking-widest block">
              Schedule Window
            </span>
            <div className="text-white font-bold flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-lime-400" />
              <span>
                {selectedContest?.starts_at
                  ? new Date(selectedContest.starts_at).toLocaleString()
                  : "TBD"}
              </span>
            </div>
          </div>

          <div className="p-3 bg-black border border-white/10 rounded-none space-y-1">
            <span className="text-[10px] text-zinc-400 uppercase tracking-widest block">
              Hardware Location
            </span>
            <div className="text-white font-bold">
              Medi-Caps Lab 04 · Air-Gapped Workstations
            </div>
          </div>

          <div className="p-3 bg-black border border-white/10 rounded-none space-y-1">
            <span className="text-[10px] text-zinc-400 uppercase tracking-widest block">
              Broadcast Sync State
            </span>
            <div className="text-lime-400 font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-none bg-lime-400" />
              <span>SSE Real-Time Bus Online</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Control Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 1. Lifecycle Transitions */}
        <Card className="bg-zinc-950 border border-white/10 rounded-none shadow-xl flex flex-col justify-between">
          <CardHeader className="border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-none bg-lime-400/10 border border-lime-400/30 flex items-center justify-center text-lime-400">
                <Play className="w-3.5 h-3.5" />
              </div>
              <CardTitle className="font-mono text-xs uppercase text-white font-bold tracking-wider">
                Lifecycle State Machine
              </CardTitle>
            </div>
            <CardDescription className="font-mono text-[11px] text-zinc-400">
              Instantly command contest state transitions across all student terminals.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-3 flex-1 flex flex-col justify-between">
            <div className="space-y-3">
              <Button
                onClick={() => handleTriggerAction("start_live")}
                disabled={isActionPending || selectedContest?.status === "live"}
                className="w-full bg-lime-400 hover:bg-lime-300 text-black font-mono text-xs uppercase font-extrabold tracking-wider h-11 rounded-none shadow-lg shadow-lime-400/20 cursor-pointer disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-lime-400"
              >
                <Play className="w-3.5 h-3.5 mr-2 fill-current" />
                Launch Live Contest (Round 2)
              </Button>

              {!confirmConclude ? (
                <Button
                  onClick={() => setConfirmConclude(true)}
                  disabled={isActionPending || selectedContest?.status === "finished"}
                  variant="outline"
                  className="w-full border-white/15 bg-zinc-900/80 text-zinc-300 hover:bg-zinc-800 hover:text-white font-mono text-xs uppercase font-bold tracking-wider h-10 rounded-none cursor-pointer focus-visible:ring-2 focus-visible:ring-lime-400"
                >
                  <Lock className="w-3.5 h-3.5 mr-2 text-zinc-400" />
                  Conclude & Lock Arena
                </Button>
              ) : (
                <div className="p-3 bg-black border border-amber-400/40 rounded-none space-y-2">
                  <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold uppercase">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Confirm Lockout?</span>
                  </div>
                  <p className="text-[10px] text-zinc-400 leading-tight">
                    This will finalize scoring and prohibit further code submissions.
                  </p>
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={() => handleTriggerAction("finish")}
                      disabled={isActionPending}
                      className="flex-1 bg-amber-400 hover:bg-amber-300 text-black font-mono text-xs font-extrabold uppercase rounded-none h-8 cursor-pointer"
                    >
                      Yes, Conclude
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setConfirmConclude(false)}
                      className="border-white/15 text-zinc-400 hover:text-white font-mono text-xs rounded-none h-8 cursor-pointer"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <p className="text-[10px] font-mono text-zinc-400 pt-2 border-t border-white/5">
              * Broadcasts instant state events via Server-Sent Events to all admitted contestants.
            </p>
          </CardContent>
        </Card>

        {/* 2. Arena Timer Controls */}
        <Card className="bg-zinc-950 border border-white/10 rounded-none shadow-xl flex flex-col justify-between">
          <CardHeader className="border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-none bg-cyan-400/10 border border-cyan-400/30 flex items-center justify-center text-cyan-400">
                <Clock className="w-3.5 h-3.5" />
              </div>
              <CardTitle className="font-mono text-xs uppercase text-white font-bold tracking-wider">
                Arena Clock Overrides
              </CardTitle>
            </div>
            <CardDescription className="font-mono text-[11px] text-zinc-400">
              Synchronize countdown clocks on lab monitors and candidate screens.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-3 flex-1 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleTriggerAction("reset_timer", 90)}
                  disabled={isActionPending}
                  className="h-9 border-white/15 bg-zinc-900/80 font-mono text-xs text-zinc-300 hover:text-black hover:bg-lime-400 hover:border-lime-400 font-bold uppercase rounded-none cursor-pointer transition-colors"
                >
                  Reset 90m
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleTriggerAction("reset_timer", 60)}
                  disabled={isActionPending}
                  className="h-9 border-white/15 bg-zinc-900/80 font-mono text-xs text-zinc-300 hover:text-black hover:bg-lime-400 hover:border-lime-400 font-bold uppercase rounded-none cursor-pointer transition-colors"
                >
                  Reset 60m
                </Button>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase font-bold tracking-wider text-zinc-400 mb-1.5">
                  Custom Time Limit (Minutes):
                </label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min="1"
                    max="300"
                    value={customTimerMinutes}
                    onChange={(e) => setCustomTimerMinutes(Number(e.target.value) || 90)}
                    className="h-9 bg-black border-white/15 text-base sm:text-xs font-mono text-white rounded-none tabular-nums focus-visible:ring-2 focus-visible:ring-lime-400"
                  />
                  <Button
                    onClick={() => handleTriggerAction("reset_timer", customTimerMinutes)}
                    disabled={isActionPending}
                    className="h-9 bg-zinc-900 border border-white/15 hover:bg-lime-400 hover:text-black text-white font-mono text-xs uppercase font-extrabold rounded-none px-3 cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-lime-400"
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1" />
                    Set Clock
                  </Button>
                </div>
              </div>
            </div>

            <p className="text-[10px] font-mono text-zinc-400 pt-2 border-t border-white/5">
              * Changes apply to live contest timers with zero participant page reloads required.
            </p>
          </CardContent>
        </Card>

        {/* 3. Top 30 Finalist Qualification */}
        <Card className="bg-zinc-950 border border-white/10 rounded-none shadow-xl flex flex-col justify-between">
          <CardHeader className="border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-none bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400">
                <Award className="w-3.5 h-3.5" />
              </div>
              <CardTitle className="font-mono text-xs uppercase text-white font-bold tracking-wider">
                Top 30 Finalist Automation
              </CardTitle>
            </div>
            <CardDescription className="font-mono text-[11px] text-zinc-400">
              Audit Round 1 assessment scores and generate lab admission passes.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-3 flex-1 flex flex-col justify-between">
            <div className="space-y-3">
              <Button
                onClick={() => handleTriggerAction("qualify_top30")}
                disabled={isActionPending}
                className="w-full bg-zinc-900 border border-lime-400/40 hover:bg-lime-400 hover:text-black text-lime-400 font-mono text-xs uppercase font-extrabold tracking-wider h-11 rounded-none shadow-lg cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-lime-400"
              >
                <Zap className="w-3.5 h-3.5 mr-2 text-amber-400" />
                Compute & Issue Top 30 Passes
              </Button>

              <div className="p-2.5 bg-black border border-white/10 rounded-none text-[11px] text-zinc-400 space-y-1">
                <div className="text-white font-bold uppercase text-[10px]">
                  Automation Routine:
                </div>
                <div>1. Ranks all Round 1 online submissions</div>
                <div>2. Issues HMAC cryptographic passcodes</div>
                <div>3. Allocates physical seats <code className="text-lime-400">WS-01</code> to <code className="text-lime-400">WS-30</code></div>
              </div>
            </div>

            <p className="text-[10px] font-mono text-zinc-400 pt-2 border-t border-white/5">
              * Cadets immediately receive printable admission passes in their student portal.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
