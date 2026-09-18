import { Link, useParams } from "react-router-dom";
import { useEffect, useCallback, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Code2,
  Lock,
  MapPin,
  Play,
  QrCode,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FINALIST_SEATS, formatWhen } from "@/features/contest/lifecycle";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchContestDetailThunk, fetchCampusPassThunk } from "@/store/slices/contestSlice";
import { invalidateSwrCache } from "@/lib/cache/swrCache";
import { ContestOfflineSkeleton } from "@/organization/components/skeletons";
import { useRealtimeEvents } from "@/lib/realtime";
import { PageHeader, SectionHeader } from "@/organization/components/ui";

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

  // Instant real-time push: updates pass status the exact millisecond QR is scanned or status changes
  useRealtimeEvents(contestSlug, (event) => {
    if (
      event.event === "pass_checked_in" ||
      event.event === "contest_status_changed" ||
      event.event === "top30_qualified"
    ) {
      refreshData(true);
    }
  });

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

    window.addEventListener("focus", handleSync);
    window.addEventListener("storage", handleStorage);
    window.addEventListener("assessment:status_changed" as any, handleSync);

    return () => {
      window.removeEventListener("focus", handleSync);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("assessment:status_changed" as any, handleSync);
    };
  }, [contestSlug, refreshData]);

  const isDevBypass = Boolean(registration?.is_dev_bypass || contestSlug.startsWith("dev-"));
  const isDevContest = contestSlug.startsWith("dev-");
  const isAssessmentEnded = Boolean(
    registration?.assessment_taken ||
    registration?.assessment_status === "submitted" ||
    registration?.assessment_status === "completed" ||
    (contest && (new Date(contest.starts_at).getTime() - 2 * 3600 * 1000 <= Date.now() || contest.status === "live" || contest.status === "finished")) ||
    (isDevBypass && isDevContest)
  );
  const isTop30Qualified = Boolean(
    registration?.is_top_30_qualified ||
    (registration?.assessment_rank !== null && registration?.assessment_rank !== undefined && registration.assessment_rank <= FINALIST_SEATS) ||
    (isDevBypass && isDevContest)
  );
  const rank = registration?.assessment_rank ?? 1;
  const score = registration?.assessment_score ?? 0;

  if (isLoadingDetail && !contest) return <ContestOfflineSkeleton />;

  if (!contest) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 space-y-6">
        <Link to="/portal/contests" className="inline-flex items-center gap-2 font-mono text-xs text-zinc-400 hover:text-white transition-colors">
          <ArrowLeft className="size-3.5" /> Back to contests
        </Link>
        <p className="text-sm text-zinc-400">Contest not found.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Back */}
      <Link to={`/portal/contests/${contestSlug}`} className="inline-flex items-center gap-2 font-mono text-xs text-zinc-400 hover:text-white transition-colors">
        <ArrowLeft className="size-3.5" /> {contest.title}
      </Link>

      {/* ─── SCENARIO 1: ASSESSMENT ENDED + QUALIFIED TOP 30 (CAMPUS PASS HERO) ───────────── */}
      {isAssessmentEnded && isTop30Qualified ? (
        <>
          {/* Status PageHeader */}
          <PageHeader
            kicker="02 // Campus Pass"
            index="ROUND 2 · AIR-GAPPED FINAL"
            title={`${rank ? `Rank #${rank}` : "Verified Top 30"} — Lab Pass Issued`}
            description="Official air-gapped lab final workstation access pass for verified qualifiers."
            badge={
              <span className="rounded-none border border-lime-400/30 bg-lime-400/10 px-3 py-1 font-mono text-xs font-black text-lime-400 tabular-nums">
                {score} PTS
              </span>
            }
          />

          {pass ? (
            <div className="space-y-6">
              {/* QR code — full hero card */}
              <div className="flex flex-col items-center gap-5 rounded-none border border-lime-400/30 bg-zinc-900/60 p-8 shadow-2xl relative overflow-hidden backdrop-blur-md">
                <div className="pointer-events-none absolute -right-20 -top-20 size-48 rounded-none bg-lime-400/10 blur-3xl" />
                
                {/* Header chip */}
                <div className="flex items-center justify-between w-full border-b border-white/10 pb-3">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-lime-400">
                    Official Medi-Caps Gate Pass
                  </span>
                  <span className={`font-mono text-[10px] uppercase font-bold rounded-none border px-2 py-0.5 ${
                    pass.check_in_status === "checked_in" || pass.status === "checked_in"
                      ? "text-emerald-400 border-emerald-500/30 bg-emerald-950/30"
                      : "text-amber-400 border-amber-500/30 bg-amber-950/30"
                  }`}>
                    ● {pass.check_in_status === "checked_in" || pass.status === "checked_in" ? "CHECKED IN (GATE VERIFIED)" : "ISSUED · AWAITING PROCTOR SCAN"}
                  </span>
                </div>

                {/* White QR Code container */}
                <div className="flex flex-col items-center gap-3 rounded-none bg-white p-6 shadow-xl">
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
                      <div key={label} className="rounded-none border border-white/10 bg-zinc-950/60 p-3">
                        <p className="text-[9px] uppercase tracking-widest text-zinc-400">{label}</p>
                        <p className={`mt-0.5 text-xs font-bold ${hi ? "text-lime-400" : "text-white"}`}>{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Check-in time */}
                  <div className="flex items-center gap-3 rounded-none border border-lime-400/30 bg-lime-400/5 px-4 py-3">
                    <Clock className="size-4 shrink-0 text-lime-400" />
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-400">Gate Check-in Opens</p>
                      <p className="text-xs font-bold text-white">{formatWhen(pass.check_in_opens_at || contest.check_in_opens_at)}</p>
                    </div>
                  </div>

                  {/* Round 2 Countdown */}
                  {!finalCountdown.started && (finalCountdown.h > 0 || finalCountdown.m > 0 || finalCountdown.s > 0) && contest.status !== "live" && (
                    <div className="rounded-none border border-lime-400/40 bg-zinc-900 p-4">
                      <p className="font-mono text-[10px] uppercase tracking-widest text-lime-400 mb-3 flex items-center gap-2">
                        <span className="size-1.5 rounded-full bg-lime-400 animate-pulse" />
                        Round 2 Final Starts In
                      </p>
                      <div className="grid grid-cols-3 divide-x divide-white/10 rounded-none border border-white/10">
                        {[
                          { label: "Hours", value: finalCountdown.h },
                          { label: "Minutes", value: finalCountdown.m },
                          { label: "Seconds", value: finalCountdown.s },
                        ].map(({ label, value }) => (
                          <div key={label} className="flex flex-col items-center gap-1 py-3">
                            <span className="text-2xl font-black font-mono text-lime-400 tabular-nums">
                              {String(value).padStart(2, "0")}
                            </span>
                            <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-400">{label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {finalCountdown.started && contest.status === "live" && (
                    <div className="flex items-center gap-3 rounded-none border border-emerald-500/40 bg-emerald-950/20 px-4 py-3">
                      <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                      <p className="font-mono text-xs font-bold text-emerald-400 uppercase tracking-wider">Round 2 Final Is Live — Go to Arena</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Day of instructions */}
              <div className="space-y-4 rounded-none border border-white/10 bg-zinc-900/60 p-6 backdrop-blur-md shadow-xl">
                <SectionHeader kicker="01 // Protocol" index="LAB PROTOCOL" title="Day-Of Lab Instructions" />
                <ul className="space-y-2">
                  {[
                    "Carry your physical university ID card (Enrollment verification at entrance).",
                    "Show this QR code at the lab entrance for proctor scan.",
                    "Arrive at the Campus Computing Complex before check-in closes.",
                    "Air-gapped lab environment: no personal laptops, phones, or smart devices.",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3 text-xs text-zinc-300 font-mono">
                      <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-400" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Venue */}
              <div className="rounded-none border border-white/10 bg-zinc-900/60 p-6 space-y-4 backdrop-blur-md shadow-xl">
                <SectionHeader kicker="02 // Hardware Specs" index="TERMINAL ENVIRONMENT" title="Venue & Environment" />
                <div className="space-y-2 font-mono">
                  <div className="flex items-start gap-3">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-lime-400" />
                    <div>
                      <p className="text-xs font-bold text-white">{contest.venue}</p>
                      <p className="text-[11px] text-zinc-400">{formatWhen(contest.starts_at)}</p>
                    </div>
                  </div>
                  {contest.environment && (
                    <div className="flex items-start gap-3">
                      <Code2 className="mt-0.5 size-4 shrink-0 text-lime-400" />
                      <p className="text-[11px] text-zinc-400">{contest.environment}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Primary CTA */}
              <div className="flex flex-col gap-2">
                {pass.check_in_status === "checked_in" || pass.status === "checked_in" || isDevBypass ? (
                  <Button asChild size="lg" className="rounded-none bg-lime-400 font-mono text-xs font-black uppercase tracking-wider text-black hover:bg-lime-300 shadow-lg shadow-lime-400/20">
                    <Link to={`/portal/contests/${contestSlug}/arena`}>
                      <Play className="mr-1.5 size-4 fill-black" /> Enter Live Contest Arena
                    </Link>
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 rounded-none border border-amber-500/40 bg-amber-950/20 p-3 text-xs font-mono text-amber-400">
                      <Lock className="size-4 shrink-0" />
                      <span>Physical Gate Lock: Present this QR code to the proctor at the lab entrance to check in.</span>
                    </div>
                  </div>
                )}
                <Button asChild variant="ghost" size="sm" className="rounded-none font-mono text-xs text-zinc-400 hover:text-white">
                  <Link to={`/portal/contests/${contestSlug}`}>
                    Contest Overview
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 rounded-none border border-lime-400/20 bg-zinc-900/60 p-12 text-center backdrop-blur-md">
              <div className="flex size-16 items-center justify-center rounded-none border border-white/10 bg-zinc-950/60 animate-pulse text-lime-400">
                <QrCode className="size-7" />
              </div>
              <div className="space-y-1">
                <p className="font-bold text-white">Allocating Workstation Pass...</p>
                <p className="text-xs text-zinc-400 font-mono">
                  Your Top 30 seat is confirmed. Generating unique cryptographic pass code...
                </p>
              </div>
              <Button onClick={() => refreshData(true)} variant="outline" size="sm" className="rounded-none font-mono text-xs border-white/10">
                Refresh Pass
              </Button>
            </div>
          )}
        </>
      ) : !isAssessmentEnded ? (
        /* ─── SCENARIO 2: ASSESSMENT NOT YET COMPLETED ────────────────────── */
        <div className="space-y-6">
          <PageHeader
            kicker="01 // Screening Status"
            index="ROUND 1 · SCREENING PENDING"
            title="Assessment Not Completed"
            description="Campus Passes are exclusively awarded to the Top 30 verified cadets in Round 1 screening."
          />

          <div className="flex flex-col items-center gap-4 rounded-none border border-amber-500/30 bg-zinc-900/60 p-12 text-center backdrop-blur-md">
            <div className="flex size-16 items-center justify-center rounded-none border border-amber-500/30 bg-amber-950/20 text-amber-400">
              <Lock className="size-7" />
            </div>
            <div className="space-y-2 max-w-md">
              <h3 className="font-bold text-base text-white font-mono uppercase">Complete Phase 1 Online Screening</h3>
              <p className="text-xs text-zinc-400 font-mono leading-relaxed">
                Campus Passes are exclusively awarded to the Top 30 verified cadets in Round 1 screening. Complete your 120-minute proctored session before the assessment window ends.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Button asChild className="rounded-none bg-lime-400 text-xs font-bold uppercase text-black hover:bg-lime-300 px-6 py-2.5 shadow-md shadow-lime-400/20">
                <Link to={`/assessments/${contestSlug}`}>
                  <Play className="mr-1.5 size-4 fill-black" /> Take Assessment Now
                </Link>
              </Button>
              <Button asChild variant="outline" className="rounded-none font-mono text-xs border-white/10">
                <Link to={`/portal/contests/${contestSlug}`}>Contest Lobby</Link>
              </Button>
            </div>
          </div>
        </div>
      ) : (
        /* ─── SCENARIO 3: ASSESSMENT ENDED BUT DID NOT QUALIFY IN TOP 30 ──── */
        <div className="space-y-6">
          <PageHeader
            kicker="02 // Qualification Matrix"
            index="CUTOFF TOP 30 · CONCLUDED"
            title="Did Not Qualify"
            description="Your screening attempt was recorded. Only the top 30 participants advance to the physical on-campus lab final."
            badge={
              <span className="rounded-none border border-white/10 bg-zinc-800/60 px-3 py-1 font-mono text-xs font-bold text-zinc-400 tabular-nums">
                {score} PTS
              </span>
            }
          />

          <div className="flex flex-col items-center gap-4 rounded-none border border-white/10 bg-zinc-900/60 p-12 text-center backdrop-blur-md">
            <div className="flex size-16 items-center justify-center rounded-none border border-white/10 bg-zinc-950/60 text-zinc-500">
              <Lock className="size-7" />
            </div>
            <div className="space-y-2 max-w-md">
              <h3 className="font-bold text-base text-white font-mono">Campus Pass Reserved for Top 30</h3>
              <p className="text-xs text-zinc-400 font-mono leading-relaxed">
                Your screening attempt was recorded with a score of <strong className="text-white">{score} pts</strong> (Rank #{rank || "—"}). Only the top 30 participants advance to the physical on-campus lab final.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Button asChild variant="outline" className="rounded-none font-mono text-xs border-white/10">
                <Link to={`/portal/contests/${contestSlug}/results`}>
                  View Standings & Cutoff <ArrowRight className="ml-1.5 size-4" />
                </Link>
              </Button>
              <Button asChild variant="ghost" className="rounded-none font-mono text-xs text-zinc-400 hover:text-white">
                <Link to="/portal/problems">Practice in Archive</Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
