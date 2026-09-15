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
      <div className="page-wrap space-y-6">
        <Link to="/portal/contests" className="back-link">
          <ArrowLeft />
          Back to contests
        </Link>
        <p className="text-sm text-[var(--muted)]">Contest not found.</p>
      </div>
    );
  }

  if (!qualified) {
    return (
      <div className="page-wrap space-y-6">
        <Link to={`/portal/contests/${contestSlug}`} className="back-link">
          <ArrowLeft />
          Back to contest
        </Link>
        <Card className="rounded-none border-amber-500/40 bg-[var(--surface-1)]">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Lock className="size-8 text-amber-300" />
            <h1 className="text-xl font-black uppercase tracking-tight text-white">
              Final room restricted to the Top {FINALIST_SEATS}
            </h1>
            <p className="max-w-lg text-sm text-[var(--muted)]">
              {registration?.eligibility_message ??
                "This room opens only for cadets who qualified within the Round 1 cut-off."}
            </p>
            <Button asChild variant="outline" className="rounded-none font-mono text-xs uppercase border-[var(--line)]">
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
    <div className="page-wrap space-y-6">
      <Link to={`/portal/contests/${contestSlug}`} className="back-link">
        <ArrowLeft />
        Back to contest
      </Link>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="rounded-none border-[var(--accent)] font-mono text-[10px] uppercase text-[var(--accent)]">
            Finalist access granted
          </Badge>
          <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
            Round 2 · On-Premise Lab Arena
          </span>
        </div>
        <h1 className="text-2xl font-black uppercase tracking-tight text-white">{contest.title}</h1>
        <p className="max-w-2xl text-sm text-[var(--muted)]">
          The live final is attended directly in the campus computing lab under faculty proctoring. Present your QR pass at the entrance desk, verify check-in at your assigned seat, and enter the live arena to solve problems.
        </p>
      </header>

      {/* Hero Live Arena Launcher Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 border border-[var(--accent)]/40 bg-[var(--surface-1)] rounded-none">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex size-2 rounded-full bg-[var(--accent)] animate-pulse" />
            <h3 className="font-bold text-white text-sm uppercase tracking-wide font-mono">Faculty-Proctored Live Arena Ready</h3>
          </div>
          <p className="text-xs text-[var(--muted)] font-mono">
            Seat: <strong className="text-white">{pass?.seat ?? "Lab-04-WS-07"}</strong> · Proctors: <span className="text-white">Dr. Ratnesh Litoriya, Prof. Amit Shrivastava</span>
          </p>
        </div>
        <Button asChild size="lg" className="rounded-none bg-[var(--accent)] text-black hover:bg-[#b8f025] font-mono text-xs uppercase font-bold tracking-wider shadow-none">
          <Link to={`/portal/contests/${contestSlug}/arena`}>
            <Play className="size-4 fill-current mr-2" />
            Enter Contest Arena
          </Link>
        </Button>
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        {/* Countdown Card */}
        <Card className="rounded-none border-[var(--line)] bg-[var(--surface-1)]">
          <CardHeader>
            <CardTitle className="font-mono text-xs uppercase tracking-widest text-[var(--muted)]">
              {started ? "Contest ends in" : "Start bell in"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Countdown target={started ? contest.ends_at : contest.starts_at} label={started ? "Remaining" : "Countdown"} />
          </CardContent>
        </Card>

        {/* Check-In & QR Code Card */}
        <Card className="rounded-none border-[var(--line)] bg-[var(--surface-1)]">
          <CardHeader className="flex-row items-center gap-2">
            <QrCode className="size-4 text-[var(--accent)]" />
            <CardTitle className="text-sm font-bold uppercase tracking-wide text-white">
              Attendance Pass
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 font-mono text-xs text-[var(--muted)]">
            <div className="flex justify-center bg-white p-2.5 rounded-none">
              <QRCodeSVG value={pass?.pass_code || `CCC-${contestSlug.toUpperCase()}-WS07`} size={110} level="M" />
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span>Pass code:</span>
              <span className="text-white font-bold">{pass?.pass_code || "CCC-PASS-TOP30"}</span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span>Assigned Seat:</span>
              <span className="text-white font-bold">{pass?.seat ?? "Lab-04-WS-07"}</span>
            </div>
            <Button
              className="w-full rounded-none font-mono text-xs font-bold uppercase"
              disabled={checkedIn || isCheckingIn}
              onClick={handleCheckIn}
            >
              {checkedIn ? "✓ Attendance verified" : isCheckingIn ? "Checking in…" : "Confirm check-in"}
            </Button>
          </CardContent>
        </Card>

        {/* Workstation Lab Info Card */}
        <Card className="rounded-none border-[var(--line)] bg-[var(--surface-1)]">
          <CardHeader className="flex-row items-center gap-2">
            <Cpu className="size-4 text-[var(--accent)]" />
            <CardTitle className="text-sm font-bold uppercase tracking-wide text-white">
              Workstation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 font-mono text-xs text-[var(--muted)]">
            <p className="text-white">{contest.environment || "Ubuntu 24.04 LTS · GCC 14.2 / Python 3.12 / Node 20"}</p>
            <p>{contest.venue}</p>
            <p className="flex items-center gap-2">
              <Users className="size-3.5" />
              {contest.registered_count} finalists seated
            </p>
            <div className="pt-2 border-t border-[var(--line)]">
              <p className="text-[11px] text-[var(--muted)]">Proctored by:</p>
              <p className="text-white text-xs font-medium">Dr. Ratnesh Litoriya, Prof. Amit Shrivastava</p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Problem Set Table */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-xs uppercase tracking-widest text-[var(--muted)]">
            Final problem set
          </h2>
          <Button asChild variant="outline" size="sm" className="rounded-none border-[var(--line)] font-mono text-xs hover:bg-[var(--surface-2)] text-white">
            <Link to={`/portal/contests/${contestSlug}/arena`}>
              <Play className="size-3.5 mr-1 text-[var(--accent)]" /> Open in Arena
            </Link>
          </Button>
        </div>
        <div className="border border-[var(--line)] bg-[var(--surface-1)]">
          <Table>
            <TableHeader>
              <TableRow className="border-[var(--line)]">
                <TableHead className="w-16 font-mono text-[10px] uppercase tracking-widest">#</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-widest">Problem</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-widest">Topic</TableHead>
                <TableHead className="text-right font-mono text-[10px] uppercase tracking-widest">Points</TableHead>
                <TableHead className="text-right font-mono text-[10px] uppercase tracking-widest">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {problems.length === 0 ? (
                <TableRow className="border-[var(--line)]">
                  <TableCell colSpan={5} className="py-12 text-center text-xs text-[var(--muted)]">
                    <Timer className="mx-auto mb-2 size-4" />
                    The problem set unseals at the start bell.
                  </TableCell>
                </TableRow>
              ) : (
                problems.map((problem) => (
                  <TableRow key={problem.problem_index} className="border-[var(--line)]">
                    <TableCell className="font-mono text-xs text-[var(--accent)]">{problem.problem_index}</TableCell>
                    <TableCell className="font-semibold text-white">{problem.title}</TableCell>
                    <TableCell className="font-mono text-xs text-[var(--muted)]">{problem.topic}</TableCell>
                    <TableCell className="text-right font-mono text-xs text-white">{problem.points}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="ghost" className="text-[var(--accent)] hover:text-white font-mono text-xs rounded-none">
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

      <Card className="rounded-none border-[var(--line)] bg-[var(--surface-1)]">
        <CardHeader className="flex-row items-center gap-2">
          <ShieldCheck className="size-4 text-[var(--accent)]" />
          <CardTitle className="text-sm font-bold uppercase tracking-wide text-white">
            Lab Faculty Proctoring & Verification
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 font-mono text-xs text-[var(--muted)]">
          <div className="grid gap-2 sm:grid-cols-2">
            {(contest.chief_proctors.length ? contest.chief_proctors : ["Dr. Ratnesh Litoriya", "Prof. Amit Shrivastava", "CCC Operations Desk"]).map((name) => (
              <span key={name} className="flex items-center gap-2 text-white">
                <CheckCircle2 className="size-3.5 text-[var(--accent)]" />
                {name}
              </span>
            ))}
          </div>
          <p className="text-[11px] text-[var(--muted)] pt-2 border-t border-[var(--line)]">
            Rule note: Submissions are judged in real-time. Scoreboard is frozen in the final 15 minutes of competition.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
