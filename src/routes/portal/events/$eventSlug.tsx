/**
 * Chaos Computer Club India — Medi-Caps Chapter
 * medicaps.chaoscomputerclub.in
 *
 * Copyright (c) 2026 Chaos Computer Club India
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 */

import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import {
  DetailSkeleton,
  ErrorState,
  Panel,
  PanelHeader,
  RouteFade,
  RsvpBadge,
  TagList,
  formatDateTime,
} from "@/organization/components/ui";
import { Button } from "@/components/ui/button";
import { setRsvp } from "@/organization/data/api";
import { useDataMode } from "@/organization/data/data-mode";
import { portalQueries } from "@/organization/data/queries";

export const Route = createFileRoute("/portal/events/$eventSlug")({
  head: () => ({
    meta: [
      { title: "Event — CCC Member Portal" },
      { name: "description", content: "Event details, schedule and registration." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EventDetailPage,
});

function EventDetailPage() {
  const { eventSlug } = Route.useParams();
  const { mode } = useDataMode();
  const qc = useQueryClient();
  const { data, isPending, isError, refetch } = useQuery(portalQueries.event(mode, eventSlug));

  const rsvp = useMutation({
    mutationFn: (next: "confirmed" | "none") => setRsvp(mode, eventSlug, next),
    onSuccess: (updated) => {
      qc.setQueryData(portalQueries.event(mode, eventSlug).queryKey, updated);
      void qc.invalidateQueries({ queryKey: ["portal", mode, "events"] });
      toast(
        updated.rsvp_status === "confirmed"
          ? `You're registered for ${updated.title}`
          : `Registration withdrawn for ${updated.title}`,
      );
    },
    onError: () => toast.error("That didn't go through. Try again."),
  });

  return (
    <RouteFade>
      <Link
        to="/portal/events"
        className="inline-flex items-center gap-1.5 font-mono text-[0.625rem] tracking-[0.16em] text-muted-foreground uppercase transition-colors duration-150 ease-editorial hover:text-accent"
      >
        <ArrowLeft className="size-3" aria-hidden /> Events
      </Link>

      <div className="mt-5">
        {isPending ? (
          <DetailSkeleton />
        ) : isError ? (
          <ErrorState message="This event couldn't be loaded." onRetry={() => void refetch()} />
        ) : !data ? (
          <ErrorState message="No event exists at this address. It may have been withdrawn." />
        ) : (
          <article className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <div className="min-w-0">
              <p className="font-mono text-[0.625rem] tracking-[0.18em] text-subtle-foreground uppercase">
                {data.kind} · {data.mode}
              </p>
              <h1 className="mt-2 font-display text-3xl tracking-tight text-foreground">
                {data.title}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {data.summary}
              </p>
              <p className="mt-6 max-w-2xl text-[0.9375rem] leading-relaxed text-foreground/90">
                {data.description}
              </p>
              <div className="mt-6">
                <TagList tags={data.tags} />
              </div>
            </div>

            <aside className="space-y-4">
              <Panel>
                <PanelHeader
                  title="Registration"
                  aside={<RsvpBadge status={data.rsvp_status} state={data.state} />}
                />
                <dl className="divide-y divide-border">
                  <Row label="Starts" value={formatDateTime(data.starts_at)} />
                  <Row label="Ends" value={formatDateTime(data.ends_at)} />
                  <Row
                    label={data.mode === "online" ? "Link" : "Location"}
                    value={
                      data.mode === "online"
                        ? (data.join_url ?? "Shared before start")
                        : (data.location ?? "To be announced")
                    }
                  />
                  <Row
                    label="Seats"
                    value={
                      data.capacity
                        ? `${data.registered_count} of ${data.capacity}`
                        : `${data.registered_count} registered`
                    }
                  />
                </dl>
                <div className="border-t border-border p-4">
                  {data.state === "past" ? (
                    <p className="text-xs text-muted-foreground">
                      This event has finished.{" "}
                      {data.rsvp_status === "confirmed"
                        ? "It counts toward your events attended."
                        : "You weren't registered for it."}
                    </p>
                  ) : data.state === "closed" && data.rsvp_status !== "confirmed" ? (
                    <p className="text-xs text-muted-foreground">
                      Capacity reached.{" "}
                      {data.rsvp_status === "waitlisted"
                        ? "You're on the waitlist — you'll be told if a seat frees up."
                        : "Registration is closed."}
                    </p>
                  ) : data.rsvp_status === "confirmed" ? (
                    <Button
                      variant="outline"
                      className="w-full rounded-none font-mono text-[0.625rem] tracking-[0.16em] uppercase"
                      disabled={rsvp.isPending}
                      onClick={() => rsvp.mutate("none")}
                    >
                      {rsvp.isPending ? "Working…" : "Withdraw registration"}
                    </Button>
                  ) : (
                    <Button
                      className="w-full rounded-none bg-accent font-mono text-[0.625rem] tracking-[0.16em] text-accent-foreground uppercase hover:bg-accent/90"
                      disabled={rsvp.isPending}
                      onClick={() => rsvp.mutate("confirmed")}
                    >
                      {rsvp.isPending ? "Working…" : "Register"}
                    </Button>
                  )}
                </div>
              </Panel>
            </aside>
          </article>
        )}
      </div>
    </RouteFade>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3 px-4 py-3">
      <dt className="font-mono text-[0.625rem] tracking-[0.16em] text-subtle-foreground uppercase">
        {label}
      </dt>
      <dd className="min-w-0 font-mono text-[0.6875rem] tabular-nums break-words text-foreground">
        {value}
      </dd>
    </div>
  );
}
