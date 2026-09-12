import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  EmptyState,
  ErrorState,
  PageHeader,
  Panel,
  RouteFade,
  RowSkeletons,
  RsvpBadge,
  StaggerItem,
  TagList,
  formatDateTime,
} from "@/organization/components/ui";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDataMode } from "@/organization/data/data-mode";
import { portalQueries } from "@/organization/data/queries";
import type { ClubEvent } from "@/organization/data/types";

export const Route = createFileRoute("/portal/events/")({
  head: () => ({
    meta: [
      { title: "Events — CCC Member Portal" },
      {
        name: "description",
        content:
          "Hackathons, contests and meetups you can register for, plus what you've attended.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EventsPage,
});

function EventsPage() {
  const { mode } = useDataMode();
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const { data, isPending, isError, refetch } = useQuery(portalQueries.events(mode));

  const list = (data ?? [])
    .filter((e) => (tab === "past" ? e.state === "past" : e.state !== "past"))
    .sort((a, b) =>
      tab === "past"
        ? b.starts_at.localeCompare(a.starts_at)
        : a.starts_at.localeCompare(b.starts_at),
    );

  return (
    <RouteFade>
      <PageHeader
        title="Events"
        description="Hackathons run under a constraint sheet, contests that are rated, and meetups where you read source out loud."
      />

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as "upcoming" | "past")}
        className="mt-6 gap-4"
      >
        <TabsList className="rounded-none bg-surface p-0.5">
          <TabsTrigger
            value="upcoming"
            className="rounded-none font-mono text-[0.625rem] tracking-[0.16em] uppercase"
          >
            Upcoming
          </TabsTrigger>
          <TabsTrigger
            value="past"
            className="rounded-none font-mono text-[0.625rem] tracking-[0.16em] uppercase"
          >
            Past
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <section className="mt-4">
        {isPending ? (
          <RowSkeletons count={4} />
        ) : isError ? (
          <ErrorState message="The event list couldn't be loaded." onRetry={() => void refetch()} />
        ) : list.length === 0 ? (
          <EmptyState
            title={tab === "past" ? "No past events yet" : "Nothing scheduled"}
            description={
              tab === "past"
                ? "Once you attend something it stays here, including the ones that went badly."
                : "The next hackathon and contest haven't been announced. They usually go up two weeks ahead."
            }
          />
        ) : (
          <ul className="space-y-3">
            {list.map((e, i) => (
              <li key={e.id}>
                <StaggerItem index={i}>
                  <EventRow event={e} />
                </StaggerItem>
              </li>
            ))}
          </ul>
        )}
      </section>
    </RouteFade>
  );
}

function EventRow({ event }: { event: ClubEvent }) {
  return (
    <Panel className="hover:border-border-strong">
      <Link
        to="/portal/events/$eventSlug"
        params={{ eventSlug: event.slug }}
        className="block px-4 py-4 transition-colors duration-150 ease-editorial hover:bg-surface-raised"
      >
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
          <div className="min-w-0">
            <p className="font-mono text-[0.625rem] tracking-[0.16em] text-subtle-foreground uppercase">
              {event.kind} · {event.mode}
            </p>
            <h3 className="mt-1.5 truncate font-display text-lg text-foreground">{event.title}</h3>
            <p className="mt-1.5 max-w-2xl text-[0.8125rem] leading-relaxed text-muted-foreground">
              {event.summary}
            </p>
            <div className="mt-3">
              <TagList tags={event.tags} />
            </div>
          </div>
          <div className="flex flex-row items-center gap-3 sm:flex-col sm:items-end">
            <RsvpBadge status={event.rsvp_status} state={event.state} />
            <p className="font-mono text-[0.6875rem] tabular-nums text-muted-foreground">
              {formatDateTime(event.starts_at)}
            </p>
            <p className="font-mono text-[0.625rem] tabular-nums text-subtle-foreground">
              {event.capacity
                ? `${event.registered_count}/${event.capacity} seats`
                : `${event.registered_count} registered`}
            </p>
          </div>
        </div>
      </Link>
    </Panel>
  );
}
