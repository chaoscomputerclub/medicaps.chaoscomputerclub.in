import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getApiBase, getToken } from "@/lib/auth";
import { RotateCcw } from "lucide-react";
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
  const queryClient = useQueryClient();
  const { data: c } = useSuspenseQuery(contestSystemQueries.contest(contestSlug));

  const [active, setActive] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [now, setNow] = useState<number>(() => Date.now());
  const [isResettingTimer, setIsResettingTimer] = useState(false);

  if (!c) return null;

  const startsAtMs = new Date(c.stages[0]?.starts_at || c.registration_closes_at).getTime();
  const endsAtMs = new Date(c.stages[0]?.ends_at || c.results_at).getTime();
  const unlockAtMs = startsAtMs - 24 * 60 * 60 * 1000;

  const isLocked = now < unlockAtMs;
  const isConcluded = now > endsAtMs;
  const isCountdownActive = now < startsAtMs;

  useEffect(() => {
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (startsAtMs && current >= startsAtMs && (state === "waiting" || state === "default")) {
        navigate({ to: "/assessments/$contestSlug", params: { contestSlug } });
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [startsAtMs, state, contestSlug, navigate]);

  const handleResetTimer = async () => {
    try {
      setIsResettingTimer(true);
      const apiBase = getApiBase();
      const token = getToken();
      const res = await fetch(`${apiBase}/contests/${contestSlug}/reset-timer?seconds=10`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        toast.success("10-second assessment countdown timer started!");
        const data = await res.json();
        if (c.stages && c.stages[0]) {
          c.stages[0].starts_at = data.starts_at;
        }
        c.registration_closes_at = data.starts_at;
        await queryClient.invalidateQueries({ queryKey: ["contest-system"] });
        setNow(Date.now());
      }
    } catch {
      toast.error("Failed to reset timer.");
    } finally {
      setIsResettingTimer(false);
    }
  };

  // Strict 24h Unlock Gate or Waiting Room
  if (isLocked || isCountdownActive || state === "waiting") {
    const remainingSeconds = Math.max(0, Math.ceil((startsAtMs - now) / 1000));
    return (
      <div className="page-wrap narrow">
        <StatePanel
          icon={<Lock className="w-8 h-8 text-[var(--accent)]" />}
          kicker="Phase 1 · Online Screening Assessment"
          title={isLocked ? "Assessment is Locked" : isCountdownActive ? "Assessment Waiting Room" : "Assessment is Live"}
        >
          <p>
            {isLocked
              ? "The Phase 1 Online Screening Assessment unlocks strictly 24 hours prior to the contest live start window. Questions and coding challenges remain cryptographically sealed until then."
              : isCountdownActive
              ? "Your workstation telemetry is synchronized. The online screening test will unlock automatically when the countdown expires."
              : "The assessment window is currently open and active. Proceed to your proctored coding workspace."}
          </p>

          {isCountdownActive ? (
            <div className="my-6 p-6 rounded-lg bg-[var(--surface-2)] border border-amber-500/40 text-center shadow-[0_0_25px_rgba(251,191,36,0.15)]">
              <p className="font-mono text-xs uppercase tracking-widest text-amber-400 font-bold mb-1">
                ⚡ ONLINE ASSESSMENT COMMENCES IN
              </p>
              <div className="font-mono text-6xl font-black text-amber-300 tracking-wider animate-pulse">
                00:00:{String(remainingSeconds).padStart(2, "0")}
              </div>
              <p className="font-mono text-[11px] text-[var(--muted)] mt-2">
                Workstation telemetry ready. Terminal will unlock automatically.
              </p>
              <div className="mt-4 flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetTimer}
                  disabled={isResettingTimer}
                  className="font-mono text-xs border-[var(--line)] hover:border-amber-400 text-amber-300"
                >
                  <RotateCcw className={`w-3.5 h-3.5 mr-1.5 ${isResettingTimer ? "animate-spin" : ""}`} />
                  Restart 10s Timer
                </Button>
              </div>
            </div>
          ) : (
            <div className="my-6 p-6 rounded-lg bg-emerald-950/40 border border-emerald-500/50 text-center shadow-[0_0_30px_rgba(16,185,129,0.2)]">
              <p className="font-mono text-xs uppercase tracking-widest text-emerald-400 font-bold mb-1">
                ⚡ ASSESSMENT TERMINAL UNLOCKED
              </p>
              <div className="font-mono text-xl font-black text-white tracking-wider my-2">
                TERMINAL ACCESS GRANTED
              </div>
              <p className="font-mono text-xs text-[var(--muted)] mb-4">
                The 10-second countdown has completed. You can now launch into the proctored IDE.
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <Button asChild className="bg-emerald-400 text-black hover:bg-emerald-300 font-mono font-bold text-xs uppercase tracking-wider px-6 py-2 shadow-lg">
                  <Link to="/assessments/$contestSlug" params={{ contestSlug }}>
                    Launch Proctored Workspace →
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetTimer}
                  disabled={isResettingTimer}
                  className="font-mono text-xs border-[var(--line)] hover:border-amber-400 text-amber-300"
                >
                  <RotateCcw className={`w-3.5 h-3.5 mr-1.5 ${isResettingTimer ? "animate-spin" : ""}`} />
                  Restart 10s Timer
                </Button>
              </div>
            </div>
          )}

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
            <Button className="bg-[var(--accent)] text-black hover:brightness-110 hover:text-black font-bold">
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
                className="bg-[var(--accent)] text-black hover:brightness-110 hover:text-black font-bold"
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
              className="bg-[var(--accent)] text-black hover:brightness-110 hover:text-black font-bold"
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
