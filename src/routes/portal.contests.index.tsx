import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarDays, Users, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, SectionHeader } from "@/organization/components/ui";
import { LifecycleBadge, TwoStageIndicator } from "@/organization/components/ContestSystemUI";
import { contestSystemQueries } from "@/organization/data/contest-queries";
import { reviewState } from "@/organization/data/contest-system";

const query = contestSystemQueries.contests();

export const Route = createFileRoute("/portal/contests/")({
  validateSearch: (s: Record<string, unknown>): { filter?: string | undefined; state?: ReturnType<typeof reviewState> | undefined } => ({
    filter: ["all", "upcoming", "live", "past"].includes(String(s["filter"]))
      ? String(s["filter"])
      : "all",
    state: s["state"] ? reviewState(s["state"]) : "default",
  }),
  head: () => ({
    meta: [
      { title: "Two-Round Contests — CCC Medi-Caps" },
      { name: "description", content: "Register online, rank in the Top 30, and advance to CCC Medi-Caps live finals." },
      { property: "og:title", content: "Two-Round Contests — CCC Medi-Caps" },
      { property: "og:description", content: "Online assessments, Top 30 qualification, and live campus finals." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(query),
  component: Contests,
});

function Contests() {
  const { data } = useSuspenseQuery(query);
  const { filter, state } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  // Filter out live contests if explicitly flagged ineligible
  const eligibleData = data.filter((c) => {
    const isLive = c.lifecycle === "assessment_live" || (c as any).status === "live";
    if (isLive && c.is_eligible === false) return false;
    return true;
  });

  const allCount = eligibleData.length;
  const upcomingCount = eligibleData.filter((c) => c.lifecycle === "registration_open").length;
  const liveCount = eligibleData.filter((c) =>
    ["assessment_live", "results_pending", "qualification_announced"].includes(c.lifecycle)
  ).length;
  const pastCount = eligibleData.filter((c) => c.lifecycle === "offline_complete").length;

  const shown =
    state === "empty"
      ? []
      : eligibleData.filter(
          (c) =>
            filter === "all" ||
            (filter === "upcoming" && c.lifecycle === "registration_open") ||
            (filter === "live" &&
              ["assessment_live", "results_pending", "qualification_announced"].includes(c.lifecycle)) ||
            (filter === "past" && c.lifecycle === "offline_complete")
        );

  const filterTabs = [
    { key: "all", label: "All", count: allCount },
    { key: "upcoming", label: "Upcoming", count: upcomingCount },
    { key: "live", label: "Live", count: liveCount },
    { key: "past", label: "Past", count: pastCount },
  ];

  return (
    <div className="page-wrap">
      <header className="page-header">
        <div>
          <p className="kicker">Online qualifier → campus final</p>
          <h1>Two rounds. One final room.</h1>
          <p>
            Start remotely in the open assessment. Finish on campus if your verified rank lands inside
            the Top 30.
          </p>
        </div>
        <div className="hub-stat">
          <strong>30</strong>
          <span>FINALIST SEATS</span>
        </div>
      </header>

      <Tabs value={filter || "all"} onValueChange={(val) => void navigate({ search: { filter: val, state } })} className="mb-6">
        <TabsList className="bg-[var(--surface-2)] border border-[var(--line)] p-1 rounded-[1px] h-auto flex-wrap">
          {filterTabs.map((tab) => (
            <TabsTrigger
              key={tab.key}
              value={tab.key}
              className="font-mono text-xs uppercase font-bold data-[state=active]:bg-[var(--accent)] data-[state=active]:text-black text-[var(--muted)]"
            >
              {tab.label} ({tab.count})
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <section>
        <SectionHeader kicker={`${shown.length} contests`} title="Contest calendar" />
        {shown.length === 0 ? (
          <EmptyState
            title="No contests in this view"
            body={
              filter === "live"
                ? "There are no live contests running, or active live finals are restricted strictly to qualified Top 30 finalists."
                : "Try another filter. New two-round contests will appear here when announced."
            }
          />
        ) : (
          shown.map((c) => (
            <article className="funnel-contest" key={c.slug}>
              <div className="contest-card-main">
                <div className="contest-card-top">
                  <LifecycleBadge lifecycle={c.lifecycle} />
                  <span className="mono-tag">{c.season}</span>
                  {c.lifecycle === "assessment_live" && (
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase text-emerald-400 bg-emerald-950/80 px-2 py-0.5 border border-emerald-500/40">
                      Top 30 Finalist Access
                    </span>
                  )}
                </div>
                <h2>{c.title}</h2>
                <p>{c.summary}</p>
                <TwoStageIndicator stages={c.stages} compact />
                <div className="event-facts">
                  <span>
                    <CalendarDays />
                    Registration closes{" "}
                    {new Date(c.registration_closes_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                  <span>
                    <Users />
                    {c.registered_count} registered
                  </span>
                </div>
              </div>
              <Link
                className="contest-card-open"
                to="/portal/contests/$contestSlug"
                params={{ contestSlug: c.slug }}
                search={{ state: "default" }}
                aria-label={`Open ${c.title}`}
              >
                <ArrowRight />
              </Link>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
