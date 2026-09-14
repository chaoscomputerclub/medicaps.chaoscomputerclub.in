import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, ArrowRight, CheckCircle2, Lock, MapPin, QrCode, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { contestQueries } from "@/features/contest/queries";
import { FINALIST_SEATS, formatWhen } from "@/features/contest/lifecycle";

export const Route = createFileRoute("/portal/contests/$contestSlug/qualified")({
  validateSearch: (search: Record<string, unknown>): { state?: string } => ({
    state: search["state"] ? String(search["state"]) : "default",
  }),
  head: () => ({
    meta: [
      { title: "Qualification & Campus Pass — CCC Medi-Caps" },
      {
        name: "description",
        content: "Check your Top 30 qualification status and collect the QR campus pass for the offline final.",
      },
      { property: "og:title", content: "Qualification & Campus Pass — CCC Medi-Caps" },
      { property: "og:description", content: "Top 30 finalists receive a QR pass for campus entry." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(contestQueries.detail(params.contestSlug)),
  component: QualificationPage,
});

function QualificationPage() {
  const { contestSlug } = Route.useParams();
  const { data: contest } = useSuspenseQuery(contestQueries.detail(contestSlug));
  const { data: registration, isLoading: registrationLoading } = useQuery(
    contestQueries.registration(contestSlug),
  );
  const { data: pass, isLoading: passLoading } = useQuery(contestQueries.pass());

  const qualified = Boolean(registration?.is_top_30_qualified || registration?.can_enter_live_contest);
  const rank = registration?.assessment_rank ?? null;

  return (
    <div className="page-wrap space-y-6">
      <Link to="/portal/contests/$contestSlug" params={{ contestSlug }} search={{ state: "default" }} className="back-link">
        <ArrowLeft />
        Back to contest
      </Link>

      <header className="space-y-2">
        <p className="kicker">Round 2 · Offline campus final</p>
        <h1 className="text-2xl font-black uppercase tracking-tight text-white">Qualification status</h1>
        <p className="max-w-2xl text-sm text-[var(--muted)]">
          The top {FINALIST_SEATS} verified Round 1 scores advance to {contest.title} at {contest.venue}.
        </p>
      </header>

      {registrationLoading ? (
        <Skeleton className="h-28 w-full rounded-none bg-[var(--surface-2)]" />
      ) : qualified ? (
        <Card className="rounded-none border-[var(--accent)]/60 bg-[var(--surface-1)]">
          <CardHeader className="flex-row items-center gap-4">
            <Trophy className="size-6 text-[var(--accent)]" />
            <div>
              <CardTitle className="text-lg font-black uppercase tracking-tight text-white">
                You are through to the final
              </CardTitle>
              <p className="font-mono text-xs text-[var(--muted)]">
                {rank ? `Round 1 rank #${rank}` : "Round 1 verified"} ·{" "}
                {registration?.assessment_score ?? 0} points
              </p>
            </div>
            <Badge variant="outline" className="ml-auto rounded-none border-[var(--accent)] font-mono text-[10px] uppercase text-[var(--accent)]">
              Finalist
            </Badge>
          </CardHeader>
        </Card>
      ) : (
        <Card className="rounded-none border-amber-500/40 bg-[var(--surface-1)]">
          <CardHeader className="flex-row items-center gap-4">
            <Lock className="size-6 text-amber-300" />
            <div>
              <CardTitle className="text-lg font-black uppercase tracking-tight text-white">
                Not qualified yet
              </CardTitle>
              <p className="max-w-xl text-xs leading-relaxed text-[var(--muted)]">
                {registration?.eligibility_message ??
                  `Only the top ${FINALIST_SEATS} Round 1 scores receive a campus pass. Your standing updates as verification completes.`}
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="rounded-none font-mono text-xs uppercase">
              <Link
                to="/portal/contests/$contestSlug/results"
                params={{ contestSlug }}
                search={{ state: "default", query: "", filter: "all", sort: "rank" }}
              >
                See the ranking
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <section className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <Card className="rounded-none border-[var(--line)] bg-[var(--surface-1)]">
          <CardHeader className="flex-row items-center gap-2">
            <QrCode className="size-4 text-[var(--accent)]" />
            <CardTitle className="text-sm font-bold uppercase tracking-wide text-white">
              Campus pass
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {passLoading ? (
              <Skeleton className="h-48 w-full rounded-none bg-[var(--surface-2)]" />
            ) : pass && qualified ? (
              <>
                <div className="flex justify-center bg-white p-4">
                  <QRCodeSVG value={pass.pass_code} size={168} level="H" />
                </div>
                <dl className="space-y-2 font-mono text-xs text-[var(--muted)]">
                  <Row label="Pass code" value={pass.pass_code} />
                  <Row label="Finalist" value={`${pass.member_name} · @${pass.handle}`} />
                  <Row label="Seat" value={pass.seat} />
                  <Row label="Check-in opens" value={formatWhen(pass.check_in_opens_at)} />
                  <Row label="Status" value={pass.status.replace("_", " ")} />
                </dl>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <Lock className="size-6 text-[var(--muted)]" />
                <strong className="text-sm text-white">Pass locked</strong>
                <p className="max-w-xs text-xs text-[var(--muted)]">
                  Your QR pass appears here the moment your Top {FINALIST_SEATS} placement is verified.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-none border-[var(--line)] bg-[var(--surface-1)]">
          <CardHeader className="flex-row items-center gap-2">
            <MapPin className="size-4 text-[var(--accent)]" />
            <CardTitle className="text-sm font-bold uppercase tracking-wide text-white">
              Final day logistics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="space-y-2 font-mono text-xs text-[var(--muted)]">
              <Row label="Venue" value={contest.venue} />
              <Row label="Contest starts" value={formatWhen(contest.starts_at)} />
              <Row label="Check-in opens" value={formatWhen(contest.check_in_opens_at)} />
              <Row label="Workstations" value={`${contest.seat_capacity} seats`} />
              <Row label="Environment" value={contest.environment || "Campus workstations"} />
            </dl>
            <Separator className="bg-[var(--line)]" />
            <ul className="space-y-2 text-xs text-[var(--muted)]">
              {[
                "Carry your physical university ID card.",
                "Show this QR pass at the entrance for check-in.",
                "Arrive before the check-in window closes; late entry is refused.",
                "No personal laptops, phones, or external storage inside the lab.",
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-[var(--accent)]" />
                  {item}
                </li>
              ))}
            </ul>
            {qualified && (
              <Button asChild className="rounded-none font-mono text-xs font-bold uppercase">
                <Link to="/portal/contests/$contestSlug/offline" params={{ contestSlug }} search={{ state: "default" }}>
                  Open final contest room
                  <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt>{label}</dt>
      <dd className="text-right text-white">{value}</dd>
    </div>
  );
}
