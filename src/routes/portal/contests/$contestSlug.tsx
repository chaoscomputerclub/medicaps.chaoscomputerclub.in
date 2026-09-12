import { Link, createFileRoute, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ActionButton,
  ContestStateBadge,
  DetailSkeleton,
  DifficultyBadge,
  EmptyState,
  ErrorState,
  Eyebrow,
  MetaList,
  Panel,
  PanelHeader,
  RankDelta,
  RouteFade,
  formatDateTime,
} from "@/organization/components/ui";
import { setContestRegistration } from "@/organization/data/api";
import { useDataMode } from "@/organization/data/data-mode";
import { competitionQueries } from "@/organization/data/queries";

export const Route = createFileRoute("/portal/contests/$contestSlug")({
  head: () => ({
    meta: [
      { title: "Contest — CCC Member Portal" },
      { name: "description", content: "Contest rules, problem set and standings." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ContestDetailPage,
});

function ContestDetailPage() {
  const { contestSlug } = useParams({ from: "/portal/contests/$contestSlug" });
  const { mode } = useDataMode();
  const qc = useQueryClient();
  const { data, isPending, isError, refetch } = useQuery(
    competitionQueries.contest(mode, contestSlug),
  );

  const register = useMutation({
    mutationFn: (next: boolean) => setContestRegistration(mode, contestSlug, next),
    onSuccess: (updated) => {
      void qc.invalidateQueries({ queryKey: ["portal", mode, "contest", contestSlug] });
      void qc.invalidateQueries({ queryKey: ["portal", mode, "contests"] });
      toast.success(
        updated.registered ? "You're entered. Read the rules." : "Registration withdrawn.",
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isPending)
    return (
      <RouteFade>
        <DetailSkeleton />
      </RouteFade>
    );

  if (isError)
    return (
      <RouteFade>
        <ErrorState message="This contest couldn't be loaded." onRetry={() => void refetch()} />
      </RouteFade>
    );

  if (!data)
    return (
      <RouteFade>
        <EmptyState
          title="No such contest"
          description="This round may have been renamed or pulled. The contest index has everything currently published."
          action={
            <Link
              to="/portal/contests"
              className="border border-border-strong px-3 py-1.5 font-mono text-[0.625rem] tracking-[0.16em] uppercase transition-colors duration-150 ease-editorial hover:bg-accent hover:text-accent-foreground"
            >
              All contests
            </Link>
          }
        />
      </RouteFade>
    );

  const you = data.standings.find((r) => r.is_you) ?? null;
  const solvedByYou = data.problems.filter((p) => p.member_result === "solved").length;

  return (
    <RouteFade>
      <div className="border-b border-border pb-6">
        <Link
          to="/portal/contests"
          className="font-mono text-[0.625rem] tracking-[0.16em] text-muted-foreground uppercase transition-colors duration-150 ease-editorial hover:text-accent"
        >
          ← Contests
        </Link>
        <div className="mt-3 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
          <div className="min-w-0">
            <Eyebrow>
              {data.season} · {data.format}
            </Eyebrow>
            <h1 className="mt-2 font-display text-2xl tracking-tight text-foreground">
              {data.title}
            </h1>
            <p className="mt-2 max-w-2xl text-[0.8125rem] leading-relaxed text-muted-foreground">
              {data.summary}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
            <ContestStateBadge state={data.state} rated={data.rated} />
            {data.state === "finished" ? (
              data.editorial_url ? (
                <a
                  href={data.editorial_url}
                  className="font-mono text-[0.625rem] tracking-[0.16em] text-accent uppercase hover:underline"
                >
                  Read the editorial
                </a>
              ) : (
                <p className="font-mono text-[0.625rem] text-subtle-foreground">
                  Editorial not written yet
                </p>
              )
            ) : (
              <ActionButton
                emphasis={data.registered ? "quiet" : "primary"}
                disabled={register.isPending}
                onClick={() => register.mutate(!data.registered)}
              >
                {register.isPending ? "Working" : data.registered ? "Withdraw entry" : "Register"}
              </ActionButton>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Panel>
            <PanelHeader title="Briefing" />
            <p className="px-4 py-4 text-[0.875rem] leading-relaxed text-muted-foreground">
              {data.description}
            </p>
          </Panel>

          <Panel>
            <PanelHeader
              title="Problem set"
              aside={
                <span className="font-mono text-[0.625rem] tabular-nums text-subtle-foreground">
                  {data.state === "upcoming"
                    ? "sealed until start"
                    : `${solvedByYou}/${data.problems.length} solved by you`}
                </span>
              }
            />
            {data.state === "upcoming" ? (
              <div className="px-4 py-4">
                <p className="text-[0.8125rem] leading-relaxed text-muted-foreground">
                  Titles are visible; statements unlock at {formatDateTime(data.starts_at)}. The
                  order below is by expected difficulty, not by the points each problem carries.
                </p>
                <ul className="mt-4 divide-y divide-border border border-border">
                  {data.problems.map((p) => (
                    <li
                      key={p.index}
                      className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 px-3 py-3"
                    >
                      <span className="font-mono text-[0.6875rem] text-index">{p.index}</span>
                      <span className="min-w-0 truncate text-[0.8125rem] text-foreground">
                        {p.title}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-[0.625rem] tabular-nums text-subtle-foreground">
                          {p.points} pts
                        </span>
                        <DifficultyBadge difficulty={p.difficulty} />
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {data.problems.map((p) => (
                  <li key={p.index}>
                    <Link
                      to="/portal/problems/$problemSlug"
                      params={{ problemSlug: p.problem_slug }}
                      className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 transition-colors duration-150 ease-editorial hover:bg-surface-raised"
                    >
                      <span className="font-mono text-[0.6875rem] text-index">{p.index}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-[0.875rem] text-foreground">
                          {p.title}
                        </span>
                        <span className="mt-1 block font-mono text-[0.625rem] tabular-nums text-subtle-foreground">
                          {p.points} pts · {p.solved_by_count} solved ·{" "}
                          {p.member_result === "untouched" ? "not opened by you" : p.member_result}
                        </span>
                      </span>
                      <DifficultyBadge difficulty={p.difficulty} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel>
            <PanelHeader
              title="Standings"
              aside={
                <span className="font-mono text-[0.625rem] tabular-nums text-subtle-foreground">
                  {data.standings.length ? `${data.standings.length} scored` : "no rows yet"}
                </span>
              }
            />
            {data.standings.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title="Standings open when the round starts"
                  description="The board updates on each accepted submission and freezes for the final fifteen minutes."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[34rem] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-border">
                      {["#", "Member", "Solved", "Penalty", "Score", "Δ"].map((h) => (
                        <th
                          key={h}
                          scope="col"
                          className="px-4 py-2.5 font-mono text-[0.5625rem] tracking-[0.16em] text-subtle-foreground uppercase"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.standings.map((r) => (
                      <tr
                        key={r.member_id}
                        className={
                          r.is_you
                            ? "border-b border-border bg-surface-raised"
                            : "border-b border-border"
                        }
                      >
                        <td className="px-4 py-3 font-mono text-[0.75rem] tabular-nums text-index">
                          {r.rank}
                        </td>
                        <td className="px-4 py-3">
                          <span className="block text-[0.8125rem] text-foreground">
                            {r.full_name}
                            {r.is_you ? " (you)" : ""}
                          </span>
                          <span className="font-mono text-[0.625rem] text-subtle-foreground">
                            @{r.handle}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-[0.75rem] tabular-nums text-foreground">
                          {r.solved}
                        </td>
                        <td className="px-4 py-3 font-mono text-[0.75rem] tabular-nums text-muted-foreground">
                          {r.penalty_minutes}m
                        </td>
                        <td className="px-4 py-3 font-mono text-[0.75rem] tabular-nums text-foreground">
                          {r.score}
                        </td>
                        <td className="px-4 py-3">
                          <RankDelta rank={0} previous={r.rating_delta} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel>
            <PanelHeader title="Details" />
            <MetaList
              items={[
                ["Window", formatDateTime(data.starts_at)],
                ["Duration", `${data.duration_minutes} minutes`],
                ["Problems", String(data.problem_count)],
                ["Entered", String(data.registered_count)],
                ["Rated", data.rated ? "yes" : "no"],
                ["Your entry", data.registered ? "registered" : "not registered"],
                ["Your rank", you ? `${you.rank} of ${data.standings.length}` : "not scored yet"],
              ]}
            />
          </Panel>

          <Panel>
            <PanelHeader title="Rules" />
            <ol className="divide-y divide-border">
              {data.rules.map((rule, i) => (
                <li key={rule} className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-2 px-4 py-3">
                  <span className="font-mono text-[0.625rem] tabular-nums text-index">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-[0.8125rem] leading-relaxed text-muted-foreground">
                    {rule}
                  </span>
                </li>
              ))}
            </ol>
          </Panel>

          <Panel>
            <PanelHeader title="Elsewhere" />
            <div className="flex flex-col gap-2 px-4 py-4">
              <Link
                to="/portal/leaderboard"
                className="font-mono text-[0.625rem] tracking-[0.16em] text-muted-foreground uppercase transition-colors duration-150 ease-editorial hover:text-accent"
              >
                Season leaderboard →
              </Link>
              <Link
                to="/portal/problems"
                className="font-mono text-[0.625rem] tracking-[0.16em] text-muted-foreground uppercase transition-colors duration-150 ease-editorial hover:text-accent"
              >
                Problem archive →
              </Link>
              <Link
                to="/portal/events"
                className="font-mono text-[0.625rem] tracking-[0.16em] text-muted-foreground uppercase transition-colors duration-150 ease-editorial hover:text-accent"
              >
                Events calendar →
              </Link>
            </div>
          </Panel>
        </div>
      </div>
    </RouteFade>
  );
}
