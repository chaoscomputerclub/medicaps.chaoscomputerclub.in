import { Link, useParams } from "react-router-dom";
import { useEffect, useCallback, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  Code2,
  Lock,
  MapPin,
  Play,
  QrCode,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FINALIST_SEATS, formatWhen } from "@/features/contest/lifecycle";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchContestDetailThunk, fetchCampusPassThunk } from "@/store/slices/contestSlice";
import { invalidateSwrCache } from "@/lib/cache/swrCache";
import { ContestOfflineSkeleton } from "@/organization/components/skeletons";

export function ContestQualifiedPage() {
  const { contestSlug = "" } = useParams<{ contestSlug: string }>();
  const dispatch = useAppDispatch();

  const { currentContest: contest, registration, pass, isLoadingDetail } = useAppSelector(
    (state) => state.contest
  );

  const refreshData = useCallback((force = false) => {
    if (!contestSlug) return;
    if (force) {
      invalidateSwrCache("contests:*");
      invalidateSwrCache(`contest:*:${contestSlug}*`);
      invalidateSwrCache("passes:*");
    }
    dispatch(fetchContestDetailThunk({ slug: contestSlug, force }));
    dispatch(fetchCampusPassThunk());
  }, [contestSlug, dispatch]);

  useEffect(() => {
    refreshData(false);
  }, [refreshData]);

  // Countdown to contest start
  const [finalCountdown, setFinalCountdown] = useState({ h: 0, m: 0, s: 0, started: false });
  useEffect(() => {
    if (!contest?.starts_at) return;
    const tick = () => {
      const diff = Math.max(0, Math.floor((new Date(contest.starts_at).getTime() - Date.now()) / 1000));
      if (diff <= 0) {
        setFinalCountdown({ h: 0, m: 0, s: 0, started: true });
        return;
      }
      setFinalCountdown({
        h: Math.floor(diff / 3600),
        m: Math.floor((diff % 3600) / 60),
        s: diff % 60,
        started: false,
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [contest?.starts_at]);

  useEffect(() => {
    if (!contestSlug) return;

    const handleSync = () => {
      refreshData(true);
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "ccc:assessment_updated" || e.key === "ccc_member" || e.key?.includes(contestSlug)) {
        refreshData(true);
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        refreshData(true);
      }
    };

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        refreshData(true);
      }
    }, 10000);

    window.addEventListener("focus", handleSync);
    window.addEventListener("storage", handleStorage);
    window.addEventListener("assessment:status_changed" as any, handleSync);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleSync);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("assessment:status_changed" as any, handleSync);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [contestSlug, refreshData]);

  const isDevBypass = Boolean(registration?.is_dev_bypass || contestSlug.startsWith("dev-"));
  const isAssessmentEnded = Boolean(
    registration?.assessment_taken ||
    registration?.assessment_status === "submitted" ||
    registration?.assessment_status === "completed" ||
    (contest && (new Date(contest.starts_at).getTime() - 2 * 3600 * 1000 <= Date.now() || contest.status === "live" || contest.status === "finished")) ||
    isDevBypass
  );
  const isTop30Qualified = Boolean(
    registration?.is_top_30_qualified ||
    registration?.can_enter_live_contest ||
    (registration?.assessment_rank !== null && registration?.assessment_rank !== undefined && registration.assessment_rank <= FINALIST_SEATS) ||
    isDevBypass
  );
  const rank = registration?.assessment_rank ?? 1;
  const score = registration?.assessment_score ?? 0;

  if (isLoadingDetail && !contest) return <ContestOfflineSkeleton />;

  if (!contest) {
    return (
      <div className="page-wrap space-y-6">
        <Link to="/portal/contests" className="back-link">
          <ArrowLeft /> Back to contests
        </Link>
        <p className="text-sm text-[var(--muted)]">Contest not found.</p>
      </div>
    );
  }

  return (
    <div className="page-wrap max-w-2xl space-y-8">
      {/* Back */}
      <Link to={`/portal/contests/${contestSlug}`} className="back-link">
        <ArrowLeft /> {contest.title}
      </Link>

      {/* ─── SCENARIO 1: ASSESSMENT ENDED + QUALIFIED TOP 30 (CAMPUS PASS HERO) ───────────── */}
      {isAssessmentEnded && isTop30Qualified ? (
        <>
          {/* Status Badge */}
          <div className="flex items-center gap-3">
            <CheckCircle2 className="size-5 text-[var(--accent)]" />
            <div>
              <p className="font-mono text-[11px] uppercase tracking-widest text-[var(--accent)] font-bold">
                Round 2 · Air-Gapped Lab Final Pass
              </p>
              <h1 className="text-xl font-black text-foreground">
                {rank ? `Rank #${rank}` : "Verified Top 30"} — Lab Pass Issued
              </h1>
            </div>
            <span className="ml-auto border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-3 py-1 font-mono text-xs font-black text-[var(--accent)]">
              {score} pts
            </span>
          </div>

          {pass ? (
            <div className="space-y-6">
              {/* QR code — full hero card */}
              <div className="flex flex-col items-center gap-5 border border-[var(--accent)]/30 bg-[var(--surface)] p-8 shadow-2xl relative overflow-hidden">
                <div className="pointer-events-none absolute -right-20 -top-20 size-48 rounded-full bg-[var(--accent)]/10 blur-3xl" />
                
                {/* Header chip */}
                <div className="flex items-center justify-between w-full border-b border-[var(--line)] pb-3">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--accent)]">
                    Official Medi-Caps Gate Pass
                  </span>
                  <span className="font-mono text-[10px] uppercase font-bold text-emerald-400 border border-emerald-500/30 bg-emerald-950/20 px-2 py-0.5">
                    ● {pass.status.toUpperCase()}
                  </span>
                </div>

                {/* White QR Code container */}
                <div className="flex flex-col items-center gap-3 rounded-none bg-white p-6 shadow-md">
                  <QRCodeSVG
                    value={`CCC-PASS:${pass.pass_code}:${pass.seat || "LAB-04-PC01"}:QUALIFIED`}
                    size={220}
                    level="H"
                  />
                  <p className="font-mono text-sm font-black uppercase tracking-widest text-black">
                    {pass.pass_code}
                  </p>
                </div>

                {/* Pass details */}
                <div className="w-full space-y-3">
                  <div className="grid grid-cols-2 gap-2 font-mono">
                    {[
                      { label: "Cadet Name", value: pass.member_name },
                      { label: "University Handle", value: `@${pass.handle}` },
                      { label: "Assigned Workstation", value: pass.seat || "LAB-04-PC01", hi: true },
                      { label: "Screening Rank", value: `#${rank} (${score} Pts)` },
                    ].map(({ label, value, hi }) => (
                      <div key={label} className="border border-[var(--line)] bg-[var(--surface-2)] p-3">
                        <p className="text-[9px] uppercase tracking-widest text-[var(--muted)]">{label}</p>
                        <p className={`mt-0.5 text-xs font-bold ${hi ? "text-[var(--accent)]" : "text-foreground"}`}>{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Check-in time */}
                  <div className="flex items-center gap-3 border border-[var(--accent)]/30 bg-[var(--accent)]/5 px-4 py-3">
                    <Clock className="size-4 shrink-0 text-[var(--accent)]" />
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">Gate Check-in Opens</p>
                      <p className="text-xs font-bold text-foreground">{formatWhen(pass.check_in_opens_at || contest.check_in_opens_at)}</p>
                    </div>
                  </div>

                  {/* Round 2 Countdown */}
                  {!finalCountdown.started && (finalCountdown.h > 0 || finalCountdown.m > 0 || finalCountdown.s > 0) && contest.status !== "live" && (
                    <div className="border border-[var(--accent)]/40 bg-[var(--surface)] p-4">
                      <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--accent)] mb-3 flex items-center gap-2">
                        <span className="size-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
                        Round 2 Final Starts In
                      </p>
                      <div className="grid grid-cols-3 divide-x divide-[var(--line)] border border-[var(--line)]">
                        {[
                          { label: "Hours", value: finalCountdown.h },
                          { label: "Minutes", value: finalCountdown.m },
                          { label: "Seconds", value: finalCountdown.s },
                        ].map(({ label, value }) => (
                          <div key={label} className="flex flex-col items-center gap-1 py-3">
                            <span className="text-2xl font-black font-mono text-[var(--accent)] tabular-nums">
                              {String(value).padStart(2, "0")}
                            </span>
                            <span className="font-mono text-[9px] uppercase tracking-widest text-[var(--muted)]">{label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {finalCountdown.started && contest.status === "live" && (
                    <div className="flex items-center gap-3 border border-emerald-500/40 bg-emerald-950/20 px-4 py-3">
                      <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                      <p className="font-mono text-xs font-bold text-emerald-400 uppercase tracking-wider">Round 2 Final Is Live — Go to Arena</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Day of instructions */}
              <div className="space-y-3 border border-[var(--line)] bg-[var(--surface)] p-5">
                <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-foreground">Day-Of Lab Instructions</p>
                <ul className="space-y-2">
                  {[
                    "Carry your physical university ID card (PRN verification at entrance).",
                    "Show this QR code at the lab entrance for proctor scan.",
                    "Arrive at the Campus Computing Complex before check-in closes.",
                    "Air-gapped lab environment: no personal laptops, phones, or smart devices.",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3 text-xs text-[var(--muted)] font-mono">
                      <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-[var(--accent)]" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Venue */}
              <div className="border border-[var(--line)] bg-[var(--surface)] p-5 space-y-3">
                <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-foreground">Venue & Hardware Environment</p>
                <div className="space-y-2 font-mono">
                  <div className="flex items-start gap-3">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-[var(--accent)]" />
                    <div>
                      <p className="text-xs font-bold text-foreground">{contest.venue}</p>
                      <p className="text-[11px] text-[var(--muted)]">{formatWhen(contest.starts_at)}</p>
                    </div>
                  </div>
                  {contest.environment && (
                    <div className="flex items-start gap-3">
                      <Code2 className="mt-0.5 size-4 shrink-0 text-[var(--accent)]" />
                      <p className="text-[11px] text-[var(--muted)]">{contest.environment}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Primary CTA */}
              <div className="flex flex-col gap-2">
                <Button asChild size="lg" className="rounded-none bg-[var(--accent)] font-mono text-xs font-black uppercase tracking-wider text-black hover:bg-[var(--accent)]/90">
                  <Link to={`/portal/contests/${contestSlug}/arena`}>
                    <Play className="mr-1.5 size-4 fill-black" /> Enter Live Contest Arena
                  </Link>
                </Button>
                <Button asChild variant="ghost" size="sm" className="rounded-none font-mono text-xs text-[var(--muted)]">
                  <Link to={`/portal/verify?pass=${encodeURIComponent(pass.pass_code)}`}>
                    <QrCode className="mr-1.5 size-3.5" /> Test Proctor Verification Scan
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 border border-[var(--accent)]/20 bg-[var(--surface)] p-12 text-center">
              <div className="flex size-16 items-center justify-center border border-[var(--line)] bg-[var(--surface-2)] animate-pulse">
                <QrCode className="size-7 text-[var(--accent)]" />
              </div>
              <div className="space-y-1">
                <p className="font-bold text-foreground">Allocating Workstation Pass...</p>
                <p className="text-xs text-[var(--muted)] font-mono">
                  Your Top 30 seat is confirmed. Generating unique cryptographic pass code...
                </p>
              </div>
              <Button onClick={() => refreshData(true)} variant="outline" size="sm" className="rounded-none font-mono text-xs">
                Refresh Pass
              </Button>
            </div>
          )}
        </>
      ) : !isAssessmentEnded ? (
        /* ─── SCENARIO 2: ASSESSMENT NOT YET COMPLETED ────────────────────── */
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Clock className="size-5 text-amber-400" />
            <div>
              <p className="font-mono text-[11px] uppercase tracking-widest text-amber-400 font-bold">
                Phase 1 Screening Required
              </p>
              <h1 className="text-xl font-black text-foreground">Assessment Not Completed</h1>
            </div>
          </div>

          <div className="flex flex-col items-center gap-4 border border-amber-500/30 bg-[var(--surface)] p-12 text-center">
            <div className="flex size-16 items-center justify-center border border-amber-500/30 bg-amber-950/20 text-amber-400">
              <Lock className="size-7" />
            </div>
            <div className="space-y-2 max-w-md">
              <h3 className="font-bold text-base text-foreground font-mono">Complete Phase 1 Online Screening</h3>
              <p className="text-xs text-[var(--muted)] font-mono leading-relaxed">
                Campus Passes are exclusively awarded to the Top 30 verified cadets in Round 1 screening. Complete your 120-minute proctored session before the assessment window ends.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Button asChild className="rounded-none bg-[var(--accent)] text-xs font-bold uppercase text-black hover:bg-[var(--accent)]/90 px-6 py-2.5">
                <Link to={`/assessments/${contestSlug}`}>
                  <Play className="mr-1.5 size-4 fill-black" /> Take Assessment Now
                </Link>
              </Button>
              <Button asChild variant="outline" className="rounded-none font-mono text-xs">
                <Link to={`/portal/contests/${contestSlug}`}>Contest Lobby</Link>
              </Button>
            </div>
          </div>
        </div>
      ) : (
        /* ─── SCENARIO 3: ASSESSMENT ENDED BUT DID NOT QUALIFY IN TOP 30 ──── */
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Lock className="size-5 text-[var(--muted)]" />
            <div>
              <p className="font-mono text-[11px] uppercase tracking-widest text-[var(--muted)] font-bold">
                Qualification Status
              </p>
              <h1 className="text-xl font-black text-foreground">Did Not Qualify (Cutoff: Top 30)</h1>
            </div>
            <span className="ml-auto border border-[var(--line)] bg-[var(--surface-2)] px-3 py-1 font-mono text-xs font-bold text-[var(--muted)]">
              {score} pts
            </span>
          </div>

          <div className="flex flex-col items-center gap-4 border border-[var(--line)] bg-[var(--surface)] p-12 text-center">
            <div className="flex size-16 items-center justify-center border border-[var(--line)] bg-[var(--surface-2)] text-[var(--muted)]">
              <Lock className="size-7" />
            </div>
            <div className="space-y-2 max-w-md">
              <h3 className="font-bold text-base text-foreground font-mono">Campus Pass Reserved for Top 30</h3>
              <p className="text-xs text-[var(--muted)] font-mono leading-relaxed">
                Your screening attempt was recorded with a score of <strong>{score} pts</strong> (Rank #{rank || "—"}). Only the top 30 participants advance to the physical on-campus lab final.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Button asChild variant="outline" className="rounded-none font-mono text-xs">
                <Link to={`/portal/contests/${contestSlug}/results`}>
                  View Standings & Cutoff <ArrowRight className="ml-1.5 size-4" />
                </Link>
              </Button>
              <Button asChild variant="ghost" className="rounded-none font-mono text-xs">
                <Link to="/portal/problems">Practice in Archive</Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
