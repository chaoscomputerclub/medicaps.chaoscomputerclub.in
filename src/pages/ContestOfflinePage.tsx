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
      toast.success(res.payload.message || "Attendance verified. Welcome to your workstation.");
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
        <Link to="/contests" className="inline-flex items-center gap-1.5 font-mono text-xs text-zinc-500 hover:text-white transition-colors">
          <ArrowLeft className="size-3.5" /> Back to contests
        </Link>
        <p className="text-xs font-mono text-zinc-500">Contest not found.</p>
      </div>
    );
  }

  if (!qualified) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        <Link to={`/contests/${contestSlug}`} className="inline-flex items-center gap-1.5 font-mono text-xs text-zinc-500 hover:text-white transition-colors">
          <ArrowLeft className="size-3.5" /> Back to contest
        </Link>
        <Card className="rounded-lg border border-white/8 bg-black">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center font-mono">
            <div className="flex size-12 items-center justify-center rounded-md border border-white/10 bg-zinc-950 text-zinc-400">
              <Lock className="size-6" />
            </div>
            <h1 className="text-base font-semibold text-white">
              Finalist Area Restricted
            </h1>
            <p className="max-w-md text-xs text-zinc-400 leading-relaxed">
              {registration?.eligibility_message ??
                `This workstation portal is accessible only to Top ${FINALIST_SEATS} verified qualifiers.`}
            </p>
            <Button asChild variant="outline" className="rounded-md border-white/10 bg-black font-mono text-xs text-zinc-300 hover:text-white mt-2">
              <Link to={`/contests/${contestSlug}/results`}>
                View Round 1 Standings
                <ArrowRight className="ml-1.5 size-3" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <Link to={`/contests/${contestSlug}`} className="inline-flex items-center gap-1.5 font-mono text-xs text-zinc-500 hover:text-white transition-colors">
        <ArrowLeft className="size-3.5" /> Back to contest
      </Link>

      <PageHeader
        kicker="02 // Campus Lab Final"
        index="ROUND 2 · ON-PREMISE"
        badge={
          <span className="rounded border border-lime-400/30 bg-lime-400/10 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-lime-400">
            Finalist Access Granted
          </span>
        }
        title={contest.title}
        description="Air-gapped proctored workstation environment at Medi-Caps Computing Complex."
      />

      {/* Hero Live Arena Launcher */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 border border-lime-400/30 bg-black rounded-lg">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-lime-400 animate-pulse" />
            <h3 className="font-semibold text-white text-sm">Air-Gapped Final Arena</h3>
          </div>
          <p className="text-xs text-zinc-400 font-mono">
            Seat: <strong className="text-lime-400">{pass?.seat ?? "Lab-04-WS-07"}</strong> · Proctors: <span className="text-zinc-300">{contest.chief_proctors?.length ? contest.chief_proctors.join(", ") : "CCC Operations Desk"}</span>
          </p>
        </div>
        <Button asChild size="lg" className="rounded-md bg-transparent text-white border border-white/20 hover:bg-lime-400 hover:text-black hover:border-lime-400 font-mono text-xs font-semibold transition-colors [&_svg]:transition-colors">
          <Link to={`/contests/${contestSlug}/arena`}>
            <Play className="size-3.5 fill-current mr-1.5" />
            Enter Arena
          </Link>
        </Button>
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        {/* Countdown Card */}
        <Card className="rounded-lg border border-white/8 bg-black">
          <CardHeader className="p-5 pb-3">
            <CardTitle className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
              {started ? "Contest Remaining" : "Tournament Bell"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <Countdown target={started ? contest.ends_at : contest.starts_at} label={started ? "Remaining" : "Countdown"} />
          </CardContent>
        </Card>

        {/* Check-In Card */}
        <Card className="rounded-lg border border-white/8 bg-black">
          <CardHeader className="flex-row items-center gap-2 p-5 pb-3">
            <QrCode className="size-4 text-lime-400" />
            <CardTitle className="text-sm font-semibold text-white">
              Gate Pass
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 font-mono text-xs text-zinc-400 p-5 pt-0">
            <div className="flex justify-center bg-white p-3 rounded-md">
              <QRCodeSVG value={pass?.pass_code || `CCC-${contestSlug.toUpperCase()}-WS07`} size={95} level="M" />
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-500">Code:</span>
              <span className="text-lime-400 font-semibold">{pass?.pass_code || "CCC-PASS-TOP30"}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-500">Workstation:</span>
              <span className="text-white font-semibold">{pass?.seat ?? "Lab-04-WS-07"}</span>
            </div>
            <Button
              className="w-full rounded-md bg-transparent text-white border border-white/20 font-mono text-xs font-semibold hover:bg-lime-400 hover:text-black hover:border-lime-400 disabled:opacity-40 transition-colors [&_svg]:transition-colors"
              disabled={checkedIn || isCheckingIn}
              onClick={handleCheckIn}
            >
              {checkedIn ? "✓ Attendance Verified" : isCheckingIn ? "Checking In…" : "Confirm Check-in"}
            </Button>
          </CardContent>
        </Card>

        {/* Workstation Lab Info Card */}
        <Card className="rounded-lg border border-white/8 bg-black">
          <CardHeader className="flex-row items-center gap-2 p-5 pb-3">
            <Cpu className="size-4 text-lime-400" />
            <CardTitle className="text-sm font-semibold text-white">
              Workstation Spec
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 font-mono text-xs text-zinc-400 p-5 pt-0">
            <p className="text-white">{contest.environment || "Ubuntu 24.04 LTS · GCC 14.2 / Python 3.12 / Node 20"}</p>
            <p className="text-zinc-500">{contest.venue}</p>
            <p className="flex items-center gap-2 pt-1">
              <Users className="size-3.5 text-zinc-500" />
              <span><span className="font-semibold text-white tabular-nums">{contest.registered_count}</span> finalists seated</span>
            </p>
            <div className="pt-2 border-t border-white/6">
              <p className="text-[10px] text-zinc-500">Proctors:</p>
              <p className="text-zinc-300 text-xs">{contest.chief_proctors?.length ? contest.chief_proctors.join(", ") : "CCC Operations Desk"}</p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Problem Set Table */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-xs uppercase tracking-wider text-zinc-400">
            Final Problem Set
          </h2>
          <Button asChild variant="outline" size="sm" className="rounded-md border-white/10 bg-black font-mono text-xs text-zinc-300 hover:text-white">
            <Link to={`/contests/${contestSlug}/arena`}>
              <Play className="size-3 mr-1 text-lime-400" /> Open in Arena
            </Link>
          </Button>
        </div>
        <div className="overflow-hidden rounded-lg border border-white/8 bg-black">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-white/8 hover:bg-transparent">
                <TableHead className="w-16 font-mono text-[10px] uppercase text-zinc-500">#</TableHead>
                <TableHead className="font-mono text-[10px] uppercase text-zinc-500">Problem</TableHead>
                <TableHead className="font-mono text-[10px] uppercase text-zinc-500">Topic</TableHead>
                <TableHead className="text-right font-mono text-[10px] uppercase text-zinc-500">Points</TableHead>
                <TableHead className="text-right font-mono text-[10px] uppercase text-zinc-500">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {problems.length === 0 ? (
                <TableRow className="border-b border-white/6">
                  <TableCell colSpan={5} className="py-12 text-center text-xs text-zinc-600 font-mono">
                    <Timer className="mx-auto mb-2 size-5 text-zinc-600" />
                    Problem set unseals at the start bell.
                  </TableCell>
                </TableRow>
              ) : (
                problems.map((problem) => (
                  <TableRow key={problem.problem_index} className="border-b border-white/6 hover:bg-zinc-950 transition-colors">
                    <TableCell className="font-mono text-xs font-semibold text-lime-400">{problem.problem_index}</TableCell>
                    <TableCell className="font-medium text-xs text-white">{problem.title}</TableCell>
                    <TableCell className="font-mono text-xs text-zinc-400">{problem.topic}</TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums text-lime-400">{problem.points}</TableCell>
                    <TableCell className="text-right">
                      <Link
                        to={`/contests/${contestSlug}/arena?problem=${problem.problem_index}`}
                        className="font-mono text-xs text-lime-400 hover:underline"
                      >
                        Solve →
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
