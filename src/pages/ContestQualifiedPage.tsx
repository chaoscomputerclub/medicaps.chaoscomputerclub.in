import { Link, useParams } from "react-router-dom";
import { useEffect } from "react";
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
import { ContestOfflineSkeleton } from "@/organization/components/skeletons";

export function ContestQualifiedPage() {
  const { contestSlug = "" } = useParams<{ contestSlug: string }>();
  const dispatch = useAppDispatch();

  const { currentContest: contest, registration, pass, isLoadingDetail } = useAppSelector(
    (state) => state.contest
  );

  useEffect(() => {
    if (contestSlug) {
      dispatch(fetchContestDetailThunk(contestSlug));
      dispatch(fetchCampusPassThunk());
    }
  }, [contestSlug, dispatch]);

  const qualified = Boolean(registration?.is_top_30_qualified || registration?.can_enter_live_contest);
  const rank = registration?.assessment_rank ?? null;
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

      {/* ─── QUALIFICATION STATUS BADGE ───────────────────── */}
      <div className="flex items-center gap-3">
        {qualified ? (
          <>
            <CheckCircle2 className="size-5 text-[var(--accent)]" />
            <div>
              <p className="font-mono text-[11px] uppercase tracking-widest text-[var(--accent)]">
                Round 2 · Campus Final
              </p>
              <h1 className="text-xl font-black text-foreground">
                {rank ? `Rank #${rank}` : "Verified"} — You're through
              </h1>
            </div>
            <span className="ml-auto border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-3 py-1 font-mono text-xs font-black text-[var(--accent)]">
              {score} pts
            </span>
          </>
        ) : (
          <>
            <Lock className="size-5 text-[var(--muted)]" />
            <div>
              <p className="font-mono text-[11px] uppercase tracking-widest text-[var(--muted)]">
                Qualification Status
              </p>
              <h1 className="text-xl font-black text-foreground">Not Qualified</h1>
            </div>
          </>
        )}
      </div>

      {/* ─── QR PASS (THE HERO) ───────────────────────────── */}
      {qualified ? (
        pass ? (
          <div className="space-y-6">
            {/* QR code — full hero */}
            <div className="flex flex-col items-center gap-4 border border-[var(--accent)]/20 bg-[var(--surface)] p-8">
              {/* White QR area */}
              <div className="flex flex-col items-center gap-3 rounded-none bg-white p-6">
                <QRCodeSVG
                  value={`CCC-PASS:${pass.pass_code}:${pass.seat}:QUALIFIED`}
                  size={220}
                  level="H"
                />
                <p className="font-mono text-sm font-black uppercase tracking-widest text-black">
                  {pass.pass_code}
                </p>
              </div>

              {/* Pass details */}
              <div className="w-full space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Name", value: pass.member_name },
                    { label: "Handle", value: `@${pass.handle}` },
                    { label: "Seat", value: pass.seat },
                    { label: "Status", value: pass.status.replace("_", " ") },
                  ].map(({ label, value }) => (
                    <div key={label} className="border border-[var(--line)] bg-[var(--surface-2)] p-3">
                      <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--muted)]">{label}</p>
                      <p className="mt-0.5 text-xs font-semibold text-foreground">{value}</p>
                    </div>
                  ))}
                </div>

                {/* Check-in time */}
                <div className="flex items-center gap-3 border border-[var(--accent)]/30 bg-[var(--accent)]/5 px-4 py-3">
                  <Clock className="size-4 shrink-0 text-[var(--accent)]" />
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">Check-in opens</p>
                    <p className="text-xs font-semibold text-foreground">{formatWhen(pass.check_in_opens_at)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Instructions */}
            <div className="space-y-3">
              <p className="font-mono text-[11px] uppercase tracking-widest text-[var(--muted)]">Day-of instructions</p>
              <ul className="space-y-2">
                {[
                  "Carry your physical university ID card.",
                  "Show this QR code at the lab entrance for check-in.",
                  "Arrive before the check-in window closes — late entry refused.",
                  "No personal laptops, phones, or external storage inside.",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-[var(--muted)]">
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-[var(--accent)]" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Venue */}
            <div className="border border-[var(--line)] bg-[var(--surface)] p-5 space-y-3">
              <p className="font-mono text-[11px] uppercase tracking-widest text-[var(--muted)]">Venue</p>
              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-[var(--accent)]" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{contest.venue}</p>
                    <p className="text-xs text-[var(--muted)]">{formatWhen(contest.starts_at)}</p>
                  </div>
                </div>
                {contest.environment && (
                  <div className="flex items-start gap-3">
                    <Code2 className="mt-0.5 size-4 shrink-0 text-[var(--accent)]" />
                    <p className="text-xs text-[var(--muted)]">{contest.environment}</p>
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
                  <QrCode className="mr-1.5 size-3.5" /> Test proctor verification
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          /* Qualified but pass not generated yet */
          <div className="flex flex-col items-center gap-4 border border-[var(--accent)]/20 bg-[var(--surface)] p-12 text-center">
            <div className="flex size-16 items-center justify-center border border-[var(--line)] bg-[var(--surface-2)]">
              <QrCode className="size-7 text-[var(--muted)]" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-foreground">Pass being generated</p>
              <p className="text-xs text-[var(--muted)]">
                Your campus pass appears here once your Top {FINALIST_SEATS} placement is verified.
                This usually takes a few minutes.
              </p>
            </div>
          </div>
        )
      ) : (
        /* Not qualified */
        <div className="space-y-6">
          <div className="flex flex-col items-center gap-4 border border-[var(--line)] bg-[var(--surface)] p-12 text-center">
            <Lock className="size-8 text-[var(--muted)]" />
            <div className="space-y-1">
              <p className="font-semibold text-foreground">Pass locked</p>
              <p className="max-w-xs text-xs text-[var(--muted)]">
                {registration?.eligibility_message ??
                  `Only the top ${FINALIST_SEATS} Round 1 scores receive a campus pass. Check the standings to see the cut-off.`}
              </p>
            </div>
            <Button asChild variant="outline" className="rounded-none font-mono text-xs">
              <Link to={`/portal/contests/${contestSlug}/results`}>
                See Standings <ArrowRight className="ml-1.5 size-4" />
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
