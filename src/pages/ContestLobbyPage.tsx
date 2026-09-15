import { Link, useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, Clock, Lock, ShieldCheck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Countdown } from "@/features/contest/components";
import {
  ASSESSMENT_DURATION_MINUTES,
  ASSESSMENT_WINDOW_HOURS,
  FINALIST_SEATS,
  assessmentClosesAt,
  assessmentOpensAt,
  contestPhase,
  formatWhen,
} from "@/features/contest/lifecycle";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchContestDetailThunk } from "@/store/slices/contestSlice";

export function ContestLobbyPage() {
  const { contestSlug = "" } = useParams<{ contestSlug: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [ack, setAck] = useState(false);

  const { currentContest: contest, registration, isLoadingDetail } = useAppSelector(
    (state) => state.contest
  );

  useEffect(() => {
    if (contestSlug) {
      dispatch(fetchContestDetailThunk(contestSlug));
    }
  }, [contestSlug, dispatch]);

  if (isLoadingDetail && !contest) {
    return (
      <div className="page-wrap space-y-6">
        <div className="py-12 text-center font-mono text-xs text-[var(--muted)]">Loading assessment lobby…</div>
      </div>
    );
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

  const phase = contestPhase(contest, registration ?? null);
  const opensAt = assessmentOpensAt(contest);
  const closesAt = assessmentClosesAt(contest);
  const isDevBypass = Boolean(registration?.is_dev_bypass || contestSlug.startsWith("dev-"));
  const notYetOpen = phase === "registration_open" && !isDevBypass;
  const canStart = Boolean(registration?.can_take_assessment) || phase === "assessment_open" || isDevBypass;

  return (
    <div className="page-wrap space-y-6">
      <Link to={`/portal/contests/${contestSlug}`} className="back-link">
        <ArrowLeft />
        Back to contest
      </Link>

      <header className="space-y-2">
        <p className="kicker">Round 1 · Online assessment</p>
        <h1 className="text-2xl font-black uppercase tracking-tight text-white">{contest.title}</h1>
        <p className="max-w-2xl text-sm text-[var(--muted)]">
          You are one click away from your single attempt. Read the three rules below — they are the
          only things you need to know.
        </p>
      </header>

      <Alert className="rounded-none border-[var(--accent)]/50 bg-[var(--surface-1)]">
        <AlertTriangle className="size-4 text-[var(--accent)]" />
        <AlertTitle className="font-mono text-xs font-bold uppercase tracking-widest text-white">
          The {ASSESSMENT_DURATION_MINUTES / 60}-hour clock cannot be paused
        </AlertTitle>
        <AlertDescription className="text-sm leading-relaxed text-[var(--muted)]">
          Once you press Start, the clock runs continuously for {ASSESSMENT_DURATION_MINUTES} minutes.
          Closing the tab, refreshing, changing your system time, or losing your connection does not
          stop it — the countdown is kept by the contest server. When it reaches zero your work is
          submitted automatically and the attempt is locked. There is no second attempt.
        </AlertDescription>
      </Alert>

      {isDevBypass && (
        <div className="flex items-center gap-2 rounded-none border border-emerald-500/40 bg-emerald-950/20 px-4 py-3 font-mono text-xs text-emerald-400">
          <span>⚡ <strong>DEV BYPASS ACTIVE:</strong> Scheduled entry window restriction is bypassed. You can check the acknowledgment below and start your assessment session immediately.</span>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-none border-[var(--line)] bg-[var(--surface-1)]">
          <CardHeader className="gap-2">
            <Clock className="size-4 text-[var(--accent)]" />
            <CardTitle className="text-sm font-bold uppercase tracking-wide text-white">
              Entry window · {ASSESSMENT_WINDOW_HOURS}h
            </CardTitle>
            <p className="font-mono text-xs text-[var(--muted)]">
              {formatWhen(opensAt.toISOString())} → {formatWhen(closesAt.toISOString())}
            </p>
          </CardHeader>
        </Card>
        <Card className="rounded-none border-[var(--line)] bg-[var(--surface-1)]">
          <CardHeader className="gap-2">
            <Lock className="size-4 text-[var(--accent)]" />
            <CardTitle className="text-sm font-bold uppercase tracking-wide text-white">
              One attempt
            </CardTitle>
            <p className="font-mono text-xs text-[var(--muted)]">
              No resume, no restart, no extension
            </p>
          </CardHeader>
        </Card>
        <Card className="rounded-none border-[var(--line)] bg-[var(--surface-1)]">
          <CardHeader className="gap-2">
            <ShieldCheck className="size-4 text-[var(--accent)]" />
            <CardTitle className="text-sm font-bold uppercase tracking-wide text-white">
              Top {FINALIST_SEATS} advance
            </CardTitle>
            <p className="font-mono text-xs text-[var(--muted)]">Score first, then time taken</p>
          </CardHeader>
        </Card>
      </div>

      <Card className="rounded-none border-[var(--line)] bg-[var(--surface-1)]">
        <CardContent className="space-y-5 py-6">
          {notYetOpen ? (
            <div className="flex flex-wrap items-end justify-between gap-6">
              <Countdown target={opensAt} label="Round 1 opens in" />
              <Badge
                variant="outline"
                className="rounded-none border-sky-500/40 font-mono text-[10px] uppercase tracking-widest text-sky-300"
              >
                Waiting for the window
              </Badge>
            </div>
          ) : (
            <div className="flex flex-wrap items-end justify-between gap-6">
              <Countdown target={closesAt} label="Window closes in" />
              <span className="font-mono text-xs text-[var(--muted)]">
                {contest.problem_count} problems · judged on hidden tests
              </span>
            </div>
          )}

          <Separator className="bg-[var(--line)]" />

          {registration && !registration.registered ? (
            <p className="text-sm text-[var(--muted)]">
              You are not registered for this edition yet. Register on the contest page first, then
              come back here when the window opens.
            </p>
          ) : (
            <>
              <label className="flex cursor-pointer items-start gap-3 text-sm text-[var(--muted)]">
                <Checkbox
                  checked={ack}
                  onCheckedChange={(value) => setAck(value === true)}
                  className="mt-0.5 rounded-none border-[var(--line)]"
                />
                <span>
                  I understand this is my only attempt, that the {ASSESSMENT_DURATION_MINUTES}-minute
                  clock starts immediately and cannot be paused, and that my work is submitted
                  automatically when it ends.
                </span>
              </label>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  disabled={!ack || !canStart}
                  onClick={() => navigate(`/assessments/${contestSlug}`)}
                  className="rounded-none font-mono text-xs font-bold uppercase tracking-wider"
                >
                  Start assessment
                </Button>
                <Button asChild variant="ghost" className="rounded-none font-mono text-xs uppercase">
                  <Link to={`/portal/contests/${contestSlug}`}>Not now</Link>
                </Button>
              </div>

              {!canStart && (
                <p className="font-mono text-xs text-amber-300">
                  {registration?.eligibility_message ??
                    (notYetOpen
                      ? "Start unlocks the moment the window opens."
                      : "The contest server is not accepting new attempts right now.")}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
