import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  Gift,
  Lock,
  Play,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/organization/components/ui";
import {
  LifecycleBadge,
  Timeline,
  TwoStageIndicator,
} from "@/organization/components/ContestSystemUI";
import { AssessmentTimeWatch } from "@/organization/components/AssessmentTimeWatch";
import { RegisterConfirmModal } from "@/organization/components/RegisterConfirmModal";
import { contestSystemQueries } from "@/organization/data/contest-queries";
import { reviewState } from "@/organization/data/contest-system";
import { getContestRegistrationStatus, getApiBase, getToken } from "@/lib/auth";
import { toast } from "sonner";
import { Clock, RotateCcw } from "lucide-react";

export const Route = createFileRoute("/portal/contests/$contestSlug/")({
  validateSearch: (s: Record<string, unknown>): { state?: ReturnType<typeof reviewState> | undefined } => ({
    state: s["state"] ? reviewState(s["state"]) : "default",
  }),
  loader: async ({ context, params }) => {
    const c = await context.queryClient.ensureQueryData(
      contestSystemQueries.contest(params.contestSlug)
    );
    if (!c) throw notFound();
    return c;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.title} — CCC Medi-Caps` : "Contest unavailable" },
      { name: "description", content: loaderData?.summary ?? "Contest unavailable." },
      { property: "og:title", content: loaderData?.title ?? "Contest unavailable" },
      { property: "og:description", content: loaderData?.summary ?? "Contest unavailable." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ContestDetail,
});

function ContestDetail() {
  const { contestSlug } = Route.useParams();
  const { data: c } = useSuspenseQuery(contestSystemQueries.contest(contestSlug));
  if (!c) return null;

  const [registrationStatus, setRegistrationStatus] = useState<any>(null);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    let mounted = true;
    getContestRegistrationStatus(contestSlug)
      .then((res) => {
        if (mounted) setRegistrationStatus(res);
      })
      .catch(() => {});

    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [contestSlug]);

  const [isResettingTimer, setIsResettingTimer] = useState(false);
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
        setNow(Date.now());
      }
    } catch {
      toast.error("Failed to reset timer.");
    } finally {
      setIsResettingTimer(false);
    }
  };

  const isRegistered = Boolean(registrationStatus?.registered || c.registered);

  const startsAtMs = new Date(c.stages[0]?.starts_at || c.registration_closes_at).getTime();
  const endsAtMs = new Date(c.stages[0]?.ends_at || c.results_at).getTime();
  const unlockAtMs = startsAtMs - 24 * 60 * 60 * 1000;

  const isLocked = now < unlockAtMs;
  const isUnlocked = now >= unlockAtMs && now <= endsAtMs;
  const isConcluded = now > endsAtMs;

  const isUpcoming = c.lifecycle === "registration_open";
  const hasResults =
    !isUpcoming &&
    (c.lifecycle === "results_pending" ||
      c.lifecycle === "qualification_announced" ||
      c.lifecycle === "offline_complete" ||
      (Boolean(c.results_at) && new Date(c.results_at).getTime() <= now));

  const handleRegisteredSuccess = () => {
    setRegistrationStatus({ registered: true, contest_slug: contestSlug });
    c.registered = true;
    c.registered_count += 1;
  };

  const isLive = c.lifecycle === "assessment_live" || (c as any).status === "live";
  const isEligibleForLive = Boolean(
    registrationStatus?.can_enter_live_contest ||
    registrationStatus?.is_top_30_qualified ||
    (registrationStatus?.assessment_rank && registrationStatus.assessment_rank <= 30)
  );

  if (isLive && registrationStatus && !isEligibleForLive) {
    return (
      <div className="page-wrap">
        <Link
          to="/portal/contests"
          search={{ filter: "all", state: "default" }}
          className="back-link"
        >
          <ArrowLeft />
          All contests
        </Link>
        <div className="panel border border-amber-500/30 bg-amber-950/20 p-8 sm:p-12 text-center rounded-lg mt-6">
          <Lock className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <span className="mono-tag text-amber-300 border-amber-500/40 bg-amber-950/60 uppercase">
            Top 30 Qualifiers Only
          </span>
          <h1 className="text-xl sm:text-2xl font-black text-white mt-3 uppercase tracking-wider">
            Live Final Access Restricted
          </h1>
          <p className="text-sm text-[var(--muted)] max-w-lg mx-auto mt-2 leading-relaxed">
            {registrationStatus.eligibility_message ||
              "This live on-premise final is strictly restricted to cadets who qualified within the Top 30 cutoff of the Phase 1 Online Screening Assessment."}
          </p>
          <div className="mt-6 flex items-center justify-center gap-4 flex-wrap">
            <Button
              asChild
              variant="outline"
              className="border-[var(--line)] text-white hover:border-[var(--accent)] font-mono text-xs uppercase"
            >
              <Link to="/portal/contests" search={{ filter: "all", state: "default" }}>
                Explore Available Contests
              </Link>
            </Button>
            <Button
              asChild
              className="bg-[var(--accent)] text-black hover:bg-[var(--accent-ink)] font-mono text-xs font-bold uppercase tracking-wider"
            >
              <Link to="/portal/leaderboard">
                View Screening Leaderboard
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrap">
      <Link
        to="/portal/contests"
        search={{ filter: "all", state: "default" }}
        className="back-link"
      >
        <ArrowLeft />
        All contests
      </Link>

      <header className="contest-overview">
        <div>
          <LifecycleBadge lifecycle={c.lifecycle} />
          <p className="kicker">{c.season}</p>
          <h1>{c.title}</h1>
          <p>{c.summary}</p>

          <div className="button-row">
            {!isRegistered ? (
              <Button
                onClick={() => setShowRegisterModal(true)}
                className="bg-[var(--accent)] text-black hover:bg-[var(--accent-ink)] font-bold text-xs uppercase tracking-wider px-5"
              >
                <Users className="w-4 h-4 mr-2" />
                Register for contest
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : isUnlocked ? (
              now < startsAtMs ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    asChild
                    className="bg-amber-400 text-black hover:bg-amber-300 font-bold text-xs uppercase tracking-wider px-5 shadow-[0_0_15px_rgba(251,191,36,0.3)] animate-pulse"
                  >
                    <Link
                      to="/portal/contests/$contestSlug/assessment"
                      params={{ contestSlug }}
                      search={{ state: "waiting" }}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Clock className="w-4 h-4 mr-2 animate-spin" />
                      Assessment Starts in {Math.max(0, Math.ceil((startsAtMs - now) / 1000))}s
                      <ArrowRight className="w-4 h-4 ml-2" />
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
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    asChild
                    className="bg-[var(--accent)] text-black hover:bg-[var(--accent-ink)] font-bold text-xs uppercase tracking-wider px-5 shadow-[0_0_20px_rgba(34,197,94,0.3)]"
                  >
                    <Link
                      to="/portal/contests/$contestSlug/assessment"
                      params={{ contestSlug }}
                      search={{ state: "live" }}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Play className="w-4 h-4 mr-2 fill-current" />
                      Enter Online Assessment
                      <ArrowRight className="w-4 h-4 ml-2" />
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
              )
            ) : isConcluded ? (
              <Button disabled variant="outline" className="text-[var(--muted)] border-[var(--line)]">
                Assessment Concluded
              </Button>
            ) : (
              <Button
                variant="outline"
                disabled
                className="border-[var(--line)] text-white opacity-95 cursor-not-allowed bg-[var(--surface-2)]"
              >
                <CheckCircle2 className="w-4 h-4 mr-2 text-[var(--accent)]" />
                Registered · Assessment Locked (Opens 24h prior)
              </Button>
            )}

            {/* View Round 1 results strictly hidden for upcoming contests */}
            {hasResults && (
              <Button variant="outline" asChild>
                <Link
                  to="/portal/contests/$contestSlug/results"
                  params={{ contestSlug }}
                  search={{ state: "qualified", query: "", filter: "all", sort: "rank" }}
                >
                  View Round 1 results
                </Link>
              </Button>
            )}
          </div>
        </div>

        <div className="format-emphasis">
          {/* Real-time Assessment Time Watch on the side */}
          <AssessmentTimeWatch
            startsAt={c.stages[0]?.starts_at || c.registration_closes_at}
            endsAt={c.stages[0]?.ends_at || c.results_at}
            isRegistered={isRegistered}
          />

          <p className="kicker">How this contest works</p>
          <TwoStageIndicator stages={c.stages} />
          <p>
            Everyone begins online. Only the thirty highest verified Round 1 scores receive access to
            the on-campus final.
          </p>
        </div>
      </header>

      {isRegistered && (
        <section className="registration-confirmed">
          <CalendarCheck />
          <div>
            <strong>You’re registered for Round 1</strong>
            <p>
              Your seat is reserved. The assessment unlocks exactly 24 hours prior to live launch.
              We will verify your presence through automated telemetry.
            </p>
          </div>
          <span>Status: Verified Entry</span>
        </section>
      )}

      <div className="content-grid contest-information">
        <section className="panel">
          <SectionHeader kicker="Four fixed moments" title="Contest timeline" />
          <Timeline contest={c} />
        </section>
        <section className="panel">
          <SectionHeader kicker="Who can enter" title="Eligibility" />
          <ul className="check-list">
            {c.eligibility.map((x) => (
              <li key={x}>
                <ShieldCheck />
                {x}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="contest-lower">
        <div className="panel">
          <SectionHeader kicker="Both rounds" title="Rules and qualification" />
          <ol className="rule-list">
            {c.rules.map((x, i) => (
              <li key={x}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                {x}
              </li>
            ))}
          </ol>
        </div>
        <div className="panel">
          <SectionHeader kicker="What is at stake" title="Prizes and recognition" />
          <ul className="prize-list">
            {c.prizes.map((x) => (
              <li key={x}>
                <Gift />
                {x}
              </li>
            ))}
          </ul>
          <div className="capacity-note">
            <Users />
            <span>
              <strong>{c.registered_count}</strong> registered for Round 1
            </span>
          </div>
        </div>
      </section>

      {/* Confirmation Modal */}
      <RegisterConfirmModal
        open={showRegisterModal}
        onOpenChange={setShowRegisterModal}
        contest={c}
        onSuccess={handleRegisteredSuccess}
      />
    </div>
  );
}
