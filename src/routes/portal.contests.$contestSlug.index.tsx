import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Clock,
  Code2,
  Gift,
  ListChecks,
  Lock,
  MapPin,
  Play,
  QrCode,
  ShieldCheck,
  Trophy,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
      {
        property: "og:description",
        content: loaderData?.summary ?? "This contest is unavailable.",
      },
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
  const qualified = Boolean(
    registration?.is_top_30_qualified || registration?.can_enter_live_contest,
  );

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
    <div className="page-wrap max-w-6xl space-y-6">
      <Link to="/portal/contests" search={{ filter: "all" }} className="back-link">
        <ArrowLeft />
        Back to contests
      </Link>

      <header className="relative overflow-hidden rounded-lg border border-border bg-card/90 shadow-xl backdrop-blur-xl">
        <div
          className="absolute right-0 top-0 hidden h-full w-2/5 border-l border-border bg-secondary/30 lg:block"
          aria-hidden="true"
        />
        <div className="relative grid lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-6 p-6 md:p-9">
            <div className="flex flex-wrap items-center gap-2">
              <PhaseBadge phase={phase} />
              <Badge
                variant="outline"
                className="rounded-sm font-mono text-[10px] uppercase tracking-widest"
              >
                {cadenceLabel(contest)} {contest.edition || ""}
              </Badge>
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {contest.season}
              </span>
            </div>

            <div className="max-w-3xl space-y-3">
              <div className="flex items-start gap-4">
                <div className="hidden size-14 shrink-0 place-items-center rounded-lg border border-primary/30 bg-primary/10 text-primary sm:grid">
                  <Trophy className="size-6" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold leading-tight normal-case text-foreground md:text-4xl">
                    {contest.title}
                  </h1>
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    {contest.summary}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-2">
                <Clock className="size-4 text-primary" />
                {ASSESSMENT_DURATION_MINUTES} min assessment
              </span>
              <span className="flex items-center gap-2">
                <Users className="size-4 text-primary" />
                Top {FINALIST_SEATS} advance
              </span>
              <span className="flex items-center gap-2">
                <MapPin className="size-4 text-primary" />
                Campus final
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {!isRegistered && (phase === "registration_open" || phase === "assessment_open") && (
                <Button onClick={() => setConfirmOpen(true)} size="lg">
                  Register for Round 1
                  <ArrowRight className="size-4" />
                </Button>
              )}

              {isRegistered && phase === "registration_open" && (
                <Button asChild size="lg">
                  <Link
                    to="/portal/contests/$contestSlug/lobby"
                    params={{ contestSlug }}
                    search={{ state: "default" }}
                  >
                    View assessment lobby
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              )}

              {isRegistered && phase === "assessment_open" && (
                <Button asChild size="lg">
                  <Link
                    to="/portal/contests/$contestSlug/lobby"
                    params={{ contestSlug }}
                    search={{ state: "default" }}
                  >
                    <Play className="size-4 fill-current" />
                    Start assessment
                  </Link>
                </Button>
              )}

              {phase === "assessment_submitted" && (
                <Button variant="outline" disabled size="lg">
                  <BadgeCheck className="size-4 text-primary" />
                  Assessment submitted
                </Button>
              )}

              {phase === "final_live" &&
                (qualified ? (
                  <Button asChild size="lg">
                    <Link
                      to="/portal/contests/$contestSlug/offline"
                      params={{ contestSlug }}
                      search={{ state: "default" }}
                    >
                      <QrCode className="size-4" />
                      Open campus pass
                    </Link>
                  </Button>
                ) : (
                  <Button variant="outline" disabled size="lg">
                    <Lock className="size-4" />
                    Top {FINALIST_SEATS} only
                  </Button>
                ))}

              <Button asChild variant="ghost" size="lg">
                <Link
                  to="/portal/contests/$contestSlug/results"
                  params={{ contestSlug }}
                  search={{ state: "default", query: "", filter: "all", sort: "rank" }}
                >
                  View ranking
                </Link>
              </Button>

              {phase === "complete" && (
                <Button asChild variant="outline" size="lg">
                  <Link
                    to="/portal/contests/$contestSlug/final-results"
                    params={{ contestSlug }}
                    search={{ state: "default" }}
                  >
                    Final results
                  </Link>
                </Button>
              )}
            </div>

            {isRegistered && (
              <div className="flex flex-wrap items-center gap-3 rounded-md border border-primary/25 bg-primary/5 px-4 py-3">
                <ShieldCheck className="size-5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <strong className="text-sm text-foreground">
                    {phase === "assessment_submitted"
                      ? "Your answers are safely submitted"
                      : phase === "complete"
                        ? "Contest completed"
                        : "Your place is reserved"}
                  </strong>
                  <p className="text-xs text-muted-foreground">
                    Your timer begins only when you start Round 1 and cannot be paused.
                  </p>
                </div>
                {registration?.assessment_rank ? (
                  <Badge variant="outline">
                    Rank #{registration.assessment_rank} · {registration.assessment_score ?? 0} pts
                  </Badge>
                ) : null}
              </div>
            )}
          </div>

          <aside className="relative flex flex-col justify-between border-t border-border p-6 lg:border-l lg:border-t-0 lg:p-8">
            <div className="space-y-6">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Next milestone
              </span>
              {now < closesAt.getTime() && (
                <Countdown
                  target={
                    now < opensAt.getTime()
                      ? opensAt
                      : now < closesAt.getTime()
                        ? closesAt
                        : contest.starts_at
                  }
                  label={
                    now < opensAt.getTime()
                      ? "Round 1 opens in"
                      : now < closesAt.getTime()
                        ? "Round 1 closes in"
                        : "Offline final starts in"
                  }
                />
              )}
              <div className="h-px bg-border" />
              <dl className="space-y-4 text-xs">
                <div className="flex gap-3">
                  <CalendarDays className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div>
                    <dt className="text-muted-foreground">Round 1 opens</dt>
                    <dd className="mt-1 font-medium text-foreground">
                      {formatWhen(opensAt.toISOString())}
                    </dd>
                  </div>
                </div>
                <div className="flex gap-3">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div>
                    <dt className="text-muted-foreground">Offline final</dt>
                    <dd className="mt-1 font-medium text-foreground">
                      {formatWhen(contest.starts_at)} · {contest.venue}
                    </dd>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Code2 className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div>
                    <dt className="text-muted-foreground">Setup</dt>
                    <dd className="mt-1 font-medium text-foreground">
                      {contest.environment || "Campus workstations"}
                    </dd>
                  </div>
                </div>
              </dl>
            </div>
            <div className="mt-7 flex items-end justify-between border-t border-border pt-5">
              <div>
                <span className="text-2xl font-semibold text-foreground">
                  {contest.registered_count}
                </span>
                <span className="text-muted-foreground"> / {contest.seat_capacity}</span>
                <p className="text-xs text-muted-foreground">registered</p>
              </div>
              <Users className="size-5 text-muted-foreground" />
            </div>
          </aside>
        </div>
      </header>

      <nav
        aria-label="Contest sections"
        className="flex gap-6 overflow-x-auto border-b border-border px-1 text-sm"
      >
        <a href="#schedule" className="border-b-2 border-primary pb-3 font-medium text-foreground">
          Overview
        </a>
        <a
          href="#problems"
          className="pb-3 text-muted-foreground transition-colors hover:text-foreground"
        >
          Problems
        </a>
        <a
          href="#rules"
          className="pb-3 text-muted-foreground transition-colors hover:text-foreground"
        >
          Rules
        </a>
      </nav>

      <section
        id="schedule"
        className="grid scroll-mt-6 gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,.75fr)]"
      >
        <Card className="rounded-lg border-border bg-card/80 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-base font-semibold normal-case text-foreground">
              Your path to the final
            </CardTitle>
            <p className="text-sm text-muted-foreground">Two rounds. One clear path.</p>
          </CardHeader>
          <CardContent>
            <RoundsTimeline contest={contest} phase={phase} />
          </CardContent>
        </Card>

        <Card
          id="rules"
          className="scroll-mt-6 rounded-lg border-border bg-card/80 backdrop-blur-xl"
        >
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="text-base font-semibold normal-case text-foreground">
                Top {FINALIST_SEATS} qualify
              </CardTitle>
              <div className="grid size-11 place-items-center rounded-full border border-primary/30 bg-primary/10 font-display text-lg font-bold text-primary">
                30
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {(contest.rules.length
                ? contest.rules
                : [
                    "Round 1 is individual and fully timed.",
                    `Scores rank by points, then by penalty time. Top ${FINALIST_SEATS} advance.`,
                    "Keep the assessment open until your work is submitted.",
                    "The offline final is played on campus workstations with QR pass entry.",
                  ]
              ).map((rule, index) => (
                <li key={rule} className="flex gap-3 text-xs leading-relaxed text-muted-foreground">
                  <span className="font-mono text-primary">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {rule}
                </li>
              ))}
            </ol>
            {contest.prize_pool && (
              <p className="mt-5 flex items-center gap-2 border-t border-border pt-4 text-xs font-medium text-foreground">
                <Gift className="size-4 text-primary" />
                {contest.prize_pool}
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <section id="problems" className="scroll-mt-6 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <ListChecks className="size-4 text-primary" />
              <h2 className="text-base font-semibold normal-case text-foreground">Problem set</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {problems.length || contest.problem_count} problems · points determine your rank
            </p>
          </div>
          <Badge variant="outline" className="font-mono text-[10px] uppercase">
            Round 1
          </Badge>
        </div>
        <div className="overflow-hidden rounded-lg border border-border bg-card/80 backdrop-blur-xl">
          <Table>
            <TableHeader>
              <TableRow className="border-[var(--line)]">
                <TableHead className="w-16 font-mono text-[10px] uppercase tracking-widest">
                  #
                </TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-widest">
                  Problem
                </TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-widest">
                  Topic
                </TableHead>
                <TableHead className="text-right font-mono text-[10px] uppercase tracking-widest">
                  Points
                </TableHead>
                <TableHead className="text-right font-mono text-[10px] uppercase tracking-widest">
                  Solved
                </TableHead>
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
                    <TableCell className="font-mono text-xs text-primary">
                      {problem.problem_index}
                    </TableCell>
                    <TableCell className="font-semibold text-foreground">{problem.title}</TableCell>
                    <TableCell className="font-mono text-xs text-[var(--muted)]">
                      {problem.topic}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-foreground">
                      {problem.points}
                    </TableCell>
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
        <DialogContent className="rounded-lg border-border bg-card">
          <DialogHeader>
            <DialogTitle>Register for {contest.title}?</DialogTitle>
            <DialogDescription>
              Registration reserves your Round 1 slot. The assessment opens{" "}
              {formatWhen(opensAt.toISOString())} and stays open for 24 hours. Your{" "}
              {ASSESSMENT_DURATION_MINUTES}-minute session starts the moment you enter and cannot be
              paused.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="rounded-md" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              className="rounded-md text-xs font-bold"
              disabled={register.isPending}
              onClick={() => {
                register.mutate(undefined, {
                  onSuccess: () =>
                    void navigate({ to: "/portal/contests/$contestSlug", params: { contestSlug } }),
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
