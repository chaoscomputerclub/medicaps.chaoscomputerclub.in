import { Link, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Cpu,
  Lock,
  Play,
  QrCode,
  ShieldCheck,
  Timer,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/organization/components/ui";
import { Countdown } from "@/features/contest/components";
import { FINALIST_SEATS } from "@/features/contest/lifecycle";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchContestDetailThunk,
  fetchCampusPassThunk,
  checkInContestThunk,
} from "@/store/slices/contestSlice";
import { ContestOfflineSkeleton } from "@/organization/components/skeletons";

export function ContestOfflinePage() {
  const { contestSlug = "" } = useParams<{ contestSlug: string }>();
  const dispatch = useAppDispatch();

  const { currentContest: contest, registration, pass, problems, isLoadingDetail } = useAppSelector(
    (state) => state.contest
  );
  const [isCheckingIn, setIsCheckingIn] = useState(false);

  useEffect(() => {
    if (contestSlug) {
      dispatch(fetchContestDetailThunk(contestSlug));
      dispatch(fetchCampusPassThunk());
    }
  }, [contestSlug, dispatch]);

  const qualified = Boolean(registration?.is_top_30_qualified || registration?.can_enter_live_contest);
  const checkedIn = pass?.status === "checked_in";
  const started = contest ? Date.now() >= new Date(contest.starts_at).getTime() : false;

  const handleCheckIn = async () => {
    setIsCheckingIn(true);
    const res = await dispatch(checkInContestThunk(contestSlug));
    setIsCheckingIn(false);
    if (checkInContestThunk.fulfilled.match(res)) {
      toast.success(res.payload.message || "Checked in. Take your assigned workstation.");
    } else {
      toast.error(String(res.payload || "Failed to check in"));
    }
  };

  if (isLoadingDetail && !contest) {
    return <ContestOfflineSkeleton />;
  }

  if (!contest) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        <Link to="/portal/contests" className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-zinc-400 transition-colors hover:text-white">
          <ArrowLeft className="size-4" />
          Back to contests
        </Link>
        <p className="text-sm text-zinc-400">Contest not found.</p>
      </div>
    );
  }

  if (!qualified) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        <Link to={`/portal/contests/${contestSlug}`} className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-zinc-400 transition-colors hover:text-white">
          <ArrowLeft className="size-4" />
          Back to contest
        </Link>
        <Card className="rounded-none border border-amber-500/30 bg-zinc-900/60 backdrop-blur-md shadow-xl">
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-none border border-amber-500/30 bg-amber-950/30 text-amber-400">
              <Lock className="size-7" />
            </div>
            <h1 className="text-xl font-black uppercase tracking-tight text-white">
              Final room restricted to the Top {FINALIST_SEATS}
            </h1>
            <p className="max-w-lg text-sm text-zinc-400">
              {registration?.eligibility_message ??
                "This room opens only for cadets who qualified within the Round 1 cut-off."}
            </p>
            <Button asChild variant="outline" className="rounded-none font-mono text-xs uppercase border-white/10 bg-zinc-900/60 text-zinc-300 hover:border-white/20 hover:text-white active:scale-[0.98]">
              <Link to={`/portal/contests/${contestSlug}/results`}>
                View Round 1 ranking
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
      <Link to={`/portal/contests/${contestSlug}`} className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-zinc-400 transition-colors hover:text-white">
        <ArrowLeft className="size-4" />
        Back to contest
      </Link>

      <PageHeader
        kicker="02 // Air-Gapped Lab Final"
        index="INDEX 2.0 · ON-PREMISE"
        badge={
          <Badge variant="outline" className="rounded-none border border-lime-400/40 bg-lime-400/10 font-mono text-[10px] uppercase font-bold tracking-wider text-lime-400">
            Finalist Access Granted
          </Badge>
        }
        title={contest.title}
        description="The live final is attended directly in the campus computing lab under air-gapped lab proctoring. Present your QR pass at the entrance desk, verify check-in at your assigned seat, and enter the live arena to solve problems."
      />

      {/* Hero Live Arena Launcher Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 border border-lime-400/30 bg-zinc-900/70 rounded-none backdrop-blur-md shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex size-2 rounded-full bg-lime-400 animate-pulse" />
            <h3 className="font-bold text-white text-sm uppercase tracking-wider font-mono">Air-Gapped Live Arena Ready</h3>
          </div>
          <p className="text-xs text-zinc-400 font-mono">
            Seat: <strong className="text-lime-400">{pass?.seat ?? "Lab-04-WS-07"}</strong> · Proctors: <span className="text-zinc-300">{contest.chief_proctors?.length ? contest.chief_proctors.join(", ") : "Chief Proctor, CCC Operations Desk"}</span>
          </p>
        </div>
        <Button asChild size="lg" className="rounded-none bg-lime-400 text-black hover:bg-lime-400 font-mono text-xs uppercase font-bold tracking-wider shadow-lg shadow-lime-400/20 active:scale-[0.98]">
          <Link to={`/portal/contests/${contestSlug}/arena`}>
            <Play className="size-4 fill-current mr-2" />
            Enter Contest Arena
          </Link>
        </Button>
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        {/* Countdown Card */}
        <Card className="rounded-none border border-white/10 bg-zinc-900/60 backdrop-blur-md shadow-lg">
          <CardHeader>
            <CardTitle className="font-mono text-xs uppercase tracking-widest text-zinc-400">
              {started ? "Contest ends in" : "Start bell in"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Countdown target={started ? contest.ends_at : contest.starts_at} label={started ? "Remaining" : "Countdown"} />
          </CardContent>
        </Card>

        {/* Check-In & QR Code Card */}
        <Card className="rounded-none border border-white/10 bg-zinc-900/60 backdrop-blur-md shadow-lg">
          <CardHeader className="flex-row items-center gap-2">
            <QrCode className="size-4 text-lime-400" />
            <CardTitle className="text-sm font-bold uppercase tracking-wide text-white">
              Attendance Pass
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 font-mono text-xs text-zinc-400">
            <div className="flex justify-center bg-white p-3 rounded-none shadow-inner">
              <QRCodeSVG value={pass?.pass_code || `CCC-${contestSlug.toUpperCase()}-WS07`} size={110} level="M" />
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span>Pass code:</span>
              <span className="text-lime-400 font-bold font-mono">{pass?.pass_code || "CCC-PASS-TOP30"}</span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span>Assigned Seat:</span>
              <span className="text-white font-bold font-mono">{pass?.seat ?? "Lab-04-WS-07"}</span>
            </div>
            <Button
              className="w-full rounded-none bg-lime-400 font-mono text-xs font-bold uppercase text-black hover:bg-lime-400 active:scale-[0.98] disabled:opacity-50"
              disabled={checkedIn || isCheckingIn}
              onClick={handleCheckIn}
            >
              {checkedIn ? "✓ Attendance verified" : isCheckingIn ? "Checking in…" : "Confirm check-in"}
            </Button>
          </CardContent>
        </Card>

        {/* Workstation Lab Info Card */}
        <Card className="rounded-none border border-white/10 bg-zinc-900/60 backdrop-blur-md shadow-lg">
          <CardHeader className="flex-row items-center gap-2">
            <Cpu className="size-4 text-lime-400" />
            <CardTitle className="text-sm font-bold uppercase tracking-wide text-white">
              Workstation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 font-mono text-xs text-zinc-400">
            <p className="text-white">{contest.environment || "Ubuntu 24.04 LTS · GCC 14.2 / Python 3.12 / Node 20"}</p>
            <p>{contest.venue}</p>
            <p className="flex items-center gap-2">
              <Users className="size-3.5 text-zinc-500" />
              <span className="font-mono tabular-nums text-white">{contest.registered_count}</span> finalists seated
            </p>
            <div className="pt-2 border-t border-white/10">
              <p className="text-[11px] text-zinc-500">Proctored by:</p>
              <p className="text-white text-xs font-medium">{contest.chief_proctors?.length ? contest.chief_proctors.join(", ") : "Chief Proctor, CCC Operations Desk"}</p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Problem Set Table */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-xs uppercase tracking-widest text-zinc-400">
            Final problem set
          </h2>
          <Button asChild variant="outline" size="sm" className="rounded-none border-white/10 bg-zinc-900/60 font-mono text-xs hover:border-white/20 hover:text-white text-zinc-300 active:scale-[0.98]">
            <Link to={`/portal/contests/${contestSlug}/arena`}>
              <Play className="size-3.5 mr-1.5 text-lime-400" /> Open in Arena
            </Link>
          </Button>
        </div>
        <div className="overflow-hidden rounded-none border border-white/10 bg-zinc-900/50 backdrop-blur-md shadow-xl">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-white/10 bg-zinc-950/40 hover:bg-transparent">
                <TableHead className="w-16 font-mono text-[10px] uppercase tracking-widest text-zinc-400">#</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-widest text-zinc-400">Problem</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-widest text-zinc-400">Topic</TableHead>
                <TableHead className="text-right font-mono text-[10px] uppercase tracking-widest text-zinc-400">Points</TableHead>
                <TableHead className="text-right font-mono text-[10px] uppercase tracking-widest text-zinc-400">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {problems.length === 0 ? (
                <TableRow className="border-b border-white/5">
                  <TableCell colSpan={5} className="py-12 text-center text-xs text-zinc-500 font-mono">
                    <Timer className="mx-auto mb-2 size-5 text-zinc-600" />
                    The problem set unseals at the start bell.
                  </TableCell>
                </TableRow>
              ) : (
                problems.map((problem) => (
                  <TableRow key={problem.problem_index} className="border-b border-white/5 transition-colors hover:bg-white/[0.02]">
                    <TableCell className="font-mono text-xs font-bold text-lime-400">{problem.problem_index}</TableCell>
                    <TableCell className="font-semibold text-white">{problem.title}</TableCell>
                    <TableCell className="font-mono text-xs text-zinc-400">{problem.topic}</TableCell>
                    <TableCell className="text-right font-mono text-xs font-bold tabular-nums text-white">{problem.points}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="ghost" className="text-lime-400 hover:text-lime-300 hover:bg-lime-400/10 font-mono text-xs rounded-none active:scale-[0.98]">
                        <Link to={`/portal/contests/${contestSlug}/arena?problem=${problem.problem_index}`}>
                          Attempt <ArrowRight className="size-3 ml-1" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <Card className="rounded-none border border-white/10 bg-zinc-900/60 backdrop-blur-md shadow-lg">
        <CardHeader className="flex-row items-center gap-2">
          <ShieldCheck className="size-4 text-lime-400" />
          <CardTitle className="text-sm font-bold uppercase tracking-wide text-white">
            Lab Proctoring & Cryptographic Verification
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 font-mono text-xs text-zinc-400">
          <div className="grid gap-2 sm:grid-cols-2">
            {(contest.chief_proctors.length ? contest.chief_proctors : ["Chief Proctor", "CCC Operations Desk"]).map((name) => (
              <span key={name} className="flex items-center gap-2 text-white">
                <CheckCircle2 className="size-3.5 text-lime-400" />
                {name}
              </span>
            ))}
          </div>
          <p className="text-[11px] text-zinc-500 pt-2 border-t border-white/10">
            Rule note: Submissions are judged in real-time. Scoreboard is frozen in the final 15 minutes of competition.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
