import { Link, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { globalSwrStore } from "@/lib/cache/swrCache";
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
import { slugifyProblem } from "@/lib/utils";
import { ContestOfflineSkeleton } from "@/organization/components/skeletons";
import { useRealtimeEvents } from "@/lib/realtime";

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
      dispatch(fetchCampusPassThunk(contestSlug));
    }
  }, [contestSlug, dispatch]);

  useRealtimeEvents(contestSlug, (event) => {
    if (
      event.event === "pass_checked_in" ||
      event.event === "top30_qualified" ||
      event.event === "contest_status_changed" ||
      event.event === "contest_concluded" ||
      event.event === "contest_finished" ||
      event.event === "contest_timer_reset"
    ) {
      if (contestSlug) {
        dispatch(fetchContestDetailThunk({ slug: contestSlug, force: true }));
        dispatch(fetchCampusPassThunk(contestSlug));
      }
    }
  });

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

  // Hydrate from SWR sessionStorage cache on reload — no skeleton flash
  const cachedContest = !contest && contestSlug
    ? (globalSwrStore.get<any>(`contest:detail:${contestSlug}`)?.data ?? null)
    : null;
  const resolvedContest = contest ?? cachedContest;

  if (isLoadingDetail && !resolvedContest) {
    return <ContestOfflineSkeleton />;
  }

  if (!contest) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        <Link to="/contests" className="inline-flex items-center gap-1.5 font-sans text-xs text-zinc-500 hover:text-white transition-colors">
          <ArrowLeft className="size-3.5" /> Back to contests
        </Link>
        <p className="text-xs font-sans text-zinc-500">Contest not found.</p>
      </div>
    );
  }

  if (!qualified) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        <Link to={`/contests/${contestSlug}`} className="inline-flex items-center gap-1.5 font-sans text-xs text-zinc-500 hover:text-white transition-colors">
          <ArrowLeft className="size-3.5" /> Back to contest
        </Link>
        <Card className="rounded-[24px] border border-white/[0.08] bg-[#1F1F1F]">
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center font-sans">
            <div className="size-16 rounded-[16px] bg-[#171717] border border-white/[0.08] mb-1 flex items-center justify-center">
              <Lock className="size-8 text-[#B1FA63]" />
            </div>
            <h1 className="text-2xl font-normal text-white font-display uppercase tracking-wider">
              Finalist Area Restricted
            </h1>
            <p className="max-w-md text-xs text-zinc-400 leading-relaxed font-sans">
              {registration?.eligibility_message ??
                `This workstation portal is accessible only to Top ${FINALIST_SEATS} verified qualifiers.`}
            </p>
            <Button asChild variant="outline" className="mt-2 rounded-[10px]">
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
      <Link to={`/contests/${contestSlug}`} className="inline-flex items-center gap-1.5 font-sans text-xs text-zinc-500 hover:text-white transition-colors">
        <ArrowLeft className="size-3.5" /> Back to contest
      </Link>

      <PageHeader
        badge={
          <span className="rounded-full border border-[#B1FA63]/30 bg-[#B1FA63]/10 px-3 py-1 font-heading font-bold text-[10px] uppercase tracking-wider text-[#B1FA63]">
            Finalist Access Granted
          </span>
        }
        title={contest.title}
        description="Air-gapped proctored workstation environment at Medi-Caps Computing Complex."
      />

      {/* Hero Live Arena Launcher */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 border border-[#B1FA63]/30 bg-[#1F1F1F] rounded-[24px]">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-[#B1FA63] animate-pulse" />
            <h3 className="font-heading font-bold uppercase tracking-wider text-white text-sm">Air-Gapped Final Arena</h3>
          </div>
          <p className="text-xs text-zinc-400 font-sans">
            Seat: <strong className="text-[#B1FA63] font-sans">{pass?.seat || "Unassigned"}</strong> · Proctors: <span className="text-zinc-300">{contest.chief_proctors?.length ? contest.chief_proctors.join(", ") : "CCC Operations Desk"}</span>
          </p>
        </div>
        <Button asChild variant="outline" size="lg" className="rounded-[10px]">
          <a href={`/contests/${contestSlug}/lobby`} target="_blank" rel="noopener noreferrer">
            <Play className="size-3.5 fill-current mr-1.5" />
            Enter Arena
          </a>
        </Button>
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        {/* Countdown Card */}
        <Card className="rounded-[24px] border border-white/[0.08] bg-[#1F1F1F]">
          <CardHeader className="p-5 pb-3">
            <CardTitle className="font-heading font-bold text-[10px] uppercase tracking-widest text-zinc-400">
              {started ? "Contest Remaining" : "Tournament Bell"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <Countdown target={started ? contest.ends_at : contest.starts_at} label={started ? "Remaining" : "Countdown"} />
          </CardContent>
        </Card>

        {/* Check-In Card */}
        <Card className="rounded-[24px] border border-white/[0.08] bg-[#1F1F1F]">
          <CardHeader className="flex-row items-center gap-2 p-5 pb-3">
            <QrCode className="size-4 text-[#B1FA63]" />
            <CardTitle className="text-sm font-bold text-white font-heading uppercase tracking-wide">
              Gate Pass
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 font-sans text-xs text-zinc-300 p-5 pt-0">
            <div className="flex justify-center bg-white p-3.5 rounded-[14px]">
              <QRCodeSVG value={pass?.qr_data || pass?.pass_code || "PENDING_QUALIFICATION"} size={95} level="M" />
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-400 font-heading font-semibold text-[11px] uppercase">Code:</span>
              <span className="text-[#B1FA63] font-sans font-semibold">{pass?.pass_code || "Pending Qualification"}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-400 font-heading font-semibold text-[11px] uppercase">Workstation:</span>
              <span className="text-white font-sans font-semibold">{pass?.seat || "Unassigned"}</span>
            </div>
            <Button
              className="w-full rounded-[10px]"
              variant={checkedIn ? "secondary" : "default"}
              disabled={checkedIn || isCheckingIn || !pass?.pass_code}
              onClick={handleCheckIn}
            >
              {checkedIn ? "✓ Attendance Verified" : isCheckingIn ? "Checking In…" : "Confirm Check-in"}
            </Button>
          </CardContent>
        </Card>

        {/* Workstation Lab Info Card */}
        <Card className="rounded-[24px] border border-white/[0.08] bg-[#1F1F1F]">
          <CardHeader className="flex-row items-center gap-2 p-5 pb-3">
            <Cpu className="size-4 text-[#B1FA63]" />
            <CardTitle className="text-sm font-bold text-white font-heading uppercase tracking-wide">
              Workstation Spec
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 font-sans text-xs text-zinc-300 p-5 pt-0">
            <p className="text-white font-sans text-[11px]">{contest.environment || "Ubuntu 24.04 LTS · GCC 14.2 / Python 3.12 / Node 20"}</p>
            <p className="text-zinc-400">{contest.venue}</p>
            <p className="flex items-center gap-2 pt-1">
              <Users className="size-3.5 text-zinc-400" />
              <span><span className="font-semibold text-white tabular-nums font-sans">{contest.registered_count}</span> finalists seated</span>
            </p>
            <div className="pt-2 border-t border-white/[0.06]">
              <p className="text-[10px] text-zinc-400 font-heading font-semibold uppercase">Proctors:</p>
              <p className="text-zinc-300 text-xs mt-0.5">{contest.chief_proctors?.length ? contest.chief_proctors.join(", ") : "CCC Operations Desk"}</p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Problem Set Table */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-bold text-xs uppercase tracking-wider text-zinc-400">
            Final Problem Set
          </h2>
          <Button asChild variant="outline" size="sm" className="rounded-[10px]">
            <Link to={`/contests/${contestSlug}/problems`}>
              <Play className="size-3 text-[#B1FA63]" />
              <span>Open in Arena</span>
            </Link>
          </Button>
        </div>
        <div className="overflow-hidden rounded-[24px] border border-white/[0.08] bg-[#1F1F1F]">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-white/[0.08] hover:bg-transparent">
                <TableHead className="w-16 font-heading font-bold text-[10px] uppercase tracking-wider text-zinc-400">#</TableHead>
                <TableHead className="font-heading font-bold text-[10px] uppercase tracking-wider text-zinc-400">Problem</TableHead>
                <TableHead className="font-heading font-bold text-[10px] uppercase tracking-wider text-zinc-400">Topic</TableHead>
                <TableHead className="text-right font-heading font-bold text-[10px] uppercase tracking-wider text-zinc-400">Points</TableHead>
                <TableHead className="text-right font-heading font-bold text-[10px] uppercase tracking-wider text-zinc-400">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {problems.length === 0 ? (
                <TableRow className="border-b border-white/[0.06]">
                  <TableCell colSpan={5} className="py-12 text-center text-xs text-zinc-500 font-sans">
                    <Timer className="mx-auto mb-2 size-5 text-zinc-500" />
                    Problem set unseals at the start bell.
                  </TableCell>
                </TableRow>
              ) : (
                problems.map((problem) => (
                  <TableRow key={problem.problem_index} className="border-b border-white/[0.06] hover:bg-white/[0.02] transition-colors">
                    <TableCell className="font-sans text-xs font-semibold text-[#B1FA63]">{problem.problem_index}</TableCell>
                    <TableCell className="font-medium text-xs text-white">{problem.title}</TableCell>
                    <TableCell className="font-sans text-xs text-zinc-400">{problem.topic}</TableCell>
                    <TableCell className="text-right font-sans text-xs tabular-nums text-[#B1FA63]">{problem.points}</TableCell>
                    <TableCell className="text-right">
                      <Link
                        to={`/contests/${contestSlug}/problems/${slugifyProblem(problem.title, problem.problem_index)}`}
                        className="font-sans text-xs text-lime-400 hover:underline"
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
