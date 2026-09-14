import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Cpu, Lock, ScanLine, ShieldCheck, Timer, Users } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { contestApi } from "@/features/contest/api";
import { Countdown, useTick } from "@/features/contest/components";
import { FINALIST_SEATS, formatWhen } from "@/features/contest/lifecycle";
import { contestQueries } from "@/features/contest/queries";

export const Route = createFileRoute("/portal/contests/$contestSlug/offline")({
  validateSearch: (search: Record<string, unknown>): { state?: string } => ({
    state: search["state"] ? String(search["state"]) : "default",
  }),
  head: () => ({
    meta: [
      { title: "Final Contest Room — CCC Medi-Caps" },
      {
        name: "description",
        content: "Check in, take your workstation, and play the offline campus final as a Top 30 finalist.",
      },
      { property: "og:title", content: "Final Contest Room — CCC Medi-Caps" },
      { property: "og:description", content: "Proctored offline final for the Top 30 finalists." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(contestQueries.detail(params.contestSlug)),
  component: FinalRoom,
});

function FinalRoom() {
  const { contestSlug } = Route.useParams();
  const { data: contest } = useSuspenseQuery(contestQueries.detail(contestSlug));
  const { data: registration } = useQuery(contestQueries.registration(contestSlug));
  const { data: pass } = useQuery(contestQueries.pass());
  const { data: problems = [] } = useQuery(contestQueries.problems(contestSlug));
  const now = useTick(1000);

  const qualified = Boolean(registration?.is_top_30_qualified || registration?.can_enter_live_contest);
  const checkedIn = pass?.status === "checked_in";
  const started = now >= new Date(contest.starts_at).getTime();

  const checkIn = useMutation({
    mutationFn: () => contestApi.checkIn(contestSlug),
    onSuccess: (result) => toast.success(result.message || "Checked in. Take your assigned workstation."),
    onError: (error: Error) => toast.error(error.message),
  });

  if (!qualified) {
    return (
      <div className="page-wrap space-y-6">
        <Link to="/portal/contests/$contestSlug" params={{ contestSlug }} search={{ state: "default" }} className="back-link">
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
            <Button asChild variant="outline" className="rounded-none font-mono text-xs uppercase">
              <Link
                to="/portal/contests/$contestSlug/results"
                params={{ contestSlug }}
                search={{ state: "default", query: "", filter: "all", sort: "rank" }}
              >
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
      <Link to="/portal/contests/$contestSlug" params={{ contestSlug }} search={{ state: "default" }} className="back-link">
        <ArrowLeft />
        Back to contest
      </Link>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="rounded-none border-[var(--accent)] font-mono text-[10px] uppercase text-[var(--accent)]">
            Finalist access
          </Badge>
          <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
            Round 2 · Offline
          </span>
        </div>
        <h1 className="text-2xl font-black uppercase tracking-tight text-white">{contest.title}</h1>
        <p className="max-w-2xl text-sm text-[var(--muted)]">
          The final is played entirely on campus workstations. Check in at the desk, take your seat, and
          the proctor releases the problem set at the start bell.
        </p>
      </header>

      <section className="grid gap-4 lg:grid-cols-3">
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

        <Card className="rounded-none border-[var(--line)] bg-[var(--surface-1)]">
          <CardHeader className="flex-row items-center gap-2">
            <ScanLine className="size-4 text-[var(--accent)]" />
            <CardTitle className="text-sm font-bold uppercase tracking-wide text-white">Check-in</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 font-mono text-xs text-[var(--muted)]">
            <p>Check-in opens {formatWhen(contest.check_in_opens_at)}.</p>
            <p>
              Seat: <span className="text-white">{pass?.seat ?? "Assigned at the desk"}</span>
            </p>
            <Button
              className="w-full rounded-none font-mono text-xs font-bold uppercase"
              disabled={checkedIn || checkIn.isPending}
              onClick={() => checkIn.mutate()}
            >
              {checkedIn ? "Checked in" : checkIn.isPending ? "Checking in…" : "Confirm check-in"}
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-none border-[var(--line)] bg-[var(--surface-1)]">
          <CardHeader className="flex-row items-center gap-2">
            <Cpu className="size-4 text-[var(--accent)]" />
            <CardTitle className="text-sm font-bold uppercase tracking-wide text-white">
              Workstation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 font-mono text-xs text-[var(--muted)]">
            <p className="text-white">{contest.environment || "Campus lab workstation"}</p>
            <p>{contest.venue}</p>
            <p className="flex items-center gap-2">
              <Users className="size-3.5" />
              {contest.registered_count} finalists seated
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="font-mono text-xs uppercase tracking-widest text-[var(--muted)]">
          Final problem set
        </h2>
        <div className="border border-[var(--line)] bg-[var(--surface-1)]">
          <Table>
            <TableHeader>
              <TableRow className="border-[var(--line)]">
                <TableHead className="w-16 font-mono text-[10px] uppercase tracking-widest">#</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-widest">Problem</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-widest">Topic</TableHead>
                <TableHead className="text-right font-mono text-[10px] uppercase tracking-widest">Points</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!started || problems.length === 0 ? (
                <TableRow className="border-[var(--line)]">
                  <TableCell colSpan={4} className="py-12 text-center text-xs text-[var(--muted)]">
                    <Timer className="mx-auto mb-2 size-4" />
                    The problem set unseals at the start bell, on your workstation.
                  </TableCell>
                </TableRow>
              ) : (
                problems.map((problem) => (
                  <TableRow key={problem.problem_index} className="border-[var(--line)]">
                    <TableCell className="font-mono text-xs text-[var(--accent)]">{problem.problem_index}</TableCell>
                    <TableCell className="font-semibold text-white">{problem.title}</TableCell>
                    <TableCell className="font-mono text-xs text-[var(--muted)]">{problem.topic}</TableCell>
                    <TableCell className="text-right font-mono text-xs text-white">{problem.points}</TableCell>
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
            Proctoring
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 font-mono text-xs text-[var(--muted)] sm:grid-cols-2">
          {(contest.chief_proctors.length ? contest.chief_proctors : ["CCC Operations Desk"]).map((name) => (
            <span key={name} className="text-white">
              {name}
            </span>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
