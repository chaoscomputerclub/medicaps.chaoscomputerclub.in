import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Flag,
  Hourglass,
  Lock,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { StatePanel } from "@/organization/components/ContestSystemUI";
import { AssessmentTimeWatch } from "@/organization/components/AssessmentTimeWatch";
import { contestSystemQueries } from "@/organization/data/contest-queries";
import { reviewState } from "@/organization/data/contest-system";

export const Route = createFileRoute("/portal/contests/$contestSlug/assessment")({
  validateSearch: (s: Record<string, unknown>) => ({ state: reviewState(s["state"]) }),
  loader: async ({ context, params }) => {
    const c = await context.queryClient.ensureQueryData(
      contestSystemQueries.contest(params.contestSlug)
    );
    if (!c) throw notFound();
    return c;
  },
  head: () => ({
    meta: [
      { title: "Online Assessment — CCC Medi-Caps" },
      { name: "description", content: "Complete Round 1 of the CCC Medi-Caps two-stage contest." },
      { property: "og:title", content: "Online Assessment — CCC Medi-Caps" },
      { property: "og:description", content: "Timed Round 1 assessment workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Assessment,
});

function Assessment() {
  const { contestSlug } = Route.useParams();
  const { state } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { data: c } = useSuspenseQuery(contestSystemQueries.contest(contestSlug));

  const [active, setActive] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!c) return null;

  const startsAtMs = new Date(c.stages[0]?.starts_at || c.registration_closes_at).getTime();
  const endsAtMs = new Date(c.stages[0]?.ends_at || c.results_at).getTime();
  const unlockAtMs = startsAtMs - 24 * 60 * 60 * 1000;

  const isLocked = now < unlockAtMs;
  const isConcluded = now > endsAtMs;

  // Strict 24h Unlock Gate
  if (isLocked || state === "waiting" || state === "default") {
    return (
      <div className="page-wrap narrow">
        <StatePanel
          icon={<Lock className="w-8 h-8 text-[var(--accent)]" />}
          kicker="Phase 1 · Online Screening Assessment"
          title={isLocked ? "Assessment is Locked" : "Waiting Room"}
        >
          <p>
            {isLocked
              ? "The Phase 1 Online Screening Assessment unlocks strictly 24 hours prior to the contest live start window. Questions and coding challenges remain cryptographically sealed until then."
              : "Your registration is confirmed. Keep this window open; you may begin as soon as the live screening window opens."}
          </p>

          <div style={{ maxWidth: "480px", margin: "24px auto 16px" }}>
            <AssessmentTimeWatch
              startsAt={c.stages[0]?.starts_at || c.registration_closes_at}
              endsAt={c.stages[0]?.ends_at || c.results_at}
            />
          </div>

          <div className="button-row" style={{ justifyContent: "center", marginTop: "24px" }}>
            <Button variant="outline" asChild>
              <Link
                to="/portal/contests/$contestSlug"
                params={{ contestSlug }}
                search={{ state: "default" }}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Return to Contest Brief
              </Link>
            </Button>
          </div>
        </StatePanel>
      </div>
    );
  }

  if (isConcluded) {
    return (
      <div className="page-wrap narrow">
        <StatePanel
          icon={<AlertTriangle className="w-8 h-8 text-[var(--warning)]" />}
          kicker="Phase 1 · Concluded"
          title="Assessment Window Closed"
        >
          <p>The assessment period for this contest has concluded. Submissions are closed.</p>
          <Button variant="outline" asChild style={{ marginTop: "20px" }}>
            <Link
              to="/portal/contests/$contestSlug"
              params={{ contestSlug }}
              search={{ state: "default" }}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Return to Contest Brief
            </Link>
          </Button>
        </StatePanel>
      </div>
    );
  }

  if (state === "submitted") {
    return (
      <div className="page-wrap narrow">
        <StatePanel
          icon={<CheckCircle2 className="w-8 h-8 text-[var(--accent)]" />}
          kicker="Phase 1 · Submitted"
          title="Assessment Received"
        >
          <p>
            Your final response set was submitted. Results remain sealed until integrity checks and
            scoring telemetry reconcile. Top 30 qualified contestants advance to Round 2.
          </p>
          <Button variant="outline" asChild style={{ marginTop: "20px" }}>
            <Link
              to="/portal/contests/$contestSlug"
              params={{ contestSlug }}
              search={{ state: "default" }}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Return to Contest Brief
            </Link>
          </Button>
        </StatePanel>
      </div>
    );
  }

  const p = c.assessment.problems[active] ?? c.assessment.problems[0];
  if (!p) return null;

  return (
    <div className="assessment-shell">
      <header className="assessment-bar">
        <Link
          to="/portal/contests/$contestSlug"
          params={{ contestSlug }}
          search={{ state: "default" }}
          aria-label="Return to contest"
        >
          <ArrowLeft />
        </Link>
        <div>
          <p className="kicker">Round 1 · Online assessment</p>
          <strong>{c.title}</strong>
        </div>
        <div className="assessment-clock">
          <Clock3 />
          <span>00:54:07</span>
          <small>REMAINING</small>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button className="bg-[var(--accent)] text-black hover:bg-[var(--accent-ink)] font-bold">
              <Send className="w-4 h-4 mr-1.5" />
              Finish assessment
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Submit your final responses?</DialogTitle>
              <DialogDescription>
                You can review unanswered and flagged problems before submitting. Once submitted, this
                assessment cannot be reopened.
              </DialogDescription>
            </DialogHeader>
            <div className="submission-check">
              <span>
                Answered{" "}
                <strong>
                  {Object.keys(answers).length}/{c.assessment.problems.length}
                </strong>
              </span>
              <span>Flagged <strong>0</strong></span>
            </div>
            <DialogFooter>
              <Button variant="outline">Keep reviewing</Button>
              <Button
                onClick={() => void navigate({ search: { state: "submitted" } })}
                className="bg-[var(--accent)] text-black hover:bg-[var(--accent-ink)] font-bold"
              >
                Submit assessment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <div className="assessment-progress">
        <span
          style={{
            width: `${(Object.keys(answers).length / Math.max(1, c.assessment.problems.length)) * 100}%`,
          }}
        />
      </div>

      <main className="assessment-workspace">
        <aside className="assessment-nav">
          <div>
            <strong>Problem set</strong>
            <span>
              {Object.keys(answers).length} of {c.assessment.problems.length} answered
            </span>
          </div>
          {c.assessment.problems.map((x, i) => (
            <Button
              key={x.id}
              variant="ghost"
              className={cn(
                i === active && "active",
                answers[x.id] !== undefined && "answered"
              )}
              onClick={() => setActive(i)}
            >
              <span>{x.index}</span>
              <div>
                <strong>{x.title}</strong>
                <small>{x.points} points</small>
              </div>
              {x.status === "flagged" && <Flag />}
            </Button>
          ))}
        </aside>

        <section className="assessment-question">
          <div className="question-meta">
            <span>
              Problem {p.index} of {c.assessment.problems.length}
            </span>
            <span>{p.category}</span>
            <strong>{p.points} points</strong>
          </div>
          <h1>{p.title}</h1>
          <p>{p.prompt}</p>

          <fieldset>
            <legend>Select one answer</legend>
            {p.options.map((x, i) => (
              <label className={answers[p.id] === i ? "selected" : ""} key={x}>
                <input
                  type="radio"
                  name={p.id}
                  checked={answers[p.id] === i}
                  onChange={() => setAnswers((a) => ({ ...a, [p.id]: i }))}
                />
                <span>{String.fromCharCode(65 + i)}</span>
                <strong>{x}</strong>
              </label>
            ))}
          </fieldset>

          <div className="assessment-actions">
            <Button variant="outline">
              <Flag className="w-3.5 h-3.5 mr-1.5" />
              Flag for review
            </Button>
            <Button
              onClick={() => setActive(Math.min(active + 1, c.assessment.problems.length - 1))}
              className="bg-[var(--accent)] text-black hover:bg-[var(--accent-ink)] font-bold"
            >
              Save and continue
            </Button>
          </div>
        </section>

        <aside className="assessment-rules">
          <AlertTriangle />
          <strong>Assessment integrity</strong>
          <p>
            Your timer continues if you leave this page. Submit before exiting the assessment.
          </p>
          <dl>
            <div>
              <dt>Autosave</dt>
              <dd>On</dd>
            </div>
            <div>
              <dt>Last saved</dt>
              <dd>Just now</dd>
            </div>
          </dl>
        </aside>
      </main>
    </div>
  );
}
