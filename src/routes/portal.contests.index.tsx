import { ContestsSkeleton } from "@/organization/components/skeletons";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, MapPin, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { portalQueries } from "@/organization/data/queries";
import { SectionHeader, StatusDot, formatContestDate } from "@/organization/components/ui";
const q = portalQueries.contests();
export const Route = createFileRoute("/portal/contests/")({
  validateSearch: (search: Record<string, unknown>): { status?: string } => ({
    status: ["live", "upcoming", "finished"].includes(String(search["status"]))
      ? String(search["status"])
      : "all",
  }),
  head: () => ({
    meta: [
      { title: "Offline Contests — CCC Medi-Caps" },
      {
        name: "description",
        content: "Browse live, upcoming, and completed proctored CCC Medi-Caps contests.",
      },
      { property: "og:title", content: "Offline Contests — CCC Medi-Caps" },
      {
        property: "og:description",
        content: "Campus contest calendar, room details, capacity and verified standings.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(q),
  pendingComponent: ContestsSkeleton,
  component: Contests,
});
function Contests() {
  const { data } = useSuspenseQuery(q);
  const { status: filter } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const shown = data.filter((c) => filter === "all" || c.status === filter);
  return (
    <div className="page-wrap">
      <header className="page-header">
        <div>
          <p className="kicker">Campus competition calendar</p>
          <h1>Offline contests.</h1>
          <p>Registration, room allocation, proctored execution, then a signed public record.</p>
        </div>
      </header>
      <div className="segmented">
        {["all", "live", "upcoming", "finished"].map((x) => (
          <Button
            key={x}
            variant={filter === x ? "default" : "ghost"}
            onClick={() => void navigate({ search: { status: x } })}
          >
            {x}
          </Button>
        ))}
      </div>
      <section className="contest-directory">
        <SectionHeader kicker={`${shown.length} operations`} title="Contest directory" />
        {shown.length === 0 ? (
          <div className="panel text-center py-12 text-sm text-[#777] font-mono">
            No offline contests scheduled yet. Announcements will appear here.
          </div>
        ) : (
          shown.map((c) => (
            <article className="contest-row" key={c.slug}>
              <div className="contest-date">
                <strong>{new Date(c.starts_at).getDate()}</strong>
                <span>
                  {new Date(c.starts_at)
                    .toLocaleDateString("en-IN", { month: "short" })
                    .toUpperCase()}
                </span>
              </div>
              <div className="contest-summary">
                <div>
                  <StatusDot status={c.status} />
                  <span className="mono-tag">{c.division.replace("_", " ")}</span>
                </div>
                <h2>{c.title}</h2>
                <p>{c.summary}</p>
                <div className="event-facts">
                  <span>
                    <MapPin size={13} />
                    {c.venue}
                  </span>
                  <span>
                    <Users size={13} />
                    {c.registered_count}/{c.seat_capacity}
                  </span>
                  <span>{formatContestDate(c.starts_at)}</span>
                </div>
              </div>
              <div className="contest-action">
                <strong>{c.problem_count}</strong>
                <span>PROBLEMS</span>
                <Link
                  to="/portal/contests/$contestSlug"
                  params={{ contestSlug: c.slug }}
                  aria-label={`Open ${c.title}`}
                >
                  <ArrowRight />
                </Link>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
