import { Link, useNavigate, useParams } from "react-router-dom";
import { useEffect, useCallback, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Lock,
  MapPin,
  Play,
  QrCode,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FINALIST_SEATS, formatWhen } from "@/features/contest/lifecycle";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchContestDetailThunk, fetchCampusPassThunk } from "@/store/slices/contestSlice";
import { invalidateSwrCache, globalSwrStore } from "@/lib/cache/swrCache";
import { ContestOfflineSkeleton } from "@/organization/components/skeletons";
import { useRealtimeEvents } from "@/lib/realtime";
import { PageHeader, SectionHeader } from "@/organization/components/ui";

export function ContestQualifiedPage() {
  const { contestSlug = "" } = useParams<{ contestSlug: string }>();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

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
    void dispatch(fetchContestDetailThunk({ slug: contestSlug, force }));
    void dispatch(fetchCampusPassThunk());
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

  // Real-time synchronization
  useRealtimeEvents(contestSlug, (event) => {
    if (event.event === "contest_deleted") {
      navigate("/contests", { replace: true });
      return;
    }
    if (
      event.event === "pass_checked_in" ||
      event.event === "contest_status_changed" ||
      event.event === "contest_updated" ||
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

  // Hydrate from SWR sessionStorage cache on reload — no skeleton flash
  const cachedContest = !contest && contestSlug
    ? (globalSwrStore.get<any>(`contest:detail:${contestSlug}`)?.data ?? null)
    : null;
  const resolvedContest = contest ?? cachedContest;

  if (isLoadingDetail && !resolvedContest) {
    return <ContestOfflineSkeleton />;
  }

  if (!contest) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center font-mono text-xs text-zinc-500">
        Contest not found.
      </div>
    );
  }

  const isAssessmentEnded = Boolean(
    registration?.assessment_taken ||
    registration?.assessment_status === "submitted" ||
    registration?.assessment_status === "completed"
  );
  const isTop30Qualified = Boolean(
    registration?.is_top_30_qualified ||
    registration?.can_enter_live_contest ||
    pass !== null
  );
  const rank = registration?.assessment_rank;
  const score = registration?.assessment_score;
  const isCheckedIn = pass?.check_in_status === "checked_in" || pass?.status === "checked_in";

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <Link
        to={`/contests/${contestSlug}`}
        className="inline-flex items-center gap-1.5 font-mono text-xs text-zinc-500 hover:text-white transition-colors"
      >
        <ArrowLeft className="size-3.5" /> Back to {contest.title}
      </Link>

      {/* Qualified Top 30 Pass */}
      {isAssessmentEnded && isTop30Qualified ? (
        <>
          <PageHeader
            kicker="02 // Finalist Credentials"
            index="ROUND 2 FINAL"
            title={`${rank ? `Rank #${rank}` : "Top 30"} — Campus Pass Issued`}
            description="Verified air-gapped lab workstation pass for Round 2 Finals."
            badge={
              <span className="rounded border border-lime-400/30 bg-lime-400/10 px-2 py-0.5 font-mono text-xs font-semibold text-lime-400 tabular-nums">
                {score} PTS
              </span>
            }
          />

          {pass ? (
            <div className="space-y-6">
              {/* QR Code Hero Card */}
              <div className="flex flex-col items-center gap-6 rounded-lg border border-lime-400/30 bg-black p-6 sm:p-8">
                {/* Status Bar */}
                <div className="flex items-center justify-between w-full border-b border-white/8 pb-3">
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-lime-400">
                    Medi-Caps Campus Gate Pass
                  </span>
                  <span className={`font-sans text-[10px] uppercase font-semibold rounded px-2 py-0.5 border ${
                    isCheckedIn
                      ? "text-emerald-400 border-emerald-500/30 bg-emerald-950/40"
                      : "text-amber-400 border-amber-500/30 bg-black"
                  }`}>
                    ● {isCheckedIn ? "CHECKED IN · GATE VERIFIED" : "ISSUED · AWAITING SCAN"}
                  </span>
                </div>

                {/* White QR Code container */}
                <div className="flex flex-col items-center gap-2 rounded-md bg-white p-5">
                  <QRCodeSVG
                    value={`CCC-PASS:${pass.pass_code}:${pass.seat || "LAB-04-WS-07"}:QUALIFIED`}
                    size={200}
                    level="H"
                  />
                  <p className="font-mono text-xs font-semibold uppercase tracking-widest text-black">
                    {pass.pass_code}
                  </p>
                </div>

                {/* Pass details tiles */}
                <div className="w-full space-y-3">
                  <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                    {[
                      { label: "Cadet", value: pass.member_name },
                      { label: "Handle", value: `@${pass.handle}` },
                      { label: "Workstation", value: pass.seat || "LAB-04-WS-07", hi: true },
                      { label: "Qualifier", value: `#${rank} (${score} pts)` },
                    ].map(({ label, value, hi }) => (
                      <div key={label} className="rounded-md border border-white/8 bg-zinc-950 p-3">
                        <p className="text-[9px] uppercase tracking-wider text-zinc-500">{label}</p>
                        <p className={`mt-0.5 font-semibold ${hi ? "text-lime-400" : "text-white"}`}>{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Check-in time */}
                  <div className="flex items-center gap-2.5 rounded-md border border-white/8 bg-zinc-950 px-3.5 py-2.5 font-mono text-xs">
                    <Clock className="size-3.5 shrink-0 text-lime-400" />
                    <div>
                      <span className="text-zinc-500">Gate Opens: </span>
                      <span className="text-white font-medium">{formatWhen(pass.check_in_opens_at || contest.check_in_opens_at)}</span>
                    </div>
                  </div>

                  {/* Countdown to Final */}
                  {!finalCountdown.started && (finalCountdown.h > 0 || finalCountdown.m > 0 || finalCountdown.s > 0) && contest.status !== "live" && (
                    <div className="rounded-md border border-lime-400/30 bg-black p-4">
                      <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 mb-2 flex items-center gap-1.5">
                        <span className="size-1.5 rounded-full bg-lime-400 animate-pulse" />
                        Round 2 Final Starts In
                      </p>
                      <div className="grid grid-cols-3 divide-x divide-white/8 rounded border border-white/8 bg-zinc-950">
                        {[
                          { label: "Hours", value: finalCountdown.h },
                          { label: "Minutes", value: finalCountdown.m },
                          { label: "Seconds", value: finalCountdown.s },
                        ].map(({ label, value }) => (
                          <div key={label} className="flex flex-col items-center gap-0.5 py-2.5">
                            <span className="text-xl font-bold font-mono text-lime-400 tabular-nums">
                              {String(value).padStart(2, "0")}
                            </span>
                            <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-500">{label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {finalCountdown.started && contest.status === "live" && (
                    <div className="flex items-center justify-between rounded-md border border-lime-400/40 bg-lime-400/10 p-3">
                      <div className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-lime-400 animate-pulse" />
                        <span className="font-mono text-xs font-semibold text-lime-400 uppercase tracking-wider">Round 2 Is Live</span>
                      </div>
                      <Button asChild variant="outline" size="sm">
                        <a href={`/contests/${contestSlug}/lobby`} target="_blank" rel="noopener noreferrer">
                          <Play className="mr-1 size-3 fill-current" /> Enter Arena
                        </a>
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Lab Instructions */}
              <div className="space-y-3 rounded-lg border border-white/8 bg-black p-5">
                <SectionHeader kicker="01 // Protocol" index="LAB PROTOCOL" title="Venue Regulations" />
                <ul className="space-y-2 font-mono text-xs text-zinc-400">
                  <li className="flex items-start gap-2">
                    <span className="text-lime-400 font-semibold shrink-0">01.</span>
                    <span>Present this digital pass at the entrance of the Medi-Caps Computing Complex for proctor scan.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-lime-400 font-semibold shrink-0">02.</span>
                    <span>Take your designated workstation (<strong className="text-white">{pass.seat || "Assigned Seat"}</strong>). External laptops, phones, or storage devices are banned.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-lime-400 font-semibold shrink-0">03.</span>
                    <span>The live contest arena is air-gapped and synchronized with the proctor operations command.</span>
                  </li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-white/8 bg-black p-8 text-center font-mono text-xs text-zinc-400 space-y-3">
              <ShieldCheck className="size-8 mx-auto text-lime-400" />
              <p>Top 30 qualification verified. Generating your secure QR pass...</p>
              <Button onClick={() => refreshData(true)} variant="outline" size="sm">
                Refresh Credentials
              </Button>
            </div>
          )}
        </>
      ) : (
        /* Not Qualified State */
        <div className="rounded-lg border border-white/8 bg-black p-8 text-center space-y-4 font-mono">
          <div className="size-12 rounded-md bg-zinc-950 border border-white/10 flex items-center justify-center mx-auto text-zinc-400">
            <Lock size={22} />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-white">Campus Pass Restricted</h2>
            <p className="text-xs text-zinc-400 leading-relaxed max-w-md mx-auto">
              Workstation passes are issued strictly to the Top {FINALIST_SEATS} verified qualifiers from the Round 1 screening assessment.
            </p>
          </div>
          <div className="pt-2 flex justify-center gap-3">
            <Button asChild variant="default" size="sm">
              <Link to={`/contests/${contestSlug}/results`}>View Standings</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to={`/contests/${contestSlug}`}>Contest Overview</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
