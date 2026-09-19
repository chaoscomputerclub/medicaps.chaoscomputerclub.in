import { useState } from "react";
import { X, Calendar, Trophy, MapPin, Users, ShieldCheck, Sparkles, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { ContestCreatePayload } from "../api/adminContestApi";

interface ContestCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (payload: ContestCreatePayload) => Promise<void>;
}

export function ContestCreateModal({ isOpen, onClose, onCreate }: ContestCreateModalProps) {
  const [title, setTitle] = useState("CCC Weekly Contest 2");
  const [slug, setSlug] = useState("weekly-contest-2");
  const [season, setSeason] = useState("Season 2026");
  const [cadence, setCadence] = useState<"weekly" | "biweekly" | "special">("weekly");
  const [edition, setEdition] = useState(2);
  const [division, setDivision] = useState<"open" | "division_1" | "division_2" | "division_3">("open");

  // Default to next Wednesday 3:00 PM IST
  const getDefaultDateTimes = () => {
    const d = new Date();
    // Default to 4 days from now at 15:00 local time
    d.setDate(d.getDate() + 4);
    d.setHours(15, 0, 0, 0);
    const starts = d.toISOString().slice(0, 16);
    d.setHours(16, 30, 0, 0);
    const ends = d.toISOString().slice(0, 16);
    d.setHours(14, 0, 0, 0);
    const checkin = d.toISOString().slice(0, 16);
    return { starts, ends, checkin };
  };

  const defaults = getDefaultDateTimes();
  const [startsAt, setStartsAt] = useState(defaults.starts);
  const [endsAt, setEndsAt] = useState(defaults.ends);
  const [checkInOpensAt, setCheckInOpensAt] = useState(defaults.checkin);

  const [venue, setVenue] = useState("Medi-Caps University Main Computing Lab (Lab 04)");
  const [seatCapacity, setSeatCapacity] = useState(60);
  const [prizePool, setPrizePool] = useState("₹15,000 Cash Prize + Merit Certificates");
  const [sponsor, setSponsor] = useState("Chaos Computer Club Medi-Caps Chapter");
  const [environment, setEnvironment] = useState("Air-Gapped Workstation LAN · Clang 18 / GCC 14 / Python 3.12");
  const [summary, setSummary] = useState(
    "Algorithmic showdown for Medi-Caps cadets. 4 algorithmic challenges testing graph traversal, greedy optimization, and dynamic programming. Top 30 online screening qualifiers advance to the air-gapped lab final."
  );
  const [autoScreening, setAutoScreening] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    const generated = newTitle
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .trim();
    setSlug(generated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Contest title is required.");
      return;
    }
    if (!startsAt) {
      toast.error("Contest start time is required.");
      return;
    }

    const payload: ContestCreatePayload = {
      title: title.trim(),
      slug: slug.trim() || undefined,
      season,
      cadence,
      edition: Number(edition),
      division,
      starts_at: new Date(startsAt).toISOString(),
      ends_at: endsAt ? new Date(endsAt).toISOString() : undefined,
      check_in_opens_at: checkInOpensAt ? new Date(checkInOpensAt).toISOString() : undefined,
      venue: venue.trim(),
      seat_capacity: Number(seatCapacity),
      environment: environment.trim(),
      prize_pool: prizePool.trim() || undefined,
      sponsor: sponsor.trim() || undefined,
      summary: summary.trim(),
      initialize_screening: autoScreening,
      chief_proctors: ["Chief Proctor (CCC Core)", "CCC Operations Desk"],
      rules: [
        "Schedule: On-premise air-gapped lab final.",
        "Phase 1 Online Screening: 90-minute proctored session in anti-cheat browser arena.",
        "Top 30 verified scorers qualify for the Phase 2 on-premise air-gapped lab final.",
        "Submissions evaluated via CodeBox with sub-millisecond precision.",
        "Standard penalty: 20 minutes per non-accepted submission on tie-breaks.",
      ],
    };

    setIsSubmitting(true);
    try {
      await onCreate(payload);
      toast.success(`Contest '${payload.title}' initialized successfully!`);
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to create contest.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto font-mono">
      <div className="relative w-full max-w-3xl max-h-[92vh] flex flex-col bg-zinc-950 border border-white/15 rounded-none shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 bg-zinc-900/60">
          <div className="flex items-center gap-2.5">
            <Trophy className="size-4 text-lime-400" />
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                Initialize Campus Contest
              </h2>
              <p className="text-[10px] text-zinc-400">
                Launch a new weekly/biweekly contest edition and attach Phase 1 screening round
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="text-zinc-400 hover:text-white p-1 rounded-none hover:bg-white/5 cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Row 1: Title, Slug, Cadence, Edition */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">
                Contest Title:
              </label>
              <Input
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="CCC Weekly Contest #2"
                className="bg-black border-white/15 text-xs text-white rounded-none h-9"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">
                URL Slug:
              </label>
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="weekly-contest-2"
                className="bg-black border-white/15 text-xs text-lime-400 rounded-none h-9"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">
                Edition #:
              </label>
              <Input
                type="number"
                value={edition}
                onChange={(e) => setEdition(Number(e.target.value))}
                min={1}
                className="bg-black border-white/15 text-xs text-white rounded-none h-9 tabular-nums"
              />
            </div>
          </div>

          {/* Row 2: Season, Cadence, Division, Seat Capacity */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">
                Season:
              </label>
              <Input
                value={season}
                onChange={(e) => setSeason(e.target.value)}
                className="bg-black border-white/15 text-xs text-white rounded-none h-9"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">
                Cadence:
              </label>
              <select
                value={cadence}
                onChange={(e) => setCadence(e.target.value as any)}
                className="w-full bg-black border border-white/15 text-xs text-white rounded-none h-9 px-2.5 focus-visible:ring-2 focus-visible:ring-lime-400"
              >
                <option value="weekly">Weekly</option>
                <option value="biweekly">Biweekly</option>
                <option value="special">Special Cup</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">
                Division:
              </label>
              <select
                value={division}
                onChange={(e) => setDivision(e.target.value as any)}
                className="w-full bg-black border border-white/15 text-xs text-white rounded-none h-9 px-2.5 focus-visible:ring-2 focus-visible:ring-lime-400"
              >
                <option value="open">Open (All Cadets)</option>
                <option value="division_1">Division 1 (1800+)</option>
                <option value="division_2">Division 2 (1400-1799)</option>
                <option value="division_3">Division 3 (&lt;1400)</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">
                Workstation Seats:
              </label>
              <Input
                type="number"
                value={seatCapacity}
                onChange={(e) => setSeatCapacity(Number(e.target.value))}
                min={10}
                max={500}
                className="bg-black border-white/15 text-xs text-white rounded-none h-9 tabular-nums"
              />
            </div>
          </div>

          {/* Row 3: Timings (Check-in, Starts At, Ends At) */}
          <div className="p-4 bg-zinc-900/50 border border-white/10 space-y-3">
            <span className="block text-xs font-bold text-lime-400 uppercase tracking-wider">
              Contest Schedule & Timings (Local Time)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">
                  Gate Check-In Opens:
                </label>
                <Input
                  type="datetime-local"
                  value={checkInOpensAt}
                  onChange={(e) => setCheckInOpensAt(e.target.value)}
                  className="bg-black border-white/15 text-xs text-white rounded-none h-9"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">
                  Contest Starts At:
                </label>
                <Input
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  className="bg-black border-white/15 text-xs text-white rounded-none h-9"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">
                  Contest Ends At:
                </label>
                <Input
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  className="bg-black border-white/15 text-xs text-white rounded-none h-9"
                  required
                />
              </div>
            </div>
          </div>

          {/* Logistics: Venue & Environment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">
                Venue:
              </label>
              <Input
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                className="bg-black border-white/15 text-xs text-white rounded-none h-9"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">
                Prizes / Awards:
              </label>
              <Input
                value={prizePool}
                onChange={(e) => setPrizePool(e.target.value)}
                className="bg-black border-white/15 text-xs text-white rounded-none h-9"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">
              Environment Setup:
            </label>
            <Input
              value={environment}
              onChange={(e) => setEnvironment(e.target.value)}
              className="bg-black border-white/15 text-xs text-white rounded-none h-9"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">
              Contest Briefing Summary:
            </label>
            <Textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={3}
              className="bg-black border-white/15 text-xs text-white rounded-none font-mono"
              required
            />
          </div>

          {/* Screening Checkbox */}
          <div className="p-3 bg-zinc-900/60 border border-white/10 flex items-center gap-3">
            <input
              type="checkbox"
              id="auto-screening-check"
              checked={autoScreening}
              onChange={(e) => setAutoScreening(e.target.checked)}
              className="size-4 accent-lime-400 cursor-pointer"
            />
            <label htmlFor="auto-screening-check" className="cursor-pointer">
              <span className="text-xs font-bold text-white block">
                Automatically Initialize Phase 1 Online Screening Assessment
              </span>
              <span className="text-[10px] text-zinc-400 block">
                Generates 4 algorithmic challenges (A, B, C, D) and sets 24h screening qualification window
              </span>
            </label>
          </div>

          {/* Action Bar Footer */}
          <div className="flex items-center justify-end gap-2 border-t border-white/10 pt-4 mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-10 rounded-none border-white/15 text-zinc-400 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-10 rounded-none bg-lime-400 hover:bg-lime-300 text-black font-mono text-xs font-black uppercase tracking-wider focus-visible:ring-2 focus-visible:ring-lime-400"
            >
              {isSubmitting ? "Initializing Contest..." : "Create Contest"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
