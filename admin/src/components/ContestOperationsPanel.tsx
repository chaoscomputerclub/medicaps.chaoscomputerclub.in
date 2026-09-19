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
    <div className="space-y-4 font-mono">
      {/* Control Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. Lifecycle Transitions */}
        <Card className="bg-zinc-950 border border-white/10 rounded-none">
          <CardHeader className="border-b border-white/10 py-2.5 px-4">
            <div className="flex items-center gap-2">
              <Play className="w-3.5 h-3.5 text-lime-400" />
              <CardTitle className="font-mono text-xs uppercase text-white font-bold tracking-wider">
                Contest Status
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between pb-1">
              <span className="text-xs text-zinc-400">Current State:</span>
              {getStatusBadge(selectedContest?.status || "upcoming")}
            </div>

            <Button
              onClick={() => handleTriggerAction("start_live")}
              disabled={isActionPending || selectedContest?.status === "live"}
              className="w-full bg-lime-400 hover:bg-lime-300 text-black font-mono text-xs uppercase font-bold tracking-wider h-10 rounded-none cursor-pointer disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-lime-400"
            >
              <Play className="w-3.5 h-3.5 mr-1.5 fill-current" />
              Start Live Contest
            </Button>

            {!confirmConclude ? (
              <Button
                onClick={() => setConfirmConclude(true)}
                disabled={isActionPending || selectedContest?.status === "finished"}
                variant="outline"
                className="w-full border-white/15 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white font-mono text-xs uppercase font-bold tracking-wider h-9 rounded-none cursor-pointer focus-visible:ring-2 focus-visible:ring-lime-400"
              >
                <Lock className="w-3.5 h-3.5 mr-1.5 text-zinc-400" />
                Conclude & Lock Arena
              </Button>
            ) : (
              <div className="p-2.5 bg-black border border-amber-400/40 rounded-none space-y-2">
                <div className="flex items-center gap-1 text-amber-400 text-xs font-bold">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Lock Arena Submissions?</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleTriggerAction("finish")}
                    disabled={isActionPending}
                    className="flex-1 bg-amber-400 hover:bg-amber-300 text-black font-mono text-xs font-bold uppercase rounded-none h-7"
                  >
                    Confirm
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setConfirmConclude(false)}
                    className="border-white/15 text-zinc-400 hover:text-white font-mono text-xs rounded-none h-7"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 2. Arena Timer Controls */}
        <Card className="bg-zinc-950 border border-white/10 rounded-none">
          <CardHeader className="border-b border-white/10 py-2.5 px-4">
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <CardTitle className="font-mono text-xs uppercase text-white font-bold tracking-wider">
                Arena Clock
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleTriggerAction("reset_timer", 90)}
                disabled={isActionPending}
                className="h-8 border-white/15 bg-zinc-900 font-mono text-xs text-zinc-300 hover:text-white rounded-none"
              >
                Set 90m
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleTriggerAction("reset_timer", 60)}
                disabled={isActionPending}
                className="h-8 border-white/15 bg-zinc-900 font-mono text-xs text-zinc-300 hover:text-white rounded-none"
              >
                Set 60m
              </Button>
            </div>

            <div className="flex gap-2 pt-1">
              <Input
                type="number"
                min="1"
                max="300"
                value={customTimerMinutes}
                onChange={(e) => setCustomTimerMinutes(Number(e.target.value) || 90)}
                className="h-8 bg-black border-white/15 text-xs font-mono text-white rounded-none tabular-nums focus-visible:ring-2 focus-visible:ring-lime-400"
                placeholder="Minutes"
              />
              <Button
                onClick={() => handleTriggerAction("reset_timer", customTimerMinutes)}
                disabled={isActionPending}
                className="h-8 bg-zinc-900 border border-white/15 hover:bg-lime-400 hover:text-black text-white font-mono text-xs uppercase font-bold rounded-none px-3"
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Set
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 3. Top 30 Finalist Qualification */}
        <Card className="bg-zinc-950 border border-white/10 rounded-none">
          <CardHeader className="border-b border-white/10 py-2.5 px-4">
            <div className="flex items-center gap-2">
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <CardTitle className="font-mono text-xs uppercase text-white font-bold tracking-wider">
                Top 30 Finalists
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <p className="text-xs text-zinc-400">
              Evaluate Round 1 scores, generate seat allocations, and issue gate passes.
            </p>

            <Button
              onClick={() => handleTriggerAction("qualify_top30")}
              disabled={isActionPending}
              className="w-full bg-zinc-900 border border-lime-400/40 hover:bg-lime-400 hover:text-black text-lime-400 font-mono text-xs uppercase font-bold tracking-wider h-10 rounded-none cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-lime-400"
            >
              <Zap className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
              Evaluate & Issue Passes
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
