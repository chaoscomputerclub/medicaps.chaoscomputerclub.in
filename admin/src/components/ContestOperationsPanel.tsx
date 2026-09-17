import { useState } from "react";
import { Play, RotateCcw, Clock, Award, ShieldAlert, CheckCircle2, AlertTriangle, Layers, Cpu, Zap, RefreshCw } from "lucide-react";
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

  const slug = selectedContest?.slug || "weekly-contest-1";

  const handleTriggerAction = async (
    action: "start_live" | "finish" | "reset_timer" | "qualify_top30",
    minutes?: number
  ) => {
    setIsActionPending(true);
    try {
      if (action === "qualify_top30") {
        const res = await contestApi.qualifyTop30(slug);
        toast.success(`Top 30 Finalists Evaluated & Passes Issued (${res.qualified_count} cadets qualified).`);
      } else {
        const res = await triggerWebhookContestEvent(slug, action, minutes || customTimerMinutes);
        toast.success(res.message || `Action '${action}' executed successfully.`);
      }
      onContestUpdated();
    } catch (err: any) {
      toast.error(err.message || `Failed to execute action '${action}'.`);
    } finally {
      setIsActionPending(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "live":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/40 text-xs font-mono font-bold animate-pulse">● LIVE CONTEST</Badge>;
      case "finished":
        return <Badge className="bg-zinc-800 text-zinc-400 border-zinc-700 text-xs font-mono">CONCLUDED</Badge>;
      default:
        return <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/40 text-xs font-mono">UPCOMING</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Contest Status Header Card */}
      <Card className="bg-[#0c0c0c] border-white/10 rounded-sm">
        <CardHeader className="border-b border-white/10 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-red-400" />
                <CardTitle className="font-mono text-base tracking-wide uppercase text-white font-bold">
                  {selectedContest?.title || "Weekly Contest 1"}
                </CardTitle>
                {getStatusBadge(selectedContest?.status || "upcoming")}
              </div>
              <CardDescription className="font-mono text-xs text-zinc-400 mt-1">
                Contest Slug: <span className="text-zinc-200 font-bold">{slug}</span> · Type: {selectedContest?.type || "Standard (Two-Phase Final)"}
              </CardDescription>
            </div>
            <div className="font-mono text-xs text-zinc-400 text-right">
              <div>Starts: {selectedContest?.starts_at ? new Date(selectedContest.starts_at).toLocaleString() : "TBD"}</div>
              <div>Ends: {selectedContest?.ends_at ? new Date(selectedContest.ends_at).toLocaleString() : "TBD"}</div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Control Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 1. Lifecycle Transitions */}
        <Card className="bg-[#0c0c0c] border-white/10 rounded-sm">
          <CardHeader className="border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <Play className="w-4 h-4 text-red-400" />
              <CardTitle className="font-mono text-xs uppercase text-white font-bold">
                Contest Lifecycle Override
              </CardTitle>
            </div>
            <CardDescription className="font-mono text-[11px] text-zinc-500">
              Instantly broadcast lifecycle transitions via SSE & Webhooks.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            <Button
              onClick={() => handleTriggerAction("start_live")}
              disabled={isActionPending || selectedContest?.status === "live"}
              className="w-full bg-red-600 hover:bg-red-500 text-white font-mono text-xs uppercase font-bold h-10 rounded-none"
            >
              <Play className="w-3.5 h-3.5 mr-2" />
              Start Live Contest (Round 2)
            </Button>

            <Button
              onClick={() => handleTriggerAction("finish")}
              disabled={isActionPending || selectedContest?.status === "finished"}
              variant="outline"
              className="w-full border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white font-mono text-xs uppercase font-bold h-10 rounded-none"
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-2 text-emerald-400" />
              Conclude Contest & Lock Arena
            </Button>

            <p className="text-[10px] font-mono text-zinc-500 pt-1">
              * Live triggers update all connected student terminals instantaneously with 0ms polling delay.
            </p>
          </CardContent>
        </Card>

        {/* 2. Arena Timer Controls */}
        <Card className="bg-[#0c0c0c] border-white/10 rounded-sm">
          <CardHeader className="border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              <CardTitle className="font-mono text-xs uppercase text-white font-bold">
                Arena Clock Overrides
              </CardTitle>
            </div>
            <CardDescription className="font-mono text-[11px] text-zinc-500">
              Adjust or reset countdown timers for live lab workstations.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleTriggerAction("reset_timer", 90)}
                disabled={isActionPending}
                className="h-9 border-zinc-800 bg-zinc-900 font-mono text-xs text-zinc-300 hover:bg-zinc-800 rounded-none"
              >
                Reset (90 min)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleTriggerAction("reset_timer", 60)}
                disabled={isActionPending}
                className="h-9 border-zinc-800 bg-zinc-900 font-mono text-xs text-zinc-300 hover:bg-zinc-800 rounded-none"
              >
                Reset (60 min)
              </Button>
            </div>

            <div className="pt-1">
              <label className="block text-[11px] font-mono uppercase text-zinc-400 mb-1.5">
                Custom Duration (Minutes):
              </label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="1"
                  max="300"
                  value={customTimerMinutes}
                  onChange={(e) => setCustomTimerMinutes(Number(e.target.value) || 90)}
                  className="h-9 bg-black border-zinc-800 text-xs font-mono text-white rounded-none"
                />
                <Button
                  onClick={() => handleTriggerAction("reset_timer", customTimerMinutes)}
                  disabled={isActionPending}
                  className="h-9 bg-cyan-600 hover:bg-cyan-500 text-black font-mono text-xs uppercase font-bold rounded-none px-3"
                >
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Set Clock
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3. Top 30 Finalist Qualification */}
        <Card className="bg-[#0c0c0c] border-white/10 rounded-sm">
          <CardHeader className="border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-400" />
              <CardTitle className="font-mono text-xs uppercase text-white font-bold">
                Top 30 Finalist Automation
              </CardTitle>
            </div>
            <CardDescription className="font-mono text-[11px] text-zinc-500">
              Audit Round 1 assessment scores and generate lab entry passes.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            <Button
              onClick={() => handleTriggerAction("qualify_top30")}
              disabled={isActionPending}
              className="w-full bg-amber-600 hover:bg-amber-500 text-black font-mono text-xs uppercase font-bold h-10 rounded-none"
            >
              <Zap className="w-3.5 h-3.5 mr-2" />
              Compute & Issue Top 30 Passes
            </Button>
            <p className="text-[10px] font-mono text-zinc-500">
              Automatically ranks all screening participants, generates QR entry pass codes, and assigns air-gapped lab workstations (LAB-04-PC01 to PC30).
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
