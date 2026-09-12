import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  DifficultyBadge,
  EmptyState,
  ErrorState,
  MetaList,
  PageHeader,
  Panel,
  PanelHeader,
  ProblemStatusBadge,
  RouteFade,
  RowSkeletons,
  StaggerItem,
  TagList,
} from "@/organization/components/ui";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useDataMode } from "@/organization/data/data-mode";
import { portalQueries } from "@/organization/data/queries";
import type { Difficulty, ProblemStatus } from "@/organization/data/types";

export const Route = createFileRoute("/portal/problems/")({
  head: () => ({
    meta: [
      { title: "Problems — CCC Member Portal" },
      {
        name: "description",
        content: "The problem archive: build under constraints, break things, understand why.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProblemsPage,
});

function ProblemsPage() {
  const { mode } = useDataMode();
  const { data, isPending, isError, refetch } = useQuery(portalQueries.problems(mode));
  const [q, setQ] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty | "all">("all");
  const [status, setStatus] = useState<ProblemStatus | "all">("all");
  const [tag, setTag] = useState<string>("all");

  const tags = useMemo(
    () => Array.from(new Set((data ?? []).flatMap((p) => p.tags))).sort(),
    [data],
  );

  const list = (data ?? []).filter(
    (p) =>
      (difficulty === "all" || p.difficulty === difficulty) &&
      (status === "all" || p.status === status) &&
      (tag === "all" || p.tags.includes(tag)) &&
      (q.trim() === "" ||
        `${p.title} ${p.summary} ${p.tags.join(" ")}`
          .toLowerCase()
          .includes(q.trim().toLowerCase())),
  );

  const filtered = q.trim() !== "" || difficulty !== "all" || status !== "all" || tag !== "all";

  return (
    <RouteFade>
      <PageHeader
        title="Problems"
        description="Problems in the club's spirit: real constraints, hostile inputs, and systems that only fail once you use them properly."
      />

      <form
        className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        onSubmit={(e) => e.preventDefault()}
        role="search"
      >
        <div className="space-y-1.5">
          <Label
            htmlFor="problem-search"
            className="font-mono text-[0.5625rem] tracking-[0.16em] text-subtle-foreground uppercase"
          >
            Search
          </Label>
          <Input
            id="problem-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Title, tag or summary"
            className="rounded-none border-border bg-surface text-[0.8125rem]"
          />
        </div>

        <FilterSelect
          id="filter-difficulty"
          label="Difficulty"
          value={difficulty}
          onChange={(v) => setDifficulty(v as Difficulty | "all")}
          options={[
            ["all", "Any difficulty"],
            ["easy", "Easy"],
            ["medium", "Medium"],
            ["hard", "Hard"],
          ]}
        />
        <FilterSelect
          id="filter-status"
          label="Status"
          value={status}
          onChange={(v) => setStatus(v as ProblemStatus | "all")}
          options={[
            ["all", "Any status"],
            ["unsolved", "Unsolved"],
            ["attempted", "Attempted"],
            ["solved", "Solved"],
          ]}
        />
        <FilterSelect
          id="filter-tag"
          label="Tag"
          value={tag}
          onChange={setTag}
          options={[["all", "Any tag"], ...tags.map((t) => [t, t] as [string, string])]}
        />
      </form>

      <section className="mt-5">
        <p className="mb-3 font-mono text-[0.625rem] tabular-nums tracking-[0.16em] text-subtle-foreground uppercase">
          {isPending ? "Loading" : `${list.length} shown`}
        </p>
        {isPending ? (
          <RowSkeletons count={5} />
        ) : isError ? (
          <ErrorState message="The archive couldn't be loaded." onRetry={() => void refetch()} />
        ) : list.length === 0 ? (
          <EmptyState
            title={filtered ? "Nothing matches those filters" : "The archive is empty"}
            description={
              filtered
                ? "Loosen a filter — status and difficulty together narrow things quickly."
                : "No problems have been published yet. The first batch goes up with the next contest."
            }
          />
        ) : (
          <ul className="space-y-3">
            {list.map((p, i) => (
              <li key={p.id}>
                <StaggerItem index={i}>
                  <Panel className="hover:border-border-strong">
                    <Link
                      to="/portal/problems/$problemSlug"
                      params={{ problemSlug: p.slug }}
                      className="block px-4 py-4 transition-colors duration-150 ease-editorial hover:bg-surface-raised"
                    >
                      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                        <div className="min-w-0">
                          <h3 className="truncate font-display text-lg text-foreground">
                            {p.title}
                          </h3>
                          <p className="mt-1.5 max-w-2xl text-[0.8125rem] leading-relaxed text-muted-foreground">
                            {p.summary}
                          </p>
                          <div className="mt-3">
                            <TagList tags={p.tags} />
                          </div>
                        </div>
                        <div className="flex flex-row items-center gap-2 sm:flex-col sm:items-end">
                          <DifficultyBadge difficulty={p.difficulty} />
                          <ProblemStatusBadge status={p.status} />
                          <p className="font-mono text-[0.625rem] tabular-nums text-subtle-foreground">
                            {p.solved_by_count} solved
                          </p>
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

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="How to read a problem here" />
          <MetaList
            items={[
              ["Constraints first", "The limits tell you which approach is even allowed"],
              ["Hostile inputs", "Assume the worst input in range is the one you will be given"],
              ["Attempts count", "A rejected attempt is history, not a mark against you"],
              ["Editorials", "Write one for anything that took you more than an hour"],
              ["Difficulty", "Relative to the club, not to any external judge"],
            ]}
          />
        </Panel>
        <Panel>
          <PanelHeader title="Failure without embarrassment" />
          <div className="space-y-3 px-4 py-4 text-[0.8125rem] leading-relaxed text-muted-foreground">
            <p>
              Submissions here are queued and reviewed by people, not scored by a judge in four
              seconds. That means a wrong answer with a clear reason attached is genuinely more
              useful to the club than a silent accepted one.
            </p>
            <p>
              If a problem has beaten you twice, put your attempt and your reasoning in the note
              field and submit it anyway. Someone will read it.
            </p>
            <Link
              to="/portal/contests"
              className="inline-block font-mono text-[0.625rem] tracking-[0.16em] text-accent uppercase hover:underline"
            >
              See where these problems get used →
            </Link>
          </div>
        </Panel>
      </div>
    </RouteFade>
  );
}

function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <div className="space-y-1.5">
      <Label
        htmlFor={id}
        className="font-mono text-[0.5625rem] tracking-[0.16em] text-subtle-foreground uppercase"
      >
        {label}
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          id={id}
          className="w-full rounded-none border-border bg-surface text-[0.8125rem]"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="rounded-none">
          {options.map(([v, l]) => (
            <SelectItem key={v} value={v} className="rounded-none text-[0.8125rem]">
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
