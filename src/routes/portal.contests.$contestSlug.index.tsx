import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Clock,
  Gift,
  ListChecks,
  Lock,
  Play,
  QrCode,
  ShieldCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { contestApi } from "@/features/contest/api";
import { Countdown, PhaseBadge, RoundsTimeline, useTick } from "@/features/contest/components";
import {
  ASSESSMENT_DURATION_MINUTES,
  FINALIST_SEATS,
  assessmentClosesAt,
  assessmentOpensAt,
  cadenceLabel,
  contestPhase,
  formatWhen,
} from "@/features/contest/lifecycle";
import { contestQueries } from "@/features/contest/queries";

export const Route = createFileRoute("/portal/contests/$contestSlug/")({
  validateSearch: (search: Record<string, unknown>): { state?: string } => ({
    state: search["state"] ? String(search["state"]) : "default",
  }),
  loader: async ({ context, params }) => {
    try {
      return await context.queryClient.ensureQueryData(contestQueries.detail(params.contestSlug));
    } catch {
      throw notFound();
    }
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.title} — CCC Medi-Caps` : "Contest unavailable" },
      { name: "description", content: loaderData?.summary ?? "This contest is unavailable." },
      { property: "og:title", content: loaderData?.title ?? "Contest unavailable" },
      { property: "og:description", content: loaderData?.summary ?? "This contest is unavailable." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ContestOverview,
});

function ContestOverview() {
  const { contestSlug } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: contest } = useSuspenseQuery(contestQueries.detail(contestSlug));
  const { data: registration } = useQuery(contestQueries.registration(contestSlug));
  const { data: problems = [] } = useQuery(contestQueries.problems(contestSlug));
  const now = useTick(1000);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const phase = contestPhase(contest, registration ?? null, now);
  const isRegistered = Boolean(registration?.registered || contest.registered);
  const opensAt = assessmentOpensAt(contest);
  const closesAt = assessmentClosesAt(contest);
  const qualified = Boolean(registration?.is_top_30_qualified || registration?.can_enter_live_contest);

  const register = useMutation({
    mutationFn: () => contestApi.register(contestSlug),
    onSuccess: (result) => {
      toast.success(result.message || "You are registered for Round 1.");
      setConfirmOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["contest"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="page-wrap space-y-8">
      <Link to="/portal/contests" search={{ filter: "all" }} className="back-link">
        <ArrowLeft />
        All contests
      </Link>

      <header className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <PhaseBadge phase={phase} />
            <Badge variant="outline" className="rounded-none font-mono text-[10px] uppercase tracking-widest">
              {cadenceLabel(contest)}
              {contest.edition ? ` ${contest.edition}` : ""}
            </Badge>
            <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
              {contest.season}
            </span>
          </div>
          <h1 className="text-3xl font-black uppercase tracking-tight text-white">{contest.title}</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-[var(--muted)]">{contest.summary}</p>

          <div className="flex flex-wrap items-center gap-3">
            {!isRegistered && (phase === "registration_open" || phase === "assessment_open") && (
              <Button
                onClick={() => setConfirmOpen(true)}
                className="rounded-none font-mono text-xs font-bold uppercase tracking-wider"
              >
                <Users className="mr-2 size-4" />
                Register for Round 1
              </Button>
            )}

            {isRegistered && phase === "registration_open" && (
              <Button variant="outline" disabled className="rounded-none font-mono text-xs uppercase">
                <Lock className="mr-2 size-4" />
                Assessment unlocks 24h before the final
              </Button>
            )}

            {isRegistered && phase === "assessment_open" && (
              <Button asChild className="rounded-none font-mono text-xs font-bold uppercase tracking-wider">
                <Link to="/assessments/$contestSlug" params={{ contestSlug }}>
                  <Play className="mr-2 size-4 fill-current" />
                  Enter Round 1 assessment
                  <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
            )}

            {phase === "assessment_submitted" && (
              <Button variant="outline" disabled className="rounded-none font-mono text-xs uppercase">
                <BadgeCheck className="mr-2 size-4 text-[var(--accent)]" />
                Round 1 submitted
              </Button>
            )}

            {phase === "final_live" &&
              (qualified ? (
                <Button asChild className="rounded-none font-mono text-xs font-bold uppercase tracking-wider">
                  <Link to="/portal/contests/$contestSlug/offline" params={{ contestSlug }} search={{ state: "default" }}>
                    <QrCode className="mr-2 size-4" />
                    Open final contest room
                  </Link>
                </Button>
              ) : (
                <Button variant="outline" disabled className="rounded-none font-mono text-xs uppercase">
                  <Lock className="mr-2 size-4" />
                  Final restricted to Top {FINALIST_SEATS}
                </Button>
              ))}

            <Button asChild variant="outline" className="rounded-none font-mono text-xs uppercase">
              <Link
                to="/portal/contests/$contestSlug/results"
                params={{ contestSlug }}
                search={{ state: "default", query: "", filter: "all", sort: "rank" }}
              >
                Round 1 ranking
              </Link>
            </Button>
          </div>

          {isRegistered && (
            <Card className="rounded-none border-[var(--accent)]/40 bg-[var(--surface-1)]">
              <CardContent className="flex flex-wrap items-center gap-4 py-4">
                <ShieldCheck className="size-5 text-[var(--accent)]" />
                <div className="min-w-0 flex-1">
                  <strong className="text-sm text-white">Your seat is confirmed for Round 1</strong>
                  <p className="text-xs text-[var(--muted)]">
                    The assessment lasts {ASSESSMENT_DURATION_MINUTES} minutes. Once you start, the timer
                    cannot be paused or restarted, and your work is submitted automatically at zero.
                  </p>
                </div>
                {registration?.assessment_rank ? (
                  <Badge variant="outline" className="rounded-none font-mono text-[10px] uppercase">
                    Rank #{registration.assessment_rank} · {registration.assessment_score ?? 0} pts
                  </Badge>
                ) : null}
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="rounded-none border-[var(--line)] bg-[var(--surface-1)]">
          <CardHeader className="gap-4">
            <CardTitle className="font-mono text-xs uppercase tracking-widest text-[var(--muted)]">
              Contest clock
            </CardTitle>
            <Countdown
              target={now < opensAt.getTime() ? opensAt : now < closesAt.getTime() ? closesAt : contest.starts_at}
              label={
                now < opensAt.getTime()
                  ? "Round 1 opens in"
                  : now < closesAt.getTime()
                    ? "Round 1 closes in"
                    : "Offline final starts in"
              }
            />
          </CardHeader>
          <CardContent className="space-y-3 font-mono text-xs text-[var(--muted)]">
            <div className="flex justify-between gap-3">
              <span>Round 1 window</span>
              <span className="text-right text-white">{formatWhen(opensAt.toISOString())}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Offline final</span>
              <span className="text-right text-white">{formatWhen(contest.starts_at)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Venue</span>
              <span className="text-right text-white">{contest.venue}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Environment</span>
              <span className="text-right text-white">{contest.environment || "Campus workstations"}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Registered</span>
              <span className="text-right text-white">
                {contest.registered_count} / {contest.seat_capacity}
              </span>
            </div>
          </CardContent>
        </Card>
      </header>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-none border-[var(--line)] bg-[var(--surface-1)]">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-wide text-white">
              How this contest runs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RoundsTimeline contest={contest} phase={phase} />
          </CardContent>
        </Card>

        <Card className="rounded-none border-[var(--line)] bg-[var(--surface-1)]">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-wide text-white">
              Rules and qualification
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {(contest.rules.length
                ? contest.rules
                : [
                    "Round 1 is individual, open-book and fully timed.",
                    `Scores rank by points, then by penalty time. Top ${FINALIST_SEATS} advance.`,
                    "Leaving the assessment tab is recorded by proctoring telemetry.",
                    "The offline final is played on campus workstations with QR pass entry.",
                  ]
              ).map((rule, index) => (
                <li key={rule} className="flex gap-3 text-xs leading-relaxed text-[var(--muted)]">
                  <span className="font-mono text-[var(--accent)]">{String(index + 1).padStart(2, "0")}</span>
                  {rule}
                </li>
              ))}
            </ol>
            {contest.prize_pool && (
              <p className="mt-4 flex items-center gap-2 text-xs text-white">
                <Gift className="size-4 text-[var(--accent)]" />
                {contest.prize_pool}
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <ListChecks className="size-4 text-[var(--accent)]" />
          <h2 className="font-mono text-xs uppercase tracking-widest text-[var(--muted)]">
            Problem set · {problems.length || contest.problem_count} problems
          </h2>
        </div>
        <div className="border border-[var(--line)] bg-[var(--surface-1)]">
          <Table>
            <TableHeader>
              <TableRow className="border-[var(--line)]">
                <TableHead className="w-16 font-mono text-[10px] uppercase tracking-widest">#</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-widest">Problem</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-widest">Topic</TableHead>
                <TableHead className="text-right font-mono text-[10px] uppercase tracking-widest">Points</TableHead>
                <TableHead className="text-right font-mono text-[10px] uppercase tracking-widest">Solved</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {problems.length === 0 ? (
                <TableRow className="border-[var(--line)]">
                  <TableCell colSpan={5} className="py-10 text-center text-xs text-[var(--muted)]">
                    <Clock className="mx-auto mb-2 size-4" />
                    The problem set is sealed until Round 1 opens.
                  </TableCell>
                </TableRow>
              ) : (
                problems.map((problem) => (
                  <TableRow key={problem.problem_index} className="border-[var(--line)]">
                    <TableCell className="font-mono text-xs text-[var(--accent)]">{problem.problem_index}</TableCell>
                    <TableCell className="font-semibold text-white">{problem.title}</TableCell>
                    <TableCell className="font-mono text-xs text-[var(--muted)]">{problem.topic}</TableCell>
                    <TableCell className="text-right font-mono text-xs text-white">{problem.points}</TableCell>
                    <TableCell className="text-right font-mono text-xs text-[var(--muted)]">
                      {problem.solved_count}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="rounded-none border-[var(--line)] bg-[var(--surface-1)]">
          <DialogHeader>
            <DialogTitle>Register for {contest.title}?</DialogTitle>
            <DialogDescription>
              Registration reserves your Round 1 slot. The assessment opens{" "}
              {formatWhen(opensAt.toISOString())} and stays open for 24 hours. Your{" "}
              {ASSESSMENT_DURATION_MINUTES}-minute session starts the moment you enter and cannot be paused.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="rounded-none" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              className="rounded-none font-mono text-xs font-bold uppercase"
              disabled={register.isPending}
              onClick={() => {
                register.mutate(undefined, {
                  onSuccess: () => void navigate({ to: "/portal/contests/$contestSlug", params: { contestSlug } }),
                });
              }}
            >
              {register.isPending ? "Reserving…" : "Confirm registration"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
