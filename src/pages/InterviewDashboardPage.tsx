/**
 * Chaos Computer Club Medi-Caps — AI Interview Arena Dashboard
 * Authoritative Candidate Practice Catalog backed by published interview blueprints.
 * Candidates select published tracks to practice without arbitrary configuration wizards.
 * Optional resume intelligence personalizes context without altering published blueprints.
 * Styled in 100% fidelity to CCC Medi-Caps tactical dark theme (#B1FA63 accent).
 */

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchTracks,
  fetchSessions,
  createSession,
  startSession,
  deleteSession,
  setResumeModalOpen,
} from "@/store/slices/interviewSlice";
import { ResumeManagerModal } from "@/features/interview/components/ResumeManagerModal";
import { PageHeader, SectionHeader } from "@/organization/components/ui";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { InterviewTrackSummary } from "@/features/interview/types";
import {
  Sparkles,
  Terminal,
  Code,
  BrainCircuit,
  Layers,
  Server,
  Monitor,
  Cloud,
  Database,
  Users,
  Play,
  FileText,
  Trash2,
  Clock,
  Award,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Info,
  Cpu,
  Target,
  BookOpen,
} from "lucide-react";

export function InterviewDashboardPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { tracks, sessions, currentResume, isLoadingTracks, isStartingSession, resumeModalOpen } = useAppSelector(
    (state) => state.interview,
  );

  const [startingTrackSlug, setStartingTrackSlug] = useState<string | null>(null);
  const [selectedTrackForDetail, setSelectedTrackForDetail] = useState<InterviewTrackSummary | null>(null);

  useEffect(() => {
    dispatch(fetchTracks(undefined));
    dispatch(fetchSessions());
  }, [dispatch]);

  const technicalTracks = tracks.filter((t) => t.category === "TECHNICAL");
  const otherTracks = tracks.filter((t) => t.category === "OTHER");

  const completedSessions = sessions.filter((s) => s.state === "COMPLETED" && s.overall_score !== null);
  const avgScore = completedSessions.length
    ? Math.round(completedSessions.reduce((acc, s) => acc + (s.overall_score || 0), 0) / completedSessions.length)
    : 0;
  const activeSession = sessions.find((s) => ["ASKING", "PREPARING", "PAUSED", "LISTENING"].includes(s.state));

  const handleStartPractice = async (track: InterviewTrackSummary) => {
    setStartingTrackSlug(track.slug);
    try {
      const resumeId = currentResume?.asset?.asset_id;
      const res = await dispatch(
        createSession({
          interview_slug: track.slug,
          resume_id: resumeId,
          mode: "TEXT",
        }),
      );

      if (createSession.fulfilled.match(res)) {
        const newSessionId = res.payload.id;
        await dispatch(startSession(newSessionId));
        navigate(`/interview/${newSessionId}`);
      }
    } finally {
      setStartingTrackSlug(null);
    }
  };

  const handleDelete = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this interview record?")) {
      await dispatch(deleteSession(sessionId));
    }
  };

  const renderTrackIcon = (iconName: string) => {
    switch (iconName.toLowerCase()) {
      case "monitor":
        return <Monitor className="size-4 text-[#B1FA63]" />;
      case "server":
        return <Server className="size-4 text-[#B1FA63]" />;
      case "braincircuit":
        return <BrainCircuit className="size-4 text-[#B1FA63]" />;
      case "layers":
        return <Layers className="size-4 text-[#B1FA63]" />;
      case "cloud":
        return <Cloud className="size-4 text-[#B1FA63]" />;
      case "database":
        return <Database className="size-4 text-[#B1FA63]" />;
      case "sparkles":
        return <Sparkles className="size-4 text-[#B1FA63]" />;
      case "users":
        return <Users className="size-4 text-[#B1FA63]" />;
      case "terminal":
        return <Terminal className="size-4 text-[#B1FA63]" />;
      default:
        return <Code className="size-4 text-[#B1FA63]" />;
    }
  };

  const getVerdictBadge = (verdict: string | null | undefined, score: number | null | undefined) => {
    if (!verdict && !score) {
      return (
        <span className="font-heading text-[11px] font-bold uppercase tracking-wider text-zinc-500">
          In Progress
        </span>
      );
    }
    const isHire = verdict?.includes("HIRE") ?? (score && score >= 70);
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-heading font-bold uppercase tracking-wider border ${
          isHire
            ? "bg-[#B1FA63]/15 text-[#B1FA63] border-[#B1FA63]/30"
            : "bg-amber-500/15 text-amber-400 border-amber-500/30"
        }`}
      >
        {score !== null && score !== undefined && <span className="font-mono font-bold">{score}</span>}
        <span>{verdict?.replace("_", " ") || "EVALUATED"}</span>
      </span>
    );
  };

  const renderTrackCard = (track: InterviewTrackSummary) => {
    const isStarting = startingTrackSlug === track.slug;

    return (
      <div
        key={track.slug}
        className="p-6 rounded-[24px] bg-[#1F1F1F] border border-white/[0.08] hover:border-[#B1FA63]/40 transition-all flex flex-col justify-between space-y-4 shadow-lg shadow-black/20 group"
      >
        <div className="space-y-3">
          {/* Header Badges */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#171717] border border-white/[0.08]">
              {renderTrackIcon(track.icon)}
              <span className="font-heading text-[10px] font-bold uppercase tracking-wider text-[#B1FA63]">
                {track.badge}
              </span>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-[10px] text-zinc-400">
              <span className="px-2 py-0.5 rounded-[6px] bg-[#171717] border border-white/[0.04]">
                {track.difficulty}
              </span>
              <span className="px-2 py-0.5 rounded-[6px] bg-[#171717] border border-white/[0.04]">
                {track.duration_minutes}m
              </span>
              <button
                type="button"
                onClick={() => setSelectedTrackForDetail(track)}
                className="p-1 rounded-[6px] hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                title="View Blueprint Details"
                aria-label={`View details for ${track.title}`}
              >
                <Info className="size-3.5" />
              </button>
            </div>
          </div>

          {/* Track Title & Description */}
          <div
            onClick={() => setSelectedTrackForDetail(track)}
            className="cursor-pointer"
          >
            <h3 className="text-base font-display uppercase tracking-wide text-white group-hover:text-[#B1FA63] transition-colors flex items-center justify-between">
              <span>{track.title}</span>
            </h3>
            <p className="text-xs font-sans text-zinc-400 leading-relaxed mt-1 line-clamp-2">
              {track.description}
            </p>
          </div>

          {/* Topic Chips */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {track.topics.slice(0, 3).map((topic) => (
              <span
                key={topic}
                className="font-mono text-[10px] px-2 py-0.5 rounded-[6px] bg-[#171717] text-zinc-300 border border-white/[0.04]"
              >
                {topic}
              </span>
            ))}
            {track.topics.length > 3 && (
              <button
                type="button"
                onClick={() => setSelectedTrackForDetail(track)}
                className="font-mono text-[10px] px-1.5 py-0.5 rounded-[6px] bg-[#171717] text-zinc-500 hover:text-zinc-300 border border-white/[0.04] cursor-pointer"
              >
                +{track.topics.length - 3} more
              </button>
            )}
          </div>
        </div>

        {/* Practice Action */}
        <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between">
          <button
            type="button"
            onClick={() => setSelectedTrackForDetail(track)}
            className="font-mono text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
          >
            v{track.version} • Details
          </button>
          <button
            type="button"
            disabled={isStarting}
            onClick={() => handleStartPractice(track)}
            className="px-4 py-2 rounded-[10px] bg-[#B1FA63] hover:bg-[#9de34f] text-black font-heading font-bold uppercase tracking-wider text-xs shadow-md shadow-[#B1FA63]/20 disabled:opacity-50 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            {isStarting ? (
              <>
                <div className="size-3 border-2 border-black border-t-transparent rounded-full animate-spin" />
                <span>Initializing…</span>
              </>
            ) : (
              <>
                <span>Practice</span>
                <ArrowRight className="size-3.5" />
              </>
            )}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8 min-w-0 font-sans">
      {/* Resume Intelligence Modal */}
      {resumeModalOpen && <ResumeManagerModal />}

      {/* Blueprint Detail Modal */}
      {selectedTrackForDetail && (
        <Dialog open={!!selectedTrackForDetail} onOpenChange={(open) => !open && setSelectedTrackForDetail(null)}>
          <DialogContent className="max-w-2xl bg-[#1F1F1F] border-white/10 rounded-[24px]">
            <DialogHeader className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#171717] border border-white/[0.08]">
                  {renderTrackIcon(selectedTrackForDetail.icon)}
                  <span className="font-heading text-[10px] font-bold uppercase tracking-wider text-[#B1FA63]">
                    {selectedTrackForDetail.badge}
                  </span>
                </div>
                <span className="font-mono text-[11px] text-zinc-400">
                  Track Version {selectedTrackForDetail.version}
                </span>
                <span className="px-2 py-0.5 rounded-[6px] bg-[#171717] font-mono text-[10px] text-zinc-400 border border-white/[0.04]">
                  {selectedTrackForDetail.category}
                </span>
              </div>
              <DialogTitle className="text-xl font-display uppercase tracking-wide text-white">
                {selectedTrackForDetail.title}
              </DialogTitle>
              <DialogDescription className="text-sm font-sans text-zinc-300 leading-relaxed">
                {selectedTrackForDetail.description}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 py-4 border-t border-b border-white/[0.08] text-xs">
              {/* Telemetry specs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-[12px] bg-[#171717] border border-white/[0.06] space-y-1">
                  <div className="text-[10px] font-heading font-bold uppercase tracking-wider text-zinc-500">Domain</div>
                  <div className="font-sans font-semibold text-zinc-200">{selectedTrackForDetail.domain}</div>
                </div>
                <div className="p-3 rounded-[12px] bg-[#171717] border border-white/[0.06] space-y-1">
                  <div className="text-[10px] font-heading font-bold uppercase tracking-wider text-zinc-500">Difficulty</div>
                  <div className="font-sans font-semibold text-[#B1FA63]">{selectedTrackForDetail.difficulty}</div>
                </div>
                <div className="p-3 rounded-[12px] bg-[#171717] border border-white/[0.06] space-y-1">
                  <div className="text-[10px] font-heading font-bold uppercase tracking-wider text-zinc-500">Duration</div>
                  <div className="font-mono text-zinc-200">{selectedTrackForDetail.duration_minutes} Minutes</div>
                </div>
                <div className="p-3 rounded-[12px] bg-[#171717] border border-white/[0.06] space-y-1">
                  <div className="text-[10px] font-heading font-bold uppercase tracking-wider text-zinc-500">Code Workspace</div>
                  <div className="font-sans font-semibold text-zinc-200">
                    {selectedTrackForDetail.supports_code ? "Enabled (Monaco)" : "Not Required"}
                  </div>
                </div>
              </div>

              {/* Full Syllabus Topics */}
              <div className="space-y-2">
                <div className="font-heading text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <BookOpen className="size-3.5 text-[#B1FA63]" />
                  <span>Curriculum & Tested Competencies</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedTrackForDetail.topics.map((t) => (
                    <span
                      key={t}
                      className="font-mono text-xs px-2.5 py-1 rounded-[8px] bg-[#171717] text-zinc-200 border border-white/[0.08]"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              {/* Immutable Evaluation Notice */}
              <div className="p-3 rounded-[12px] bg-white/[0.02] border border-white/[0.06] flex items-start gap-2.5">
                <ShieldCheck className="size-4 text-[#B1FA63] shrink-0 mt-0.5" />
                <div className="text-[11px] font-sans text-zinc-400 leading-relaxed">
                  <strong className="text-zinc-200 font-semibold">Deterministic Evaluation Blueprint:</strong> This session executes an immutable versioned DAG. Questions and follow-up probes dynamically adapt to your answers while strictly upholding the published rubric standard.
                </div>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <span className="text-[11px] font-sans text-zinc-500">
                {currentResume?.asset
                  ? `Personalized with ${currentResume.asset.original_filename}`
                  : "Standard practice (no resume attached)"}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedTrackForDetail(null)}
                  className="px-4 py-2 rounded-[12px] bg-[#171717] hover:bg-white/[0.08] border border-white/[0.08] text-zinc-300 font-heading font-bold uppercase tracking-wider text-xs cursor-pointer transition-colors"
                >
                  Close
                </button>
                <button
                  type="button"
                  disabled={startingTrackSlug === selectedTrackForDetail.slug}
                  onClick={() => {
                    const track = selectedTrackForDetail;
                    setSelectedTrackForDetail(null);
                    handleStartPractice(track);
                  }}
                  className="px-5 py-2 rounded-[12px] bg-[#B1FA63] hover:bg-[#9de34f] text-black font-heading font-bold uppercase tracking-wider text-xs shadow-md shadow-[#B1FA63]/20 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {startingTrackSlug === selectedTrackForDetail.slug ? (
                    <>
                      <div className="size-3 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      <span>Initializing…</span>
                    </>
                  ) : (
                    <>
                      <span>Start Practice</span>
                      <ArrowRight className="size-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Page Header */}
      <PageHeader
        title="AI Interview Arena"
        description="Select an admin-authored practice track to simulate technical, algorithmic, and leadership interviews calibrated to industry standards."
        badge={
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-heading font-bold uppercase tracking-wider bg-[#B1FA63]/15 text-[#B1FA63] border border-[#B1FA63]/30">
            <Sparkles className="size-3.5" />
            Adaptive Graph Runtime
          </span>
        }
        action={
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Optional Resume Button with Status Indicator */}
            <button
              onClick={() => dispatch(setResumeModalOpen(true))}
              className={`h-10 px-4 rounded-[12px] border font-heading font-bold uppercase tracking-wider text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer ${
                currentResume?.asset
                  ? "bg-[#B1FA63]/10 border-[#B1FA63]/30 text-[#B1FA63] hover:bg-[#B1FA63]/20"
                  : "bg-[#171717] hover:bg-white/[0.08] border-white/[0.08] text-zinc-300 hover:text-white"
              }`}
            >
              <FileText className="size-3.5" />
              <span>
                {currentResume?.asset ? "Resume Attached" : "Upload Resume (Optional)"}
              </span>
            </button>

            {/* Active In-Progress Session Resume Button */}
            {activeSession && (
              <button
                onClick={() => navigate(`/interview/${activeSession.id}`)}
                className="h-10 px-4 rounded-[12px] bg-[#B1FA63] hover:bg-[#9de34f] text-black font-heading font-bold uppercase tracking-wider text-xs shadow-md shadow-[#B1FA63]/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="size-3.5 fill-current" />
                <span>Resume Active Session</span>
              </button>
            )}
          </div>
        }
      />

      {/* Telemetry Metric Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="p-5 rounded-[24px] border border-white/[0.08] bg-[#1F1F1F] space-y-1 hover:border-[#B1FA63]/30 transition-all duration-200">
          <div className="text-xs font-heading font-bold uppercase tracking-wider text-zinc-400">
            Total Sessions
          </div>
          <div className="text-3xl sm:text-4xl font-display text-white tabular-nums tracking-wide">
            {sessions.length}
          </div>
          <div className="text-xs font-sans text-zinc-500">Attempted practice sessions</div>
        </div>

        <div className="p-5 rounded-[24px] border border-[#B1FA63]/25 bg-[#1F1F1F] space-y-1 hover:border-[#B1FA63]/50 transition-all duration-200">
          <div className="text-xs font-heading font-bold uppercase tracking-wider text-[#B1FA63]">
            Average Score
          </div>
          <div className="text-3xl sm:text-4xl font-display text-[#B1FA63] tabular-nums tracking-wide">
            {avgScore ? `${avgScore}/100` : "—"}
          </div>
          <div className="text-xs font-sans text-[#B1FA63]/70">Evaluated competency score</div>
        </div>

        <div className="p-5 rounded-[24px] border border-white/[0.08] bg-[#1F1F1F] space-y-1 hover:border-[#B1FA63]/30 transition-all duration-200">
          <div className="text-xs font-heading font-bold uppercase tracking-wider text-zinc-400">
            Completed Dossiers
          </div>
          <div className="text-3xl sm:text-4xl font-display text-white tabular-nums tracking-wide">
            {completedSessions.length}
          </div>
          <div className="text-xs font-sans text-zinc-500">Comprehensive feedback dossiers</div>
        </div>
      </section>

      {/* Resume Personalization Notice Banner (if resume present) */}
      {currentResume?.asset && (
        <div className="p-4 rounded-[18px] bg-[#1F1F1F] border border-[#B1FA63]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="size-4 text-[#B1FA63] shrink-0" />
            <span className="text-zinc-200 font-sans">
              <strong className="text-white font-semibold">{currentResume.asset.original_filename}</strong> is linked for question personalization. Questions may probe relevant project context without affecting standard evaluation rubrics.
            </span>
          </div>
          <button
            onClick={() => dispatch(setResumeModalOpen(true))}
            className="text-[11px] font-heading font-bold uppercase tracking-wider text-[#B1FA63] hover:underline shrink-0"
          >
            Review Extracted Facts →
          </button>
        </div>
      )}

      {/* Section 1: Published Technical Interviews Catalog */}
      <section className="space-y-4">
        <SectionHeader
          kicker="Authoritative Blueprints"
          title="Technical & Systems Tracks"
        />

        {isLoadingTracks && tracks.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-64 rounded-[24px] bg-[#1F1F1F] animate-pulse border border-white/[0.04]" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {technicalTracks.map((track) => renderTrackCard(track))}
          </div>
        )}
      </section>

      {/* Section 2: Published Behavioral & HR Rounds */}
      <section className="space-y-4">
        <SectionHeader
          kicker="Behavioral & Leadership"
          title="STAR-Method Cultural Rounds"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {otherTracks.map((track) => renderTrackCard(track))}
        </div>
      </section>

      {/* Section 3: Session History & Ledgers */}
      <section className="space-y-4">
        <SectionHeader title="Interview History & Dossiers" />

        {sessions.length === 0 ? (
          <div className="p-12 rounded-[24px] border border-white/[0.08] bg-[#1F1F1F] text-center space-y-3">
            <Terminal className="size-10 text-zinc-600 mx-auto" />
            <h3 className="text-lg font-display uppercase tracking-wide text-zinc-300">
              No Interview Sessions Found
            </h3>
            <p className="text-xs font-sans text-zinc-400 max-w-sm mx-auto">
              Select any of the published tracks above to begin practice and generate an evidence-backed coaching report.
            </p>
          </div>
        ) : (
          <div className="rounded-[24px] border border-white/[0.08] overflow-hidden bg-[#1F1F1F]">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-[#171717] border-b border-white/[0.08] text-zinc-400 font-heading font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3.5 px-5">Role & Track</th>
                    <th className="py-3.5 px-4">Seniority</th>
                    <th className="py-3.5 px-4">Status / Score</th>
                    <th className="py-3.5 px-4">Turns</th>
                    <th className="py-3.5 px-4">Date</th>
                    <th className="py-3.5 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {sessions.map((session) => (
                    <tr
                      key={session.id}
                      onClick={() => {
                        if (session.state === "COMPLETED") {
                          navigate(`/interview/${session.id}/report`);
                        } else {
                          navigate(`/interview/${session.id}`);
                        }
                      }}
                      className="hover:bg-white/[0.02] cursor-pointer transition-colors"
                    >
                      <td className="py-4 px-5">
                        <div className="font-sans font-semibold text-white text-sm">{session.target_role}</div>
                        <div className="text-[11px] text-zinc-500 font-mono flex items-center gap-1.5 mt-0.5">
                          <span className="text-[#B1FA63]">{session.category}</span>
                          <span>•</span>
                          <span>{session.difficulty}</span>
                          <span>•</span>
                          <span>{session.duration_minutes}m</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 font-sans text-xs text-zinc-300 capitalize">
                        {session.experience_level.replace("_", " ").toLowerCase()}
                      </td>
                      <td className="py-4 px-4">
                        {session.state === "COMPLETED" ? (
                          getVerdictBadge(session.verdict, session.overall_score)
                        ) : session.state === "ABANDONED" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-heading font-bold uppercase tracking-wider bg-zinc-800 text-zinc-400 border border-zinc-700">
                            ABANDONED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-amber-400 font-heading text-[11px] font-bold uppercase tracking-wider">
                            <span className="size-1.5 rounded-full bg-amber-400 animate-pulse" />
                            {session.state}
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4 font-mono text-xs text-zinc-400 tabular-nums">
                        {session.total_answers} / {session.total_questions}
                      </td>
                      <td className="py-4 px-4 font-mono text-xs text-zinc-500">
                        {new Date(session.created_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="py-4 px-5 text-right space-x-2">
                        {session.state === "COMPLETED" ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/interview/${session.id}/report`);
                            }}
                            className="h-8 px-3 rounded-[8px] bg-[#171717] hover:bg-white/[0.08] border border-white/[0.08] text-zinc-300 hover:text-white font-heading font-bold uppercase tracking-wider text-[11px] inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                          >
                            <FileText className="size-3 text-[#B1FA63]" />
                            Dossier
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/interview/${session.id}`);
                            }}
                            className="h-8 px-3 rounded-[8px] bg-[#B1FA63]/15 hover:bg-[#B1FA63]/25 border border-[#B1FA63]/30 text-[#B1FA63] font-heading font-bold uppercase tracking-wider text-[11px] inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                          >
                            <Play className="size-3 fill-current" />
                            Resume
                          </button>
                        )}
                        <button
                          onClick={(e) => handleDelete(session.id, e)}
                          className="p-2 rounded-[8px] hover:bg-red-500/10 text-zinc-500 hover:text-red-400 transition-colors cursor-pointer"
                          title="Delete session"
                          aria-label="Delete interview session"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
