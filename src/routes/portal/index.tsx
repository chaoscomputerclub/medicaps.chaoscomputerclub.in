import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  DifficultyBadge,
  EmptyState,
  ErrorState,
  PageHeader,
  Panel,
  PanelHeader,
  RouteFade,
  RowSkeletons,
  RsvpBadge,
  StatBlock,
  StatSkeletons,
  StaggerItem,
  formatDateTime,
  formatRelative,
} from "@/organization/components/ui";
import { ContestStateBadge, MetaList, RankDelta, TimeWindow } from "@/organization/components/ui";
import { useDataMode } from "@/organization/data/data-mode";
import { competitionQueries, portalQueries } from "@/organization/data/queries";

export const Route = createFileRoute("/portal/")({
  head: () => ({
    meta: [
      { title: "Dashboard — CCC Member Portal" },
      { name: "description", content: "Your upcoming events, open problems and recent activity." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { mode } = useDataMode();
  const memberQ = useQuery(portalQueries.member(mode));
  const eventsQ = useQuery(portalQueries.events(mode));
  const problemsQ = useQuery(portalQueries.problems(mode));
  const activityQ = useQuery(portalQueries.activity(mode));
  const contestsQ = useQuery(competitionQueries.contests(mode));
  const boardQ = useQuery(competitionQueries.leaderboard(mode, "season"));

  const liveContest = (contestsQ.data ?? []).find((c) => c.state === "live") ?? null;
  const nextContest =
    (contestsQ.data ?? [])
      .filter((c) => c.state === "upcoming")
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0] ?? null;
  const you = (boardQ.data ?? []).find((r) => r.is_you) ?? null;

  const upcoming = (eventsQ.data ?? [])
    .filter((e) => e.state !== "past" && e.rsvp_status !== "none")
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  const open = (problemsQ.data ?? []).filter((p) => p.status !== "solved").slice(0, 4);

  return (
    <RouteFade>
      <PageHeader
        title={
          memberQ.data ? `Good to see you, ${memberQ.data.full_name.split(" ")[0]}` : "Dashboard"
        }
        description="What you're registered for, what's still open, and what you've done lately."
      />

      <section className="mt-6" aria-labelledby="stats-heading">
        <h2 id="stats-heading" className="sr-only">
          Your numbers
        </h2>
        {memberQ.isPending ? (
          <StatSkeletons />
        ) : memberQ.isError ? (
          <ErrorState
            message="Your stats couldn't be loaded."
            onRetry={() => void memberQ.refetch()}
          />
        ) : memberQ.data ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatBlock
              label="Problems solved"
              value={memberQ.data.stats.problems_solved}
              hint="Across every difficulty"
            />
            <StatBlock
              label="Events attended"
              value={memberQ.data.stats.events_attended}
              hint="Hackathons, contests, meetups"
            />
            <StatBlock
              label="Current streak"
              value={memberQ.data.stats.current_streak_days}
              unit="days"
              hint="A solve, review or session each day"
            />
            <StatBlock
              label="Contributions"
              value={memberQ.data.stats.contributions}
              hint="Editorials, fixes, sessions run"
            />
          </div>
        ) : null}
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel>
          <PanelHeader
            title={liveContest ? "Running right now" : "Next contest"}
            aside={
              <Link
                to="/portal/contests"
                className="font-mono text-[0.625rem] tracking-[0.16em] text-muted-foreground uppercase transition-colors duration-150 ease-editorial hover:text-accent"
              >
                All contests
              </Link>
            }
          />
          {contestsQ.isPending ? (
            <div className="p-4">
              <RowSkeletons count={1} />
            </div>
          ) : contestsQ.isError ? (
            <div className="p-4">
              <ErrorState
                message="Contests couldn't be loaded."
                onRetry={() => void contestsQ.refetch()}
              />
            </div>
          ) : (liveContest ?? nextContest) ? (
            (() => {
              const c = (liveContest ?? nextContest)!;
              return (
                <Link
                  to="/portal/contests/$contestSlug"
                  params={{ contestSlug: c.slug }}
                  className="block px-4 py-4 transition-colors duration-150 ease-editorial hover:bg-surface-raised"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <ContestStateBadge state={c.state} rated={c.rated} />
                    <TimeWindow startsAt={c.starts_at} endsAt={c.ends_at} />
                  </div>
                  <h3 className="mt-2.5 font-display text-lg text-foreground">{c.title}</h3>
                  <p className="mt-1.5 max-w-xl text-[0.8125rem] leading-relaxed text-muted-foreground">
                    {c.summary}
                  </p>
                  <p className="mt-2.5 font-mono text-[0.625rem] tabular-nums text-subtle-foreground">
                    {c.problem_count} problems · {c.registered_count} entered ·{" "}
                    {c.registered ? "you are registered" : "you have not registered"}
                  </p>
                </Link>
              );
            })()
          ) : (
            <div className="p-4">
              <EmptyState
                title="No round scheduled"
                description="The next rated ladder is announced a week before it opens. Sprints appear with less notice."
              />
            </div>
          )}
        </Panel>

        <Panel>
          <PanelHeader
            title="Season standing"
            aside={
              <Link
                to="/portal/leaderboard"
                className="font-mono text-[0.625rem] tracking-[0.16em] text-muted-foreground uppercase transition-colors duration-150 ease-editorial hover:text-accent"
              >
                Leaderboard
              </Link>
            }
          />
          {boardQ.isPending ? (
            <div className="p-4">
              <RowSkeletons count={1} />
            </div>
          ) : boardQ.isError ? (
            <div className="p-4">
              <ErrorState
                message="Standings couldn't be loaded."
                onRetry={() => void boardQ.refetch()}
              />
            </div>
          ) : you ? (
            <>
              <div className="flex items-baseline gap-3 px-4 pt-4">
                <span className="font-display text-3xl tabular-nums text-foreground">
                  #{you.rank}
                </span>
                <RankDelta rank={you.rank} previous={you.previous_rank} />
                <span className="font-mono text-[0.625rem] text-subtle-foreground">
                  of {(boardQ.data ?? []).length}
                </span>
              </div>
              <div className="mt-3">
                <MetaList
                  items={[
                    ["Rating", String(you.rating)],
                    ["Contests played", String(you.contests_played)],
                    ["Contributions", String(you.contributions)],
                    ["Streak", `${you.streak_days} days`],
                  ]}
                />
              </div>
            </>
          ) : (
            <div className="p-4">
              <EmptyState
                title="Not ranked yet"
                description="Submit once in any rated round and you appear on the board — position included, however uncomfortable."
              />
            </div>
          )}
        </Panel>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Panel>
            <PanelHeader
              title="Your upcoming events"
              aside={
                <Link
                  to="/portal/events"
                  className="font-mono text-[0.625rem] tracking-[0.16em] text-muted-foreground uppercase transition-colors duration-150 ease-editorial hover:text-accent"
                >
                  All events
                </Link>
              }
            />
            {eventsQ.isPending ? (
              <div className="p-4">
                <RowSkeletons count={3} />
              </div>
            ) : eventsQ.isError ? (
              <div className="p-4">
                <ErrorState
                  message="Events couldn't be loaded."
                  onRetry={() => void eventsQ.refetch()}
                />
              </div>
            ) : upcoming.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title="Nothing on your calendar yet"
                  description="You aren't registered for anything upcoming. Three things are open right now — a contest, a hackathon and a source-reading night."
                  action={
                    <Link
                      to="/portal/events"
                      className="border border-border-strong px-3 py-1.5 font-mono text-[0.625rem] tracking-[0.16em] uppercase transition-colors duration-150 ease-editorial hover:bg-accent hover:text-accent-foreground"
                    >
                      Browse events
                    </Link>
                  }
                />
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {upcoming.map((e, i) => (
                  <li key={e.id}>
                    <StaggerItem index={i}>
                      <Link
                        to="/portal/events/$eventSlug"
                        params={{ eventSlug: e.slug }}
                        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-4 transition-colors duration-150 ease-editorial hover:bg-surface-raised"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm text-foreground">{e.title}</span>
                          <span className="mt-1 block font-mono text-[0.6875rem] text-subtle-foreground">
                            {formatDateTime(e.starts_at)} ·{" "}
                            {e.mode === "online" ? "Online" : e.location}
                          </span>
                        </span>
                        <RsvpBadge status={e.rsvp_status} state={e.state} />
                      </Link>
                    </StaggerItem>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel>
            <PanelHeader
              title="Open problems"
              aside={
                <Link
                  to="/portal/problems"
                  className="font-mono text-[0.625rem] tracking-[0.16em] text-muted-foreground uppercase transition-colors duration-150 ease-editorial hover:text-accent"
                >
                  Archive
                </Link>
              }
            />
            {problemsQ.isPending ? (
              <div className="p-4">
                <RowSkeletons count={3} />
              </div>
            ) : problemsQ.isError ? (
              <div className="p-4">
                <ErrorState
                  message="Problems couldn't be loaded."
                  onRetry={() => void problemsQ.refetch()}
                />
              </div>
            ) : open.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title="Nothing open"
                  description="You've cleared everything currently published. New problems land every week."
                />
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {open.map((p, i) => (
                  <li key={p.id}>
                    <StaggerItem index={i}>
                      <Link
                        to="/portal/problems/$problemSlug"
                        params={{ problemSlug: p.slug }}
                        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-4 transition-colors duration-150 ease-editorial hover:bg-surface-raised"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm text-foreground">{p.title}</span>
                          <span className="mt-1 block truncate font-mono text-[0.6875rem] text-subtle-foreground">
                            {p.attempts > 0 ? `${p.attempts} attempts · ` : ""}
                            {p.tags.join(" / ")}
                          </span>
                        </span>
                        <DifficultyBadge difficulty={p.difficulty} />
                      </Link>
                    </StaggerItem>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <Panel>
          <PanelHeader title="Recent activity" />
          {activityQ.isPending ? (
            <div className="p-4">
              <RowSkeletons count={4} />
            </div>
          ) : activityQ.isError ? (
            <div className="p-4">
              <ErrorState
                message="Activity couldn't be loaded."
                onRetry={() => void activityQ.refetch()}
              />
            </div>
          ) : (activityQ.data ?? []).length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="No history yet"
                description="Your first solve, attempt or registration shows up here. An attempt that fails counts as history too."
              />
            </div>
          ) : (
            <ol className="divide-y divide-border">
              {(activityQ.data ?? []).map((a, i) => (
                <li key={a.id}>
                  <StaggerItem index={i} className="px-4 py-3.5">
                    <p className="text-[0.8125rem] leading-snug text-foreground">{a.title}</p>
                    {a.detail ? (
                      <p className="mt-1 text-xs text-muted-foreground">{a.detail}</p>
                    ) : null}
                    <p className="mt-1.5 font-mono text-[0.625rem] text-subtle-foreground">
                      {formatRelative(a.occurred_at)}
                    </p>
                  </StaggerItem>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>
    </RouteFade>
  );
}
