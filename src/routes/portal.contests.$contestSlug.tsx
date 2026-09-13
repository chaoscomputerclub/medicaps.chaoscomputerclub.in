import { ContestDetailSkeleton } from "@/organization/components/skeletons";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Loader2,
  MapPin,
  MonitorCog,
  ShieldCheck,
  Terminal,
  Trophy,
  Users,
} from "lucide-react";
import { getContestRegistrationStatus, registerForContest, getToken } from "@/lib/auth";
import { ScoreboardMatrix } from "@/organization/components/ScoreboardMatrix";
import { Button } from "@/components/ui/button";
import { SectionHeader, StatusDot, formatContestDate } from "@/organization/components/ui";
import { portalQueries } from "@/organization/data/queries";
export const Route = createFileRoute("/portal/contests/$contestSlug")({
  loader: async ({ context, params }) => {
    const contest = await context.queryClient.ensureQueryData(
      portalQueries.contest(params.contestSlug),
    );
    if (!contest) throw notFound();
    return contest;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.title} — CCC Medi-Caps` : "Contest unavailable" },
      { name: "description", content: loaderData?.summary ?? "Contest record unavailable." },
      { property: "og:title", content: loaderData?.title ?? "Contest unavailable" },
      { property: "og:description", content: loaderData?.summary ?? "Contest record unavailable." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  notFoundComponent: () => (
    <div className="page-wrap">
      <h1>Contest record not found.</h1>
    </div>
  ),
  pendingComponent: ContestDetailSkeleton,
  component: ContestDetail,
});
function ContestDetail() {
  const { contestSlug } = Route.useParams();
  const queryClient = useQueryClient();
  const { data: c } = useSuspenseQuery(portalQueries.contest(contestSlug));

  const [isRegistered, setIsRegistered] = useState(false);
  const [isCheckingReg, setIsCheckingReg] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setIsCheckingReg(false);
      return;
    }
    let cancelled = false;
    getContestRegistrationStatus(contestSlug)
      .then((res) => {
        if (!cancelled) {
          setIsRegistered(res.registered);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsCheckingReg(false);
      });
    return () => {
      cancelled = true;
    };
  }, [contestSlug]);

  async function handleRegister() {
    setIsRegistering(true);
    try {
      const res = await registerForContest(contestSlug);
      setIsRegistered(true);
      toast.success(res.message || "Registration confirmed! Workstation reserved.");
      queryClient.invalidateQueries({ queryKey: ["portal", "public-records"] });
    } catch (err: any) {
      toast.error(err?.message || "Failed to register for contest. Please ensure you are logged in.");
    } finally {
      setIsRegistering(false);
    }
  }

  if (!c) return null;
  return (
    <div className="page-wrap">
      <Link to="/portal/contests" search={{ status: "all" }} className="back-link">
        <ArrowLeft /> All contests
      </Link>
      <header className="contest-hero">
        <div>
          <StatusDot status={c.status} />
          <p className="kicker">
            {c.season} · {c.division.replace("_", " ")}
          </p>
          <h1>{c.title}</h1>
          <p>{c.summary}</p>
        </div>
        <dl>
          <div>
            <dt>
              <Clock3 /> Contest window
            </dt>
            <dd>
              {formatContestDate(c.starts_at)}
              <br />
              {formatContestDate(c.ends_at)}
            </dd>
          </div>
          <div>
            <dt>
              <MapPin /> Venue
            </dt>
            <dd>{c.venue}</dd>
          </div>
          <div>
            <dt>
              <Users /> Capacity
            </dt>
            <dd>
              {c.registered_count} / {c.seat_capacity} registered
            </dd>
          </div>
          <div>
            <dt>
              <MonitorCog /> Runtime
            </dt>
            <dd>{c.environment}</dd>
          </div>
        </dl>
      </header>
      <div className="registration-band">
        <div>
          {isRegistered ? (
            <>
              <strong className="text-accent flex items-center gap-1.5">
                <CheckCircle2 size={16} /> Registration Confirmed · Assessment Unlocked
              </strong>
              <span>
                Your workstation seat is reserved. Enter the online screening studio to qualify among the Top 30.
              </span>
            </>
          ) : (
            <>
              <strong>Phase 1 Online Screening Assessment Active</strong>
              <span>
                Register for this offline campus challenge to unlock your screening round and workstation allocation.
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isRegistered ? (
            <Button
              asChild
              className="bg-accent text-accent-foreground hover:bg-accent/90 font-mono text-xs shadow-[0_0_15px_rgba(200,255,54,0.3)]"
            >
              <Link to="/portal/assessments/$contestSlug" params={{ contestSlug: c.slug }}>
                <Terminal size={14} className="mr-1.5" /> ENTER ASSESSMENT STUDIO →
              </Link>
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleRegister}
              disabled={isRegistering || isCheckingReg}
              className="bg-accent text-accent-foreground hover:bg-accent/90 font-mono text-xs cursor-pointer"
            >
              {isRegistering ? (
                <Loader2 className="spin size-3.5 mr-1.5" />
              ) : (
                <Users size={14} className="mr-1.5" />
              )}
              REGISTER FOR CONTEST & ASSESSMENT
            </Button>
          )}
          <Button variant="outline" asChild className="font-mono text-xs border-[#333]">
            <Link
              to="/portal/assessments/$contestSlug/leaderboard"
              params={{ contestSlug: c.slug }}
            >
              <Trophy size={14} className="mr-1.5" /> SCREENING STANDINGS
            </Link>
          </Button>
        </div>
      </div>
      <section className="panel">
        <SectionHeader kicker="Sealed set" title={`${c.problem_count} contest problems`} />
        <div className="problem-list">
          {c.problems.map((p) => (
            <article key={p.index}>
              <span>{p.index}</span>
              <div>
                <h3>{p.title}</h3>
                <p>{p.topic}</p>
              </div>
              <strong>{p.points}</strong>
              <small>{c.status === "finished" ? `${p.solved_count} solves` : "SEALED"}</small>
            </article>
          ))}
        </div>
      </section>
      {c.standings.length > 0 && (
        <section className="panel standings-panel">
          <SectionHeader kicker="Verified scoreboard" title="Official standings" />
          <ScoreboardMatrix entries={c.standings} problems={c.problems} />
        </section>
      )}
      <section className="contest-lower">
        <div className="panel">
          <SectionHeader kicker="Room protocol" title="Contest rules" />
          <ol className="rule-list">
            {c.rules.map((r, i) => (
              <li key={r}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                {r}
              </li>
            ))}
          </ol>
        </div>
        <div className="panel">
          <SectionHeader kicker="Trust chain" title="Proctor authority" />
          <div className="proctor-list">
            {c.chief_proctors.map((x) => (
              <p key={x}>
                <ShieldCheck />
                {x}
              </p>
            ))}
          </div>
          <p className="micro-copy">
            Final scoreboards are signed only after submission, seat, attendance, and incident logs
            reconcile.
          </p>
        </div>
      </section>
    </div>
  );
}
