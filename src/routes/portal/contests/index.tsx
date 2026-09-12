import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ContestStateBadge,
  DifficultyBadge,
  EmptyState,
  ErrorState,
  MetaList,
  PageHeader,
  Panel,
  PanelHeader,
  RouteFade,
  RowSkeletons,
  StaggerItem,
  TimeWindow,
} from "@/organization/components/ui";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDataMode } from "@/organization/data/data-mode";
import { competitionQueries } from "@/organization/data/queries";
import type { Contest, ContestState } from "@/organization/data/types";

export const Route = createFileRoute("/portal/contests/")({
  head: () => ({
    meta: [
      { title: "Contests — CCC Member Portal" },
      {
        name: "description",
        content: "Rated ladders, sprints and teardown rounds, with standings and editorials.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ContestsPage,
});

const FORMAT_NOTE: Record<Contest["format"], string> = {
  icpc: "ICPC scoring · 20-minute penalty per rejected submission on a solved problem",
  ladder: "Rated ladder · season rating carries into the invitational",
  sprint: "Unrated sprint · no penalties, submit early and often",
  teardown: "Comprehension round · read the codebase, cite file and line",
};

function ContestsPage() {
  const { mode } = useDataMode();
  const { data, isPending, isError, refetch } = useQuery(competitionQueries.contests(mode));
  const [tab, setTab] = useState<ContestState | "all">("all");

  const all = data ?? [];
  const list = tab === "all" ? all : all.filter((c) => c.state === tab);
  const live = all.filter((c) => c.state === "live");
  const registered = all.filter((c) => c.registered && c.state !== "finished");

  return (
    <RouteFade>
      <PageHeader
        title="Contests"
        description="Competition without hostility: a rated ladder every fortnight, unrated sprints in between, and teardown rounds where reading beats typing."
      />

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Panel className="px-4 py-4">
          <p className="font-mono text-[0.625rem] tracking-[0.18em] text-muted-foreground uppercase">
            Running now
          </p>
          <p className="mt-3 font-display text-3xl tabular-nums text-foreground">{live.length}</p>
          <p className="mt-2 text-xs text-subtle-foreground">
            {live.length ? live.map((c) => c.title).join(", ") : "Nothing live at this minute"}
          </p>
        </Panel>
        <Panel className="px-4 py-4">
          <p className="font-mono text-[0.625rem] tracking-[0.18em] text-muted-foreground uppercase">
            You&apos;re entered in
          </p>
          <p className="mt-3 font-display text-3xl tabular-nums text-foreground">
            {registered.length}
          </p>
          <p className="mt-2 text-xs text-subtle-foreground">
            Upcoming and live rounds you have registered for
          </p>
        </Panel>
        <Panel className="px-4 py-4">
          <p className="font-mono text-[0.625rem] tracking-[0.18em] text-muted-foreground uppercase">
            Season
          </p>
          <p className="mt-3 font-display text-3xl text-foreground">04</p>
          <p className="mt-2 text-xs text-subtle-foreground">
            Ratings reset at the end of each season; problem history does not
          </p>
        </Panel>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as ContestState | "all")} className="mt-6">
        <TabsList className="rounded-none border border-border bg-surface p-0">
          {(
            [
              ["all", "All"],
              ["live", "Live"],
              ["upcoming", "Upcoming"],
              ["finished", "Finished"],
            ] as const
          ).map(([v, l]) => (
            <TabsTrigger
              key={v}
              value={v}
              className="rounded-none font-mono text-[0.625rem] tracking-[0.16em] uppercase"
            >
              {l}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <section className="mt-5">
        {isPending ? (
          <RowSkeletons count={4} />
        ) : isError ? (
          <ErrorState message="Contests couldn't be loaded." onRetry={() => void refetch()} />
        ) : list.length === 0 ? (
          <EmptyState
            title="Nothing in this state"
            description="Finished rounds are hidden until you have played one. The next rated ladder opens registration a week ahead."
          />
        ) : (
          <ul className="space-y-3">
            {list.map((c, i) => (
              <li key={c.id}>
                <StaggerItem index={i}>
                  <Panel className="hover:border-border-strong">
                    <Link
                      to="/portal/contests/$contestSlug"
                      params={{ contestSlug: c.slug }}
                      className="block transition-colors duration-150 ease-editorial hover:bg-surface-raised"
                    >
                      <div className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                        <div className="min-w-0">
                          <h3 className="truncate font-display text-lg text-foreground">
                            {c.title}
                          </h3>
                          <p className="mt-1.5 max-w-2xl text-[0.8125rem] leading-relaxed text-muted-foreground">
                            {c.summary}
                          </p>
                          <p className="mt-2 font-mono text-[0.625rem] text-subtle-foreground">
                            {FORMAT_NOTE[c.format]}
                          </p>
                        </div>
                        <div className="flex flex-col items-start gap-2 sm:items-end">
                          <ContestStateBadge state={c.state} rated={c.rated} />
                          <TimeWindow startsAt={c.starts_at} endsAt={c.ends_at} />
                          <p className="font-mono text-[0.625rem] tabular-nums text-subtle-foreground">
                            {c.problem_count} problems · {c.registered_count} entered
                          </p>
                        </div>
                      </div>
                      <div className="border-t border-border">
                        <div className="flex flex-wrap gap-2 px-4 py-3">
                          {c.problems.map((p) => (
                            <span key={p.index} className="flex items-center gap-1.5">
                              <span className="border border-border px-1.5 py-0.5 font-mono text-[0.625rem] text-muted-foreground">
                                {p.index}
                              </span>
                              <DifficultyBadge difficulty={p.difficulty} />
                            </span>
                          ))}
                        </div>
                      </div>
                    </Link>
                  </Panel>
                </StaggerItem>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Panel className="mt-8">
        <PanelHeader title="How scoring works" />
        <MetaList
          items={[
            [
              "Rated ladder",
              "Individual, ICPC penalties, scoreboard freezes for the last 15 minutes",
            ],
            ["Sprint", "Unrated, no penalties, hints allowed after the first hour"],
            ["Teardown", "Reading only; answers must cite a file and a line range"],
            ["Partial credit", "A wrong conclusion with correct evidence scores half"],
            ["Editorials", "Due within 24 hours from whoever claims a problem in the channel"],
          ]}
        />
      </Panel>
    </RouteFade>
  );
}
